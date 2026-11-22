package engine

// ChemistryRules: how well two batters run together. The link level between
// striker and non-striker (0-3) changes strike rotation and running.
type ChemistryRules struct {
	SameCountry       int `json:"sameCountry"`
	KnownPartnership  int `json:"knownPartnership"`
	MaxLink           int `json:"maxLink"`
	SinglesPerLink    int `json:"singlesPerLink"`    // weight added to singles
	DotsPerLink       int `json:"dotsPerLink"`       // weight removed from dots per level
	RunUpgradePerLink int `json:"runUpgradePerLink"` // % chance per level to turn a single into two
	RunOutCutPerLink  int `json:"runOutCutPerLink"`  // % of run-out risk removed per level
}

var Chemistry = ChemistryRules{SameCountry: 1, KnownPartnership: 2, MaxLink: 3, SinglesPerLink: 1, DotsPerLink: 1, RunUpgradePerLink: 5, RunOutCutPerLink: 15}

// Link is the chemistry level between two players.
func Link(a, b *Card) int {
	if a == nil || b == nil {
		return 0
	}
	l := 0
	if a.Country != "" && a.Country == b.Country {
		l += Chemistry.SameCountry
	}
	if partners(a, b) {
		l += Chemistry.KnownPartnership
	}
	if l > Chemistry.MaxLink {
		l = Chemistry.MaxLink
	}
	return l
}

func partners(a, b *Card) bool {
	for _, p := range a.Partners {
		if p == b.PlayerID {
			return true
		}
	}
	for _, p := range b.Partners {
		if p == a.PlayerID {
			return true
		}
	}
	return false
}

// TeamChemistry scores a batting order 0-100 from neighbouring pairs, who are
// most likely to bat together.
func TeamChemistry(cards []Card, order []string) int {
	if len(order) < 2 {
		return 0
	}
	total := 0
	for i := 0; i+1 < len(order); i++ {
		total += Link(CardByID(cards, order[i]), CardByID(cards, order[i+1]))
	}
	return total * 100 / ((len(order) - 1) * Chemistry.MaxLink)
}
