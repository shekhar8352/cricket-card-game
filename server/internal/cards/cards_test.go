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
	if XPForSacrifice(engine.RarityBronze, true) != 120 {
		t.Fatal()
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
