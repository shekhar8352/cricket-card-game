package engine

import "fmt"

// ---------------------------------------------------------------------------
// Strategy layer: choices a captain makes before the match that change the
// per-ball odds. Every number here is exported through Model() so the public
// "How the engine works" page always shows the values the simulation uses.
// ---------------------------------------------------------------------------

// Approach is how the batting side plays in a phase of the innings.
type Approach string

const (
	ApproachDefend   Approach = "defend"
	ApproachBalanced Approach = "balanced"
	ApproachAttack   Approach = "attack"
)

// FieldPlan is how the bowling side sets its field for one over.
type FieldPlan string

const (
	FieldDefend   FieldPlan = "defend"
	FieldBalanced FieldPlan = "balanced"
	FieldAttack   FieldPlan = "attack"
)

// Phases split the 5-over innings for batting approach.
const (
	PhasePowerplay = 0 // overs 1-2
	PhaseMiddle    = 1 // overs 3-4
	PhaseDeath     = 2 // over 5
	NumPhases      = 3
)

var PhaseNames = [NumPhases]string{"Powerplay (overs 1-2)", "Middle (overs 3-4)", "Death (over 5)"}

// PhaseOf maps a 0-based over to its batting phase.
func PhaseOf(over int) int {
	switch {
	case over <= 1:
		return PhasePowerplay
	case over <= 3:
		return PhaseMiddle
	default:
		return PhaseDeath
	}
}

// Tactics is the captain's match plan. Missing entries mean "balanced".
type Tactics struct {
	BatApproach []Approach  `json:"batApproach"` // one per phase
	FieldPlan   []FieldPlan `json:"fieldPlan"`   // one per over
}

func (t Tactics) ApproachFor(over int) Approach {
	p := PhaseOf(over)
	if p < len(t.BatApproach) && t.BatApproach[p] != "" {
		return t.BatApproach[p]
	}
	return ApproachBalanced
}

func (t Tactics) FieldFor(over int) FieldPlan {
	if over < len(t.FieldPlan) && t.FieldPlan[over] != "" {
		return t.FieldPlan[over]
	}
	return FieldBalanced
}

func ValidateTactics(t Tactics) error {
	if len(t.BatApproach) > NumPhases {
		return fmt.Errorf("batting approach has %d phases, want at most %d", len(t.BatApproach), NumPhases)
	}
	for _, a := range t.BatApproach {
		switch a {
		case "", ApproachDefend, ApproachBalanced, ApproachAttack:
		default:
			return fmt.Errorf("unknown batting approach %q", a)
		}
	}
	if len(t.FieldPlan) > OversPerInnings {
		return fmt.Errorf("field plan has %d overs, want at most %d", len(t.FieldPlan), OversPerInnings)
	}
	for _, f := range t.FieldPlan {
		switch f {
		case "", FieldDefend, FieldBalanced, FieldAttack:
		default:
			return fmt.Errorf("unknown field plan %q", f)
		}
	}
	return nil
}

// WeightDelta is added to the outcome weights of a single ball.
type WeightDelta struct {
	Dot    int `json:"dot"`
	One    int `json:"one"`
	Two    int `json:"two"`
	Four   int `json:"four"`
	Six    int `json:"six"`
	Wicket int `json:"wicket"`
}

func (w *weights) add(d WeightDelta) {
	w.dot += d.Dot
	w.one += d.One
	w.two += d.Two
	w.four += d.Four
	w.six += d.Six
	w.wicket += d.Wicket
}

// ApproachEffects: attacking batting trades wickets for boundaries;
// defending protects wickets and rotates strike instead.
var ApproachEffects = map[Approach]WeightDelta{
	ApproachAttack: {Dot: -3, One: -3, Four: 3, Six: 2, Wicket: 2},
	ApproachDefend: {One: 4, Two: 1, Four: -2, Six: -2, Wicket: -3},
}

// FieldEffects: an attacking field brings catchers in (more wickets, but gaps
// for boundaries); a defensive field guards the rope (singles flow, wickets dry up).
var FieldEffects = map[FieldPlan]WeightDelta{
	FieldAttack: {Dot: -1, One: -3, Four: 2, Six: 1, Wicket: 3},
	FieldDefend: {One: 3, Two: 2, Four: -2, Six: -1, Wicket: -2},
}

// Counter is a bonus that applies only when a batting approach meets a field.
type Counter struct {
	Approach Approach    `json:"approach"`
	Field    FieldPlan   `json:"field"`
	Name     string      `json:"name"`
	Effect   WeightDelta `json:"effect"`
	Why      string      `json:"why"`
}

// Counters make the plans a cycle with no single best choice:
// attacking field > defensive batting > defensive field > attacking batting > attacking field.
var Counters = []Counter{
	{ApproachAttack, FieldDefend, "Holing out", WeightDelta{Four: -4, Six: -3, Wicket: 5},
		"Slogging into a defensive field finds the sweepers on the rope."},
	{ApproachAttack, FieldAttack, "Over the top", WeightDelta{Four: 3, Six: 2},
		"With the field up, lofted shots clear the infield for boundaries."},
	{ApproachDefend, FieldAttack, "Strangled", WeightDelta{Dot: 7, One: -5, Four: -1, Wicket: 4},
		"Close catchers and no easy singles: a defensive batter gets stuck and nicks off."},
	{ApproachDefend, FieldDefend, "Free singles", WeightDelta{Dot: -10, One: 14, Two: 10, Four: 2},
		"With everyone back on the rope, the batter jogs ones and twos all day."},
}

func counterFor(a Approach, f FieldPlan) *Counter {
	for i := range Counters {
		if Counters[i].Approach == a && Counters[i].Field == f {
			return &Counters[i]
		}
	}
	return nil
}

// Pitch is the surface for a match. It is derived from the match seed, so
// both captains see it before they pick a team.
type Pitch string

const (
	PitchBalanced Pitch = "balanced"
	PitchGreen    Pitch = "green"
	PitchDusty    Pitch = "dusty"
	PitchFlat     Pitch = "flat"
)

type PitchDef struct {
	Code        Pitch  `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Tip         string `json:"tip"`
	// Bowler skill bonus by bowling type, and extra for spin in the 2nd innings.
	PaceBonus      int `json:"paceBonus"`
	SpinBonus      int `json:"spinBonus"`
	SpinWearBonus  int `json:"spinWearBonus"`
	BatterBonus    int `json:"batterBonus"`
	ExtraSeamEdges int `json:"extraSeamEdges"` // weight added to caught-behind for pace
	// Par is the average first-innings total for two equal sides with balanced
	// plans, measured by simulation (TestPitchPar keeps it honest).
	Par int `json:"par"`
}

var Pitches = []PitchDef{
	{PitchBalanced, "Balanced", "A fair surface with something for everyone.", "Pick your strongest seven.", 0, 0, 0, 0, 0, 47},
	{PitchGreen, "Green seamer", "Grass on the pitch helps the ball move off the seam.", "Pick an extra pace bowler. Edges carry to the keeper.", 10, -6, 0, 0, 10, 45},
	{PitchDusty, "Dusty turner", "Dry and cracked. It grips for spinners and gets worse as the match goes on.", "Pick spinners. Batting first avoids the worn 2nd-innings pitch.", -4, 9, 5, 0, 0, 46},
	{PitchFlat, "Flat road", "Hard and true. The ball comes onto the bat.", "Back your hitters. Defensive fields matter more than wicket-taking.", -1, -1, 0, 5, 0, 51},
}

func PitchByCode(p Pitch) PitchDef {
	for _, d := range Pitches {
		if d.Code == p {
			return d
		}
	}
	return Pitches[0]
}

// PitchForSeed picks the surface from the match seed with a hash that is
// independent of the ball-by-ball random stream. Balanced is twice as likely.
func PitchForSeed(seed int64) Pitch {
	x := uint64(seed)
	x ^= x >> 33
	x *= 0xff51afd7ed558ccd
	x ^= x >> 33
	switch x % 5 {
	case 0:
		return PitchGreen
	case 1:
		return PitchDusty
	case 2:
		return PitchFlat
	default:
		return PitchBalanced
	}
}

// Pressure: consecutive dot balls make a batter more likely to take a risk.
const (
	PressureStartsAt = 2 // dots in a row before pressure applies
	PressureMax      = 5 // cap on counted dots
)

// Matchup thresholds for the batter's skill against the bowling type.
const (
	MatchupWeakBelow     = 60
	MatchupStrongAtLeast = 85
)

var (
	MatchupWeakEffect   = WeightDelta{Four: -2, Wicket: 2}
	MatchupStrongEffect = WeightDelta{Four: 2, Wicket: -1}
)

// SkillCurve controls how a skill gap turns into outcome weight shifts:
// shift = SkillCurveScale * tanh(gap / SkillCurveWidth). It is close to
// linear for small gaps and flattens for big ones, so tactics can bridge part
// of a large ratings gap but never all of it.
const (
	SkillCurveScale = 14.0
	SkillCurveWidth = 42.0
)
