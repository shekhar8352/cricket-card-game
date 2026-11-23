package stats

import (
	"math"
	"testing"
	"time"

	"github.com/sudhanshushekhar/cricket-card-game/internal/engine"
)

func card(id, player, name string, role engine.Role) engine.Card {
	return engine.Card{ID: id, PlayerID: player, Name: name, Role: role, Rarity: engine.RaritySilver}
}

var seven = []engine.Card{
	card("c1", "p-bat", "Opener", engine.RoleBAT),
	card("c2", "p-bowl", "Quick", engine.RoleBOWL),
	card("c3", "p-wk", "Gloves", engine.RoleWK),
}

func match(id string, day int, side, winner string, myRuns int, batters []engine.BatterScore, bowlers []engine.BowlerScore, fielders []engine.FielderScore, potm string) Match {
	other := "away"
	if side == "away" {
		other = "home"
	}
	return Match{
		ID: id, Side: side, Opponent: "Bot", VsBot: true, Cards: seven,
		PlayedAt: time.Date(2026, 1, day, 0, 0, 0, 0, time.UTC),
		Result: engine.MatchResult{
			Winner: winner,
			POTM:   potm,
			Innings: [2]engine.InningsResult{
				{BattingSide: side, BowlingSide: other, Runs: myRuns, Wickets: 2, Balls: 30, Batters: batters},
				{BattingSide: other, BowlingSide: side, Runs: 30, Wickets: 3, Balls: 30, Bowlers: bowlers, Fielders: fielders,
					// opposition batters must never count toward the user's stats
					Batters: []engine.BatterScore{{CardID: "opp", Runs: 99, Balls: 10}}},
			},
		},
	}
}

func TestBuild(t *testing.T) {
	out := &engine.Dismissal{Type: engine.DismissBowled}
	ms := []Match{
		// Played out of order on purpose: Build must sort by date.
		match("m2", 2, "away", "home", 25, // loss
			[]engine.BatterScore{{CardID: "c1", Runs: 10, Balls: 8, Dismissal: out}},
			[]engine.BowlerScore{{CardID: "c2", Balls: 12, Runs: 20, Wickets: 1}},
			nil, ""),
		match("m1", 1, "home", "home", 50, // win
			[]engine.BatterScore{{CardID: "c1", Runs: 40, Balls: 20, Fours: 4, Sixes: 2, NotOut: true}, {CardID: "c3", Balls: 0}},
			[]engine.BowlerScore{{CardID: "c2", Balls: 12, Runs: 10, Wickets: 3}},
			[]engine.FielderScore{{CardID: "c3", Catches: 2, Stumpings: 1}}, "c1"),
		match("m3", 3, "home", "home", 41, // win
			[]engine.BatterScore{{CardID: "c1", Runs: 5, Balls: 6, Dismissal: out}},
			nil, nil, "opp"),
	}
	r := Build(ms)
	s := r.Summary

	if s.Played != 3 || s.Won != 2 || s.Lost != 1 || s.Tied != 0 {
		t.Fatalf("record %+v", s)
	}
	if got := s.Form; len(got) != 3 || got[0] != "W" || got[1] != "L" || got[2] != "W" {
		t.Fatalf("form %v, want W L W by date", got)
	}
	if s.CurrentStreak != 1 || s.BestWinStreak != 1 {
		t.Fatalf("streaks cur=%d best=%d", s.CurrentStreak, s.BestWinStreak)
	}
	if s.HighestTotal.Runs != 50 || s.LowestTotal.Runs != 25 || s.TeamRuns != 116 {
		t.Fatalf("totals hi=%d lo=%d team=%d", s.HighestTotal.Runs, s.LowestTotal.Runs, s.TeamRuns)
	}

	if len(r.Batting) != 1 {
		t.Fatalf("only the opener batted; got %d batters (opposition or DNB leaked)", len(r.Batting))
	}
	b := r.Batting[0]
	if b.Runs != 55 || b.Innings != 3 || b.Outs != 2 || b.High != 40 || !b.HighNotOut || b.Matches != 3 {
		t.Fatalf("batter %+v", b)
	}
	if b.Average != 27.5 || b.StrikeRate != 161.76 {
		t.Fatalf("avg=%v sr=%v", b.Average, b.StrikeRate)
	}

	bw := r.Bowling[0]
	if bw.Wickets != 4 || bw.Balls != 24 || bw.Runs != 30 || bw.BestW != 3 || bw.BestR != 10 || bw.Economy != 7.5 || bw.Average != 7.5 {
		t.Fatalf("bowler %+v", bw)
	}
	if f := r.Fielding[0]; f.Name != "Gloves" || f.Total != 3 {
		t.Fatalf("fielder %+v", f)
	}
	// Opener's ratings: m1 40* (20) win+POTM, m2 10 (8) out in a loss, m3 5 (6) out in a win.
	want := []float64{
		engine.PlayerRatings(ms[1].Result)["c1"],
		engine.PlayerRatings(ms[0].Result)["c1"],
		engine.PlayerRatings(ms[2].Result)["c1"],
	}
	avg := math.Round((want[0]+want[1]+want[2])/3*10) / 10
	if b.AvgRating != avg {
		t.Errorf("opener avg rating %v, want %v", b.AvgRating, avg)
	}
	if len(r.Rated) != 3 || r.Rated[0].AvgRating < r.Rated[2].AvgRating {
		t.Errorf("rated list should hold all 3 players, best first: %+v", r.Rated)
	}
	if len(r.Awards) != 1 || r.Awards[0].Awards != 1 || r.Awards[0].Name != "Opener" {
		t.Fatalf("awards %+v (opponent POTM must not count)", r.Awards)
	}
}

func TestBuildEmpty(t *testing.T) {
	r := Build(nil)
	if r.Summary.Played != 0 || r.Batting == nil || r.Summary.Form == nil {
		t.Fatalf("empty report should have zero values and non-nil slices: %+v", r)
	}
}
