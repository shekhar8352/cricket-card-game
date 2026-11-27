package cards

import (
	"math/rand"
	"testing"

	"github.com/sudhanshushekhar/cricket-card-game/internal/engine"
)

func TestXPAndOdds(t *testing.T) {
	if XPToNext(1) != 80 {
		t.Fatal()
	}
	bat, wk, ar, bowl := engine.RoleBAT, engine.RoleWK, engine.RoleAR, engine.RoleBOWL
	for _, c := range []struct {
		ovr      int
		from, to engine.Role
		same     bool
		want     int
	}{
		{60, bat, bat, false, 45},  // 30 x 1.5
		{60, bowl, bat, false, 21}, // 30 x 0.7
		{60, wk, bat, false, 33},   // 30 x 1.1
		{60, ar, bowl, false, 33},  // related
		{60, wk, bowl, false, 21},  // off
		{80, bat, bat, false, 144}, // 30 x 1.06^20 x 1.5
		{70, bat, bat, true, 161},  // copy: 30 x 1.06^10 x 3
		{30, bowl, bat, false, 10}, // floor
	} {
		if got := XPForSacrifice(c.ovr, c.from, c.to, c.same); got != c.want {
			t.Errorf("XPForSacrifice(%d, %s->%s, %v) = %d, want %d", c.ovr, c.from, c.to, c.same, got, c.want)
		}
	}
	// A wider spread than rarity bands: a 90 is worth several times a 60.
	if XPForSacrifice(90, bat, bat, false) < 4*XPForSacrifice(60, bat, bat, false) {
		t.Error("rating curve too flat")
	}
	rng := rand.New(rand.NewSource(1))
	seen := map[engine.Rarity]int{}
	for i := 0; i < 200; i++ {
		seen[RollRarity(rng, "Legend")]++
	}
	if seen[engine.RarityLegend] == 0 && seen[engine.RarityGold] == 0 {
		t.Fatal("legend arena should roll high rarities sometimes")
	}
}
