package engine

import (
	"fmt"
	"math/rand"
)

// BreakCall is a captain's plan card for the second innings.
type BreakCall string

const (
	CallCaptain     BreakCall = "captain" // let the captain play it their way
	CallSteady      BreakCall = "steady"
	CallFastStart   BreakCall = "fast_start"
	CallLateCharge  BreakCall = "late_charge"
	CallHunt        BreakCall = "hunt"
	CallSqueeze     BreakCall = "squeeze"
	CallReadBatters BreakCall = "read_batters"
)

// BreakCallDef is a plan card. Bias is added per over to the captain's
// utility for each step towards attack (bat) or an attacking field (bowl).
type BreakCallDef struct {
	Code        BreakCall  `json:"code"`
	Side        string     `json:"side"` // "chase" or "defend"
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Bias        [5]float64 `json:"bias"`
}

var BreakCalls = []BreakCallDef{
	{CallSteady, "chase", "Steady chase", "Keep wickets in hand early and build to a finish.", [5]float64{-0.5, -0.5, 0, 0.5, 1.5}},
	{CallFastStart, "chase", "Fast start", "Go hard while the field is up, then reassess.", [5]float64{2, 1.5, 0, 0, 0.5}},
	{CallLateCharge, "chase", "Late charge", "Dig in, keep wickets, and explode in the last two overs.", [5]float64{-1.5, -1.5, -1, 1.5, 2.5}},
	{CallHunt, "defend", "Hunt wickets", "Catchers in all innings. Bowl them out before they get going.", [5]float64{1.5, 1.5, 1.5, 1.5, 1.5}},
	{CallSqueeze, "defend", "Squeeze", "Protect the boundary and make them take risks.", [5]float64{-1.5, -1.5, -1.5, -1.5, -1.5}},
	{CallReadBatters, "defend", "Read the batters", "Watch their approach and counter it.", [5]float64{}},
}

func BreakCallByCode(c BreakCall) (BreakCallDef, bool) {
	for _, d := range BreakCalls {
		if d.Code == c {
			return d, true
		}
	}
	return BreakCallDef{}, false
}

// ValidateBreakCall checks a call suits the side's role ("chase" or "defend").
func ValidateBreakCall(c BreakCall, role string) error {
	if c == "" || c == CallCaptain {
		return nil
	}
	d, ok := BreakCallByCode(c)
	if !ok {
		return fmt.Errorf("unknown plan %q", c)
	}
	if d.Side != role {
		return fmt.Errorf("%s is a plan for the %s side", d.Name, d.Side)
	}
	return nil
}

func breakBias(c BreakCall, over int, batting bool) float64 {
	d, ok := BreakCallByCode(c)
	if !ok || over < 0 || over >= OversPerInnings {
		return 0
	}
	if (d.Side == "chase") != batting {
		return 0
	}
	return d.Bias[over]
}

// CaptainBreakCall is the card a captain picks themselves, from personality.
func CaptainBreakCall(rng *rand.Rand, cap Card, role string, target int, par int) BreakCall {
	cp := CaptaincyOf(cap)
	r := rng.Float64() * 100
	if role == "chase" {
		hard := target > par+6
		switch {
		case cp.Aggression >= 75 || (hard && r < float64(cp.Aggression)):
			return CallFastStart
		case cp.Calm >= 80 && r < float64(cp.Calm):
			return CallLateCharge
		default:
			return CallSteady
		}
	}
	small := target < par-4
	switch {
	case cp.Tactics >= 80 && r < float64(cp.Tactics):
		return CallReadBatters
	case cp.Aggression >= 65 || small:
		return CallHunt
	default:
		return CallSqueeze
	}
}

// SuggestBreakCall is what the player's captain recommends at the break,
// deterministic per match so the suggestion doesn't change on reload.
func SuggestBreakCall(seed int64, cap Card, role string, target, par int) BreakCall {
	return CaptainBreakCall(rand.New(rand.NewSource(seed^0x5bd1e995)), cap, role, target, par)
}
