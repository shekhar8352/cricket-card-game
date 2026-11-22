package engine

import "math/rand"

// Masterstroke is a captain's once-per-match signature move. It lasts one over.
type Masterstroke struct {
	Code        string      `json:"code"`
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Side        string      `json:"side"`    // "bat" or "bowl": when it can be played
	Trigger     string      `json:"trigger"` // see triggered()
	Effect      WeightDelta `json:"effect"`
	NoPressure  bool        `json:"noPressure,omitempty"` // batters ignore dot-ball pressure
	EarlyPress  bool        `json:"earlyPress,omitempty"` // pressure builds from the first dot
	TempBoost   int         `json:"tempBoost,omitempty"`  // temperament for this side's batters
}

var Masterstrokes = []Masterstroke{
	{"ice_veins", "Ice in the veins", "Last over: the batters ignore pressure and keep their heads.", "bat", "last_over", WeightDelta{One: 2, Four: 1, Wicket: -2}, true, false, 10},
	{"chase_master", "Chase master", "Behind the rate in a chase: picks the gaps without taking silly risks.", "bat", "chase_hard", WeightDelta{Four: 3, Wicket: -1}, false, false, 0},
	{"all_guns", "All guns blazing", "Powerplay over: everything goes. Huge reward, real risk.", "bat", "powerplay", WeightDelta{Four: 4, Six: 3, Wicket: 3}, false, false, 0},
	{"pull_party", "Pull-shot party", "Against pace: anything short disappears.", "bat", "vs_pace", WeightDelta{Six: 3, Four: 1}, false, false, 0},
	{"patient_trap", "Patient trap", "A middle over of tight lines where pressure builds from the first dot.", "bowl", "middle", WeightDelta{Dot: 2}, false, true, 0},
	{"spin_web", "Spin web", "A spinner's over with close catchers and drift.", "bowl", "spin_over", WeightDelta{Wicket: 3, Dot: 2}, false, false, 0},
	{"pace_barrage", "Pace barrage", "A fast bowler's over of short balls and yorkers.", "bowl", "pace_over", WeightDelta{Wicket: 2, Dot: 2, Four: -1}, false, false, 0},
	// Generic moves, assigned from a captain's strongest attribute.
	{"all_out_attack", "All-out attack", "One over to change the game with the bat.", "bat", "any_late", WeightDelta{Four: 3, Six: 2, Wicket: 2}, false, false, 0},
	{"trap_set", "Trap set", "A planned over of field and line to a batter's weakness.", "bowl", "any", WeightDelta{Wicket: 2, Dot: 2}, false, false, 0},
	{"steady_hands", "Steady hands", "A calm over: no panic, no soft dismissals.", "bat", "any", WeightDelta{Wicket: -2, One: 2}, true, false, 4},
	{"wildcard", "Wildcard", "An unexpected move. Could win the match, could backfire.", "bat", "any", WeightDelta{Six: 3, Four: 1, Wicket: 2}, false, false, 0},
}

func MasterstrokeByCode(code string) (Masterstroke, bool) {
	for _, m := range Masterstrokes {
		if m.Code == code {
			return m, true
		}
	}
	return Masterstroke{}, false
}

// GenericMasterstroke picks a move from the captain's strongest attribute.
func GenericMasterstroke(c Captaincy) string {
	best, code := c.Aggression, "all_out_attack"
	if c.Tactics > best {
		best, code = c.Tactics, "trap_set"
	}
	if c.Calm > best {
		best, code = c.Calm, "steady_hands"
	}
	if c.Flair > best {
		code = "wildcard"
	}
	return code
}

func (m Masterstroke) triggered(s situation, bowler *Card) bool {
	switch m.Trigger {
	case "last_over":
		return s.over == OversPerInnings-1
	case "chase_hard":
		return s.chasing() && s.requiredVsCurrent() > 2
	case "powerplay":
		return PhaseOf(s.over) == PhasePowerplay
	case "vs_pace":
		return bowler != nil && bowler.BowlType == BowlPace && s.over >= 1
	case "middle":
		return PhaseOf(s.over) == PhaseMiddle
	case "spin_over":
		return bowler != nil && bowler.BowlType == BowlSpin
	case "pace_over":
		return bowler != nil && bowler.BowlType == BowlPace && s.over >= 2
	case "any_late":
		return s.over >= 2
	default:
		return true
	}
}

// maybeMasterstroke decides whether a captain plays their move this over.
// Good captains wait for the right moment; flair can fire it anyway.
func maybeMasterstroke(rng *rand.Rand, cap Card, side string, s situation, bowler *Card) (Masterstroke, bool) {
	cp := CaptaincyOf(cap)
	m, ok := MasterstrokeByCode(cp.Masterstroke)
	if !ok || m.Side != side {
		return Masterstroke{}, false
	}
	p := 0.0
	if m.triggered(s, bowler) {
		p = 0.35 + float64(effectiveTactics(cap, 0))/200
		if s.over == OversPerInnings-1 {
			p = 1 // last chance this innings
		}
	} else {
		p = float64(cp.Flair) / 400 // impulsive, possibly wasted
	}
	if rng.Float64() < p {
		return m, true
	}
	return Masterstroke{}, false
}
