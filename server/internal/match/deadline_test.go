package match

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/sudhanshushekhar/cricket-card-game/internal/store"
)

func TestLineupDeadline(t *testing.T) {
	me, them := uuid.New(), uuid.New()
	locked := time.Now().Add(-time.Minute)
	pvp := store.MatchRow{Status: StatusLineup, HomeUserID: me, AwayUserID: &them}
	lu := func(id uuid.UUID, at *time.Time) store.LineupRow { return store.LineupRow{UserID: id.String(), LockedAt: at} }

	// The reported bug: a bot match must never auto-lock the player.
	bot := store.MatchRow{Status: StatusLineup, HomeUserID: me, IsBot: true}
	if d := LineupDeadline(bot, []store.LineupRow{lu(uuid.New(), &locked)}, me); d != nil {
		t.Fatal("bot matches must have no lineup deadline")
	}
	if d := LineupDeadline(pvp, nil, me); d != nil {
		t.Fatal("no deadline while the opponent hasn't locked in")
	}
	if d := LineupDeadline(pvp, []store.LineupRow{lu(them, nil)}, me); d != nil {
		t.Fatal("no deadline while the opponent is still choosing")
	}
	d := LineupDeadline(pvp, []store.LineupRow{lu(them, &locked)}, me)
	if d == nil || !d.Equal(locked.Add(LineupGrace)) {
		t.Fatalf("deadline should be opponent lock + grace, got %v", d)
	}
	if d := LineupDeadline(pvp, []store.LineupRow{lu(them, &locked), lu(me, &locked)}, me); d != nil {
		t.Fatal("no deadline once I have locked in")
	}
	if d := LineupDeadline(pvp, []store.LineupRow{lu(them, &locked)}, them); d != nil {
		t.Fatal("the side that locked has no deadline")
	}
	done := pvp
	done.Status = StatusComplete
	if d := LineupDeadline(done, []store.LineupRow{lu(them, &locked)}, me); d != nil {
		t.Fatal("no deadline after the lineup phase")
	}
}
