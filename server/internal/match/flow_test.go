package match

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/sudhanshushekhar/cricket-card-game/internal/engine"
	"github.com/sudhanshushekhar/cricket-card-game/internal/store"
)

func TestPauseDeadline(t *testing.T) {
	me, them := uuid.New(), uuid.New()
	started := time.Now().Add(-10 * time.Second)
	m := store.MatchRow{Status: StatusBreak, HomeUserID: me, AwayUserID: &them, BreakStartedAt: &started}
	rows := []store.LineupRow{{UserID: me.String()}, {UserID: them.String()}}
	if d := PauseDeadline(m, rows, me); d == nil || !d.Equal(started.Add(BreakGrace)) {
		t.Fatalf("break deadline should be start + grace, got %v", d)
	}
	done := time.Now()
	rows[0].BreakLocked = &done
	if PauseDeadline(m, rows, me) != nil {
		t.Fatal("no deadline once you've made your call")
	}
	bot := m
	bot.IsBot, bot.AwayUserID = true, nil
	if PauseDeadline(bot, []store.LineupRow{{UserID: me.String()}}, me) != nil {
		t.Fatal("bot matches never time out at the break")
	}
	so := store.MatchRow{Status: StatusSuperOver, HomeUserID: me, AwayUserID: &them, SuperStartedAt: &started}
	if d := PauseDeadline(so, []store.LineupRow{{UserID: me.String()}}, me); d == nil || !d.Equal(started.Add(SuperOverGrace)) {
		t.Fatalf("super over deadline should be start + grace, got %v", d)
	}
}

func TestCaptainReadsAndRivalries(t *testing.T) {
	res := engine.MatchResult{Innings: [2]engine.InningsResult{
		{BattingSide: "home", BowlingSide: "away", Calls: []engine.OverCall{{BatRead: true}, {FieldRead: true}, {BatRead: true, FieldRead: true}}},
		{BattingSide: "away", BowlingSide: "home", Calls: []engine.OverCall{{FieldRead: true}}},
	}}
	if got := captainReads(res, "home"); got != 3 {
		t.Errorf("home reads = %d, want 3 (2 batting + 1 fielding)", got)
	}
	if got := captainReads(res, "away"); got != 2 {
		t.Errorf("away reads = %d, want 2", got)
	}

	home := engine.Lineup{Cards: []engine.Card{{ID: "h1", PlayerID: "bat-p"}}}
	away := engine.Lineup{Cards: []engine.Card{{ID: "a1", PlayerID: "bowl-p"}}}
	res.Balls = []engine.BallEvent{
		{Innings: 0, BowlerID: "a1", StrikerID: "h1", Legal: true, Runs: 4, Outcome: engine.OutcomeFour},
		{Innings: 0, BowlerID: "a1", StrikerID: "h1", Legal: false, Runs: 1, Outcome: engine.OutcomeWide},
		{Innings: 0, BowlerID: "a1", StrikerID: "h1", Legal: true, Outcome: engine.OutcomeWicket, Dismissal: &engine.Dismissal{Type: engine.DismissBowled}},
		{Innings: 2, BowlerID: "a1", StrikerID: "h1", Legal: true, Runs: 6, Outcome: engine.OutcomeSix}, // super over: ignored
	}
	ds := rivalryDeltas(res, home, away)
	if len(ds) != 1 {
		t.Fatalf("want one matchup, got %+v", ds)
	}
	d := ds[0]
	if d.Bowler != "bowl-p" || d.Batter != "bat-p" || d.Balls != 2 || d.Runs != 4 || d.Dismissals != 1 {
		t.Errorf("tally %+v, want 2 balls, 4 runs, 1 dismissal", d)
	}
}
