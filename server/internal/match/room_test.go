package match

import (
	"strings"
	"testing"
	"time"

	"github.com/sudhanshushekhar/cricket-card-game/internal/store"
)

func TestRoomCode(t *testing.T) {
	seen := map[string]bool{}
	for range 500 {
		c, err := newRoomCode()
		if err != nil {
			t.Fatal(err)
		}
		if len(c) != RoomCodeLen {
			t.Fatalf("code %q has length %d", c, len(c))
		}
		for _, r := range c {
			if !strings.ContainsRune(roomAlphabet, r) {
				t.Fatalf("code %q uses %q", c, r)
			}
		}
		seen[c] = true
	}
	if len(seen) < 495 {
		t.Fatalf("only %d distinct codes in 500", len(seen))
	}
}

func TestNormalizeRoomCode(t *testing.T) {
	if got := NormalizeRoomCode(" ab3-k9x "); got != "AB3K9X" {
		t.Fatalf("got %q", got)
	}
}

func TestRoomExpired(t *testing.T) {
	now := time.Now()
	open := store.MatchRow{Status: StatusWaitingRoom, CreatedAt: now.Add(-RoomTTL + time.Minute)}
	old := store.MatchRow{Status: StatusWaitingRoom, CreatedAt: now.Add(-RoomTTL - time.Minute)}
	joined := store.MatchRow{Status: StatusLineup, CreatedAt: now.Add(-2 * RoomTTL)}
	if RoomExpired(open, now) || !RoomExpired(old, now) || RoomExpired(joined, now) {
		t.Fatal("wrong expiry")
	}
}
