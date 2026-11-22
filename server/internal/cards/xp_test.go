package cards

import (
	"testing"

	"github.com/sudhanshushekhar/cricket-card-game/internal/engine"
)

func TestPerformanceXP(t *testing.T) {
	cases := map[float64]int{3.0: 2, 5.0: 2, 6.0: 5, 7.0: 8, 8.5: 13, 10.0: 17}
	for rating, want := range cases {
		if got := PerformanceXP(rating); got != want {
			t.Errorf("PerformanceXP(%.1f) = %d, want %d", rating, got, want)
		}
	}
}

func TestApplyXP(t *testing.T) {
	// Level 1 needs 80, level 2 needs 160: 250 XP -> level 3 with 10 over.
	if l, x, w := ApplyXP(1, 0, engine.RarityGold, 250); l != 3 || x != 10 || w != 0 {
		t.Errorf("got level %d xp %d wasted %d", l, x, w)
	}
	// Bronze caps at 5: anything beyond is reported as wasted, not kept.
	if l, x, w := ApplyXP(4, 300, engine.RarityBronze, 100); l != 5 || x != 0 || w != 80 {
		t.Errorf("cap: got level %d xp %d wasted %d, want 5/0/80", l, x, w)
	}
	if l, x, w := ApplyXP(5, 0, engine.RarityBronze, 40); l != 5 || x != 0 || w != 40 {
		t.Errorf("at cap: got level %d xp %d wasted %d", l, x, w)
	}
}
