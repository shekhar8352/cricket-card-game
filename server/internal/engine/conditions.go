package engine

// Conditions change at the innings break and apply to the second innings only.
type Conditions string

const (
	CondClear     Conditions = "clear"
	CondDew       Conditions = "dew"
	CondCrumbling Conditions = "crumbling"
	CondOvercast  Conditions = "overcast"
)

type ConditionsDef struct {
	Code        Conditions `json:"code"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Chance      int        `json:"chance"` // percent
	PaceBonus   int        `json:"paceBonus"`
	SpinBonus   int        `json:"spinBonus"`
	BatterBonus int        `json:"batterBonus"`
	CatchDrop   int        `json:"catchDrop"` // catch conversion lost, percentage points
	SeamEdges   int        `json:"seamEdges"`
}

var ConditionsList = []ConditionsDef{
	{CondClear, "Clear evening", "Nothing changes.", 50, 0, 0, 0, 0, 0},
	{CondDew, "Dew", "A wet ball: spinners lose grip, catches slip, batting gets easier.", 20, 0, -4, 2, 5, 0},
	{CondCrumbling, "Crumbling pitch", "The surface breaks up: spinners get extra turn.", 15, 0, 4, 0, 0, 0},
	{CondOvercast, "Cloud cover", "Clouds roll in: the ball swings and edges carry.", 15, 4, 0, 0, 0, 6},
}

func ConditionsByCode(c Conditions) ConditionsDef {
	for _, d := range ConditionsList {
		if d.Code == c {
			return d
		}
	}
	return ConditionsList[0]
}

// ConditionsForSeed picks the second-innings conditions from the match seed,
// independent of the pitch and the ball-by-ball randomness.
func ConditionsForSeed(seed int64) Conditions {
	x := uint64(seed) ^ 0x9e3779b97f4a7c15
	x ^= x >> 31
	x *= 0xbf58476d1ce4e5b9
	x ^= x >> 29
	r := int(x % 100)
	for _, d := range ConditionsList {
		if r < d.Chance {
			return d.Code
		}
		r -= d.Chance
	}
	return CondClear
}
