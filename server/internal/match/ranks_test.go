package match

import (
	"testing"
	"time"

	"github.com/sudhanshushekhar/cricket-card-game/internal/store"
	"github.com/sudhanshushekhar/cricket-card-game/internal/trophy"
)

var rankOf = trophy.RankOf

func TestHistoryPeakFloorsAtZero(t *testing.T) {
	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	h := []store.TrophyPoint{{Delta: 10, At: base}, {Delta: -30, At: base.Add(time.Hour)}, {Delta: 35, At: base.Add(2 * time.Hour)}, {Delta: -20, At: base.Add(3 * time.Hour)}}
	// 10 -> 0 (floored, not -20) -> 35 -> 15: peak 35 at the third match.
	peak, at := HistoryPeak(h)
	if peak != 35 || at == nil || !at.Equal(base.Add(2*time.Hour)) {
		t.Fatalf("peak %d at %v", peak, at)
	}
	if p, at := HistoryPeak(nil); p != 0 || at != nil {
		t.Fatal("no history, no peak")
	}
}

func TestRankMove(t *testing.T) {
	cases := []struct {
		arena     string
		from, to  int
		heldAfter string
		want      string
	}{
		{"Silver", 790, 821, "Gold", "up"},
		{"Gold", 760, 729, "Gold", "protected"},
		{"Gold", 715, 686, "Silver", "down"},
		{"Gold", 940, 925, "Gold", "down"}, // Gold II -> Gold III
		{"Gold", 820, 850, "Gold", ""},
	}
	for _, c := range cases {
		before := rankOf(c.arena, c.from)
		after := rankOf(c.heldAfter, c.to)
		if got := rankMove(before, after); got != c.want {
			t.Errorf("%s %d -> %d: %q, want %q", c.arena, c.from, c.to, got, c.want)
		}
	}
}
