package engine

import (
	"fmt"
	"math/rand"
)

// BreakCall is a game plan for one innings. The player picks one before the
// match for the first innings (one if they bat first, one if they bowl first)
// and again at the innings break for the second. A plan sets the batting
// approach or field for every over; "captain" leaves each over to the AI
// captain. (The type keeps its old name: plans started as break-only cards.)
type BreakCall string

const (
	CallCaptain BreakCall = "captain" // the captain decides over by over

	// Batting plans.
	CallSteady      BreakCall = "steady"
	CallFastStart   BreakCall = "fast_start"
	CallLateCharge  BreakCall = "late_charge"
	CallAllOut      BreakCall = "all_out"
	CallTargetWeak  BreakCall = "target_weak"
	CallReadField   BreakCall = "read_field"
	CallWicketsHand BreakCall = "wickets_in_hand"

	// Bowling plans.
	CallHunt        BreakCall = "hunt"
	CallSqueeze     BreakCall = "squeeze"
	CallStrikeEarly BreakCall = "strike_early"
	CallChokeStrike BreakCall = "choke_then_strike"
	CallMatchUps    BreakCall = "match_ups"
	CallReadBatters BreakCall = "read_batters"
)

// Plan modes.
const (
	ModeFixed      = "fixed"       // Seq sets every over
	ModeRead       = "read"        // the captain decides, with +ReadTheBatters tactics
	ModeTargetWeak = "target_weak" // attack their weakest bowler's overs and the last over
	ModeMatchUps   = "match_ups"   // attack when our bowler has the edge on the batter, protect otherwise
)

// Plan steps: -1 defend, 0 balanced, 1 attack.
type BreakCallDef struct {
	Code        BreakCall `json:"code"`
	Side        string    `json:"side"` // "bat" or "bowl"
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Mode        string    `json:"mode"`
	Seq         [5]int    `json:"seq"`      // per over, for fixed plans
	Weakness    string    `json:"weakness"` // the opposing plans that hurt it most (from TestPlanBalance's table)
	// Bias is kept for older clients: the same steps as floats.
	Bias [5]float64 `json:"bias"`
}

var BreakCalls = []BreakCallDef{
	{Code: CallSteady, Side: "bat", Name: "Steady build", Description: "Play yourself in, then accelerate in the last two overs.", Mode: ModeFixed, Seq: [5]int{0, 0, 0, 1, 1}, Weakness: "Squeeze, Strike early"},
	{Code: CallFastStart, Side: "bat", Name: "Fast start", Description: "Cash in while the field is up, consolidate, then finish hard.", Mode: ModeFixed, Seq: [5]int{1, 1, 0, 0, 1}, Weakness: "Squeeze"},
	{Code: CallLateCharge, Side: "bat", Name: "Late charge", Description: "Protect wickets early and save the hitting for the end.", Mode: ModeFixed, Seq: [5]int{-1, -1, 0, 1, 1}, Weakness: "Strike early"},
	{Code: CallAllOut, Side: "bat", Name: "All-out attack", Description: "Swing from ball one. Big totals, or a quick collapse.", Mode: ModeFixed, Seq: [5]int{1, 1, 1, 1, 1}, Weakness: "Squeeze"},
	{Code: CallWicketsHand, Side: "bat", Name: "Wickets in hand", Description: "Nudge and run for four overs and only go big in the last.", Mode: ModeFixed, Seq: [5]int{-1, -1, -1, 0, 1}, Weakness: "Strike early, Hunt wickets"},
	{Code: CallTargetWeak, Side: "bat", Name: "Target the weak link", Description: "Attack every over from their lowest-rated bowler and the last over; play straight otherwise.", Mode: ModeTargetWeak, Weakness: "Squeeze, Strike early"},
	{Code: CallReadField, Side: "bat", Name: "Read the field", Description: "Your captain watches their fields and counters them (+15 tactics).", Mode: ModeRead, Weakness: "Choke then strike"},

	{Code: CallHunt, Side: "bowl", Name: "Hunt wickets", Description: "Catchers in all innings. Bowl them out before they get going.", Mode: ModeFixed, Seq: [5]int{1, 1, 1, 1, 1}, Weakness: "All-out attack, Fast start"},
	{Code: CallSqueeze, Side: "bowl", Name: "Squeeze", Description: "Protect the boundary every over and make them take risks.", Mode: ModeFixed, Seq: [5]int{-1, -1, -1, -1, -1}, Weakness: "Read the field, Wickets in hand"},
	{Code: CallStrikeEarly, Side: "bowl", Name: "Strike early", Description: "Attack with the new ball, then drop back to protect the rope.", Mode: ModeFixed, Seq: [5]int{1, 1, 0, -1, -1}, Weakness: "All-out attack, Fast start"},
	{Code: CallChokeStrike, Side: "bowl", Name: "Choke then strike", Description: "Dry up the runs early, then bring the catchers in when they have to go.", Mode: ModeFixed, Seq: [5]int{-1, -1, 0, 1, 1}, Weakness: "Late charge, All-out attack"},
	{Code: CallMatchUps, Side: "bowl", Name: "Play the match-ups", Description: "Attack when your bowler has the edge on their top batters, protect the rope when he doesn't.", Mode: ModeMatchUps, Weakness: "All-out attack"},
	{Code: CallReadBatters, Side: "bowl", Name: "Read the batters", Description: "Your captain watches their approach and counters it (+15 tactics).", Mode: ModeRead, Weakness: "Fast start, All-out attack"},
}

func init() {
	for i := range BreakCalls {
		for o, v := range BreakCalls[i].Seq {
			BreakCalls[i].Bias[o] = float64(v)
		}
	}
}

// ChaseOverride: a fixed batting plan still attacks when the chase demands
// it, so a plan can't leave a side blocking while the game drifts away.
const ChaseOverrideRRR = 13.0

func BreakCallByCode(c BreakCall) (BreakCallDef, bool) {
	for _, d := range BreakCalls {
		if d.Code == c {
			return d, true
		}
	}
	return BreakCallDef{}, false
}

// sideFor maps an innings role to a plan side: "chase"/"bat" -> "bat", "defend"/"bowl" -> "bowl".
func sideFor(role string) string {
	if role == "chase" || role == "bat" {
		return "bat"
	}
	return "bowl"
}

// ValidateBreakCall checks a plan suits the side's role ("chase"/"bat" or "defend"/"bowl").
func ValidateBreakCall(c BreakCall, role string) error {
	if c == "" || c == CallCaptain {
		return nil
	}
	d, ok := BreakCallByCode(c)
	if !ok {
		return fmt.Errorf("unknown plan %q", c)
	}
	if d.Side != sideFor(role) {
		return fmt.Errorf("%s is a %s plan", d.Name, map[string]string{"bat": "batting", "bowl": "bowling"}[d.Side])
	}
	return nil
}

// planStep is the plan's call for this over, or ok=false when the captain decides.
func planStep(c BreakCall, s situation, bowler *Card, striker *Card, bowling Lineup, batting bool) (int, bool) {
	d, found := BreakCallByCode(c)
	if !found || d.Mode == ModeRead || (d.Side == "bat") != batting {
		return 0, false
	}
	step := 0
	switch d.Mode {
	case ModeFixed:
		if s.over >= 0 && s.over < OversPerInnings {
			step = d.Seq[s.over]
		}
	case ModeTargetWeak:
		if s.over == OversPerInnings-1 || (bowler != nil && bowler.ID == weakestBowler(bowling)) {
			step = 1
		}
	case ModeMatchUps:
		if bowler != nil && striker != nil {
			edge := bowlSkill(*bowler) - batSkillVs(*striker, bowler.BowlType)
			switch {
			case edge >= 0:
				step = 1
			case edge < -8:
				step = -1
			}
		}
	}
	if batting && s.chasing() && s.requiredRate() >= ChaseOverrideRRR {
		step = 1
	}
	return step, true
}

// weakestBowler is the bowler in the plan with the lowest bowling skill.
func weakestBowler(l Lineup) string {
	best, id := 1e9, ""
	seen := map[string]bool{}
	for _, b := range l.BowlingPlan {
		if seen[b] {
			continue
		}
		seen[b] = true
		if c := CardByID(l.Cards, b); c != nil {
			if v := bowlSkill(*c); v < best {
				best, id = v, b
			}
		}
	}
	return id
}

func bowlSkill(c Card) float64 {
	a := Effective(c)
	return float64(a.Accuracy)*0.4 + float64(a.Variation)*0.3 + float64(a.WicketTaking)*0.3
}

func batSkillVs(c Card, bt BowlType) float64 {
	a := Effective(c)
	vs := a.VsPace
	if bt == BowlSpin {
		vs = a.VsSpin
	}
	return float64(a.Technique)*0.5 + float64(a.Power)*0.3 + float64(vs)*0.2
}

// CaptainBreakCall is the plan a captain picks themselves, from personality.
// Bots use it for both innings.
func CaptainBreakCall(rng *rand.Rand, cap Card, role string, target int, par int) BreakCall {
	cp := CaptaincyOf(cap)
	r := rng.Float64() * 100
	if sideFor(role) == "bat" {
		hard := target > 0 && target > par+6
		switch {
		case cp.Tactics >= 85 && r < float64(cp.Tactics)/2:
			return CallReadField
		case cp.Aggression >= 85:
			return CallAllOut
		case cp.Aggression >= 70 || (hard && r < float64(cp.Aggression)):
			return CallFastStart
		case cp.Calm >= 80 && r < float64(cp.Calm):
			return CallLateCharge
		case r < 30:
			return CallTargetWeak
		default:
			return CallSteady
		}
	}
	small := target > 0 && target < par-4
	switch {
	case cp.Tactics >= 80 && r < float64(cp.Tactics):
		return CallReadBatters
	case cp.Aggression >= 75 || small:
		return CallHunt
	case cp.Aggression >= 60:
		return CallStrikeEarly
	case r < 35:
		return CallMatchUps
	default:
		return CallSqueeze
	}
}

// SuggestBreakCall is what the player's captain recommends, deterministic per
// match so the suggestion doesn't change on reload.
func SuggestBreakCall(seed int64, cap Card, role string, target, par int) BreakCall {
	return CaptainBreakCall(rand.New(rand.NewSource(seed^0x5bd1e995)), cap, role, target, par)
}
