package seedcatalog

import (
	"sort"
	"testing"

	"github.com/sudhanshushekhar/cricket-card-game/internal/engine"
)

func tier(all []engine.Card, off int, prefix string) engine.Lineup {
	by := map[engine.Role][]engine.Card{}
	for _, c := range all {
		Enrich(&c)
		by[c.Role] = append(by[c.Role], c)
	}
	for _, l := range by {
		sort.Slice(l, func(i, j int) bool { return engine.Overall(l[i]) > engine.Overall(l[j]) })
	}
	pick := func(r engine.Role, n int) []engine.Card {
		o := off * len(by[r]) / 100
		return by[r][o : o+n]
	}
	var cards []engine.Card
	cards = append(cards, pick(engine.RoleBAT, 3)...)
	cards = append(cards, pick(engine.RoleWK, 1)...)
	cards = append(cards, pick(engine.RoleAR, 1)...)
	// one pacer one spinner
	var pace, spin *engine.Card
	o := off * len(by[engine.RoleBOWL]) / 100
	for i := o; i < len(by[engine.RoleBOWL]) && (pace == nil || spin == nil); i++ {
		c := by[engine.RoleBOWL][i]
		if c.BowlType == engine.BowlPace && pace == nil {
			pace = &c
		} else if c.BowlType == engine.BowlSpin && spin == nil {
			spin = &c
		}
	}
	cards = append(cards, *pace, *spin)
	for i := range cards {
		cards[i].ID = prefix + cards[i].ID + string(rune('a'+i))
		cards[i].Level = 1
	}
	return engine.Lineup{UserID: prefix, Cards: cards, BattingOrder: engine.DefaultBattingOrder(cards), BowlingPlan: engine.DefaultBowlingPlan(cards), CaptainID: cards[0].ID}
}

func avg(l engine.Lineup) float64 {
	s := 0
	for _, c := range l.Cards {
		s += engine.Overall(c)
	}
	return float64(s) / 7
}

// Ratings must decide most matches between real teams: the side with the
// better cards should win clearly more often as the gap grows, while upsets
// still happen. Tiers are real catalog players picked by percentile per role.
func TestRatingGapDecidesMatches(t *testing.T) {
	if testing.Short() {
		t.Skip()
	}
	all := All()
	top := tier(all, 0, "t")
	for _, c := range []struct {
		pct      int
		min, max float64
	}{{5, 0.62, 0.78}, {15, 0.70, 0.86}, {30, 0.84, 0.97}} {
		low := tier(all, c.pct, "l")
		n, w := 2000, 0
		for i := 0; i < n; i++ {
			h, a := top, low
			if i%2 == 1 {
				h, a = low, top
			}
			r, err := engine.Simulate(int64(90000+i), h, a, engine.TossResult{})
			if err != nil {
				t.Fatal(err)
			}
			if r.Winner != "tie" && (r.Winner == "home") == (i%2 == 0) {
				w++
			}
		}
		rate := float64(w) / float64(n)
		t.Logf("team %.1f vs %.1f (gap %.1f): stronger side wins %.1f%%", avg(top), avg(low), avg(top)-avg(low), rate*100)
		if rate < c.min || rate > c.max {
			t.Errorf("gap %.1f: stronger side won %.1f%%, want %.0f-%.0f%%", avg(top)-avg(low), rate*100, c.min*100, c.max*100)
		}
	}
}
