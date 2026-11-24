package tournament

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/google/uuid"
	"github.com/sudhanshushekhar/cricket-card-game/internal/engine"
	"github.com/sudhanshushekhar/cricket-card-game/internal/store"
)

func ids(n int) []uuid.UUID {
	out := make([]uuid.UUID, n)
	for i := range out {
		out[i] = uuid.New()
	}
	return out
}

func players(us []uuid.UUID) []store.TournamentPlayer {
	out := make([]store.TournamentPlayer, len(us))
	for i, u := range us {
		out[i] = store.TournamentPlayer{UserID: u, Username: fmt.Sprintf("p%d", i)}
	}
	return out
}

func TestFormatFor(t *testing.T) {
	for n, want := range map[int]string{3: FormatFinal, 4: FormatFinal, 5: FormatFinal, 6: FormatPlayoffs, 10: FormatPlayoffs} {
		if got := FormatFor(n); got != want {
			t.Errorf("%d players: got %s, want %s", n, got, want)
		}
	}
}

func TestRoundRobin(t *testing.T) {
	for n := MinPlayers; n <= MaxPlayers; n++ {
		us := ids(n)
		fs := RoundRobin(us)
		if len(fs) != n*(n-1)/2 {
			t.Fatalf("%d players: %d fixtures, want %d", n, len(fs), n*(n-1)/2)
		}
		pairs := map[[2]uuid.UUID]bool{}
		home := map[uuid.UUID]int{}
		perRound := map[int]map[uuid.UUID]bool{}
		for _, f := range fs {
			if f.Home == f.Away {
				t.Fatal("a player can't play themselves")
			}
			k := [2]uuid.UUID{f.Home, f.Away}
			if f.Away.String() < f.Home.String() {
				k = [2]uuid.UUID{f.Away, f.Home}
			}
			if pairs[k] {
				t.Fatalf("%d players: pair repeated", n)
			}
			pairs[k] = true
			home[f.Home]++
			if perRound[f.Round] == nil {
				perRound[f.Round] = map[uuid.UUID]bool{}
			}
			for _, u := range []uuid.UUID{f.Home, f.Away} {
				if perRound[f.Round][u] {
					t.Fatalf("%d players: someone plays twice in round %d", n, f.Round)
				}
				perRound[f.Round][u] = true
			}
		}
		lo, hi := n, 0
		for _, u := range us {
			lo, hi = min(lo, home[u]), max(hi, home[u])
		}
		if hi-lo > 1 {
			t.Errorf("%d players: home games range %d..%d", n, lo, hi)
		}
	}
}

// played builds a finished match where the home side scores hr/hw off hb balls
// batting first and the away side replies with ar/aw off ab.
func played(stage string, home, away uuid.UUID, hr, hw, hb, ar, aw, ab int) store.MatchRow {
	res := engine.MatchResult{Winner: "tie"}
	res.Innings[0] = engine.InningsResult{BattingSide: "home", BowlingSide: "away", Runs: hr, Wickets: hw, Balls: hb, Declared: hw >= engine.MaxWickets}
	res.Innings[1] = engine.InningsResult{BattingSide: "away", BowlingSide: "home", Runs: ar, Wickets: aw, Balls: ab, Declared: aw >= engine.MaxWickets}
	m := store.MatchRow{ID: uuid.New(), Status: "COMPLETE", HomeUserID: home, AwayUserID: &away, Stage: &stage}
	switch {
	case hr > ar:
		res.Winner = "home"
		m.WinnerUserID = &m.HomeUserID
	case ar > hr:
		res.Winner = "away"
		m.WinnerUserID = m.AwayUserID
	}
	m.Result, _ = json.Marshal(res)
	return m
}

func TestStandingsPointsAndNRR(t *testing.T) {
	u := ids(3)
	ms := []store.MatchRow{
		played(StageLeague, u[0], u[1], 60, 2, 30, 40, 6, 24), // u0 wins; u1 bowled out, charged 5 overs
		played(StageLeague, u[1], u[2], 50, 3, 30, 51, 2, 27), // u2 chases
		played(StageLeague, u[2], u[0], 45, 4, 30, 45, 5, 30), // tie
	}
	tab := Standings(players(u), ms)
	// u0 and u2 are level on 3 points; u0's 20-run win gives the better net run rate.
	if tab[0].UserID != u[0] || tab[0].Points != 3 || tab[0].NRR != 2 {
		t.Fatalf("u0 should top on NRR: %+v", tab)
	}
	if tab[1].UserID != u[2] || tab[1].Points != 3 || tab[1].NRR >= tab[0].NRR {
		t.Fatalf("u2 has 3 points but a lower NRR: %+v", tab)
	}
	if tab[2].UserID != u[1] || tab[2].Points != 0 || tab[2].Lost != 2 {
		t.Fatalf("u1 lost both: %+v", tab)
	}
	// u1 faced 30 (bowled out, charged the full quota) + 30 balls.
	if tab[2].BallsFaced != 60 {
		t.Fatalf("a side bowled out is charged its full overs: faced %d", tab[2].BallsFaced)
	}
	for i, r := range tab {
		if r.Position != i+1 {
			t.Fatal("positions should follow the order")
		}
	}
}

// league plays every fixture with the lower-indexed player winning, so the
// table ends up in index order.
func league(us []uuid.UUID) []store.MatchRow {
	idx := map[uuid.UUID]int{}
	for i, u := range us {
		idx[u] = i
	}
	var ms []store.MatchRow
	for _, f := range RoundRobin(us) {
		if idx[f.Home] < idx[f.Away] {
			ms = append(ms, played(StageLeague, f.Home, f.Away, 60, 2, 30, 40, 4, 30))
		} else {
			ms = append(ms, played(StageLeague, f.Home, f.Away, 40, 4, 30, 41, 2, 28))
		}
	}
	return ms
}

func TestFinalFormat(t *testing.T) {
	u := ids(4)
	ms := league(u)
	ms[0].Status = "LINEUP_PENDING"
	if NextFixtures(FormatFinal, Standings(players(u), ms), ms) != nil {
		t.Fatal("no final until the league is over")
	}
	ms[0].Status = "COMPLETE"
	tab := Standings(players(u), ms)
	next := NextFixtures(FormatFinal, tab, ms)
	if len(next) != 1 || next[0].Stage != StageFinal || next[0].Home != u[0] || next[0].Away != u[1] {
		t.Fatalf("final should be 1st v 2nd: %+v", next)
	}
	// The runner-up wins the final.
	ms = append(ms, played(StageFinal, u[0], u[1], 40, 6, 30, 41, 1, 20))
	if len(NextFixtures(FormatFinal, tab, ms)) != 0 || !FinalDone(ms) {
		t.Fatal("nothing after the final")
	}
	pl := Placings(FormatFinal, tab, ms)
	if pl[0] != u[1] || pl[1] != u[0] || pl[2] != u[2] || pl[3] != u[3] {
		t.Fatal("champion, runner-up, then league order")
	}
}

func TestPlayoffs(t *testing.T) {
	u := ids(6)
	ms := league(u)
	tab := Standings(players(u), ms)
	next := NextFixtures(FormatPlayoffs, tab, ms)
	if len(next) != 2 || next[0].Stage != StageQualifier1 || next[1].Stage != StageEliminator {
		t.Fatalf("Q1 and the Eliminator come first: %+v", next)
	}
	if next[0].Home != u[0] || next[0].Away != u[1] || next[1].Home != u[2] || next[1].Away != u[3] {
		t.Fatal("Q1 is 1v2, Eliminator 3v4")
	}
	// Q1: 2nd beats 1st. Eliminator: tied even after the Super Over, so 3rd goes through on the table.
	q1 := played(StageQualifier1, u[0], u[1], 40, 6, 30, 41, 1, 20)
	el := played(StageEliminator, u[2], u[3], 50, 3, 30, 50, 4, 30)
	ms = append(ms, q1)
	if got := NextFixtures(FormatPlayoffs, tab, ms); len(got) != 1 || got[0].Stage != StageEliminator {
		t.Fatalf("Q2 waits for the Eliminator: %+v", got)
	}
	ms = append(ms, el)
	next = NextFixtures(FormatPlayoffs, tab, ms)
	if len(next) != 1 || next[0].Stage != StageQualifier2 || next[0].Home != u[0] || next[0].Away != u[2] {
		t.Fatalf("Q2 is the Q1 loser v the Eliminator winner: %+v", next)
	}
	if _, _, onTable := Winner(el, tab); !onTable {
		t.Fatal("a tied knockout goes to the higher-placed side")
	}
	// Q2: the Eliminator winner knocks out the league leader.
	ms = append(ms, played(StageQualifier2, u[0], u[2], 30, 6, 25, 31, 3, 22))
	next = NextFixtures(FormatPlayoffs, tab, ms)
	if len(next) != 1 || next[0].Stage != StageFinal || next[0].Home != u[1] || next[0].Away != u[2] {
		t.Fatalf("final is the Q1 winner v the Q2 winner: %+v", next)
	}
	ms = append(ms, played(StageFinal, u[1], u[2], 70, 1, 30, 50, 6, 29))
	pl := Placings(FormatPlayoffs, tab, ms)
	want := []uuid.UUID{u[1], u[2], u[0], u[3], u[4], u[5]}
	for i := range want {
		if pl[i] != want[i] {
			t.Fatalf("placing %d wrong", i+1)
		}
	}
}

func TestAwards(t *testing.T) {
	u := ids(2)
	card := func(id, name string, role engine.Role) engine.Card {
		return engine.Card{ID: id, Name: name, PlayerID: "p-" + id, Role: role, Rarity: engine.Rarity("RARE")}
	}
	a := []engine.Card{card("a-bat", "Ace Bat", engine.RoleBAT), card("a-bowl", "Ace Bowl", engine.RoleBOWL)}
	b := []engine.Card{card("b-bat", "Bee Bat", engine.RoleBAT), card("b-bowl", "Bee Bowl", engine.RoleBOWL)}

	m := played(StageFinal, u[0], u[1], 70, 2, 30, 50, 6, 29)
	var res engine.MatchResult
	_ = json.Unmarshal(m.Result, &res)
	res.Innings[0].Batters = []engine.BatterScore{{CardID: "a-bat", Runs: 52, Balls: 20, Fours: 4, Sixes: 3, NotOut: true}}
	res.Innings[0].Bowlers = []engine.BowlerScore{{CardID: "b-bowl", Balls: 30, Runs: 70, Wickets: 2}}
	res.Innings[1].Batters = []engine.BatterScore{{CardID: "b-bat", Runs: 30, Balls: 16, Fours: 2, Sixes: 1, Dismissal: &engine.Dismissal{}}}
	res.Innings[1].Bowlers = []engine.BowlerScore{{CardID: "a-bowl", Balls: 29, Runs: 50, Wickets: 4}}
	res.Innings[1].Fielders = []engine.FielderScore{{CardID: "a-bat", Catches: 2}}
	res.POTM = "a-bat"
	res.Balls = []engine.BallEvent{{Innings: 1, BowlerID: "a-bowl", Legal: true}, {Innings: 1, BowlerID: "a-bowl", Legal: true, Runs: 4}}
	m.Result, _ = json.Marshal(res)

	snap := func(cs []engine.Card) []byte { b, _ := json.Marshal(cs); return b }
	lus := []store.TournamentLineup{
		{MatchID: m.ID, UserID: u[0].String(), Snapshot: snap(a)},
		{MatchID: m.ID, UserID: u[1].String(), Snapshot: snap(b)},
	}
	h := ComputeHonours(FormatFinal, players(u), []store.MatchRow{m}, lus)
	if h.Champion != u[0] || h.RunnerUp != u[1] {
		t.Fatal("u0 won the final")
	}
	got := map[string]Award{}
	for _, a := range h.Awards {
		got[a.Code] = a
	}
	check := func(code, card, value string) {
		t.Helper()
		a, ok := got[code]
		if !ok {
			t.Fatalf("missing award %s", code)
		}
		if a.CardID != card || (value != "" && a.Value != value) {
			t.Fatalf("%s: got %s %q", code, a.CardID, a.Value)
		}
	}
	check("orange_cap", "a-bat", "52 runs")
	check("purple_cap", "a-bowl", "4 wickets")
	check("highest_score", "a-bat", "52* (20)")
	check("best_bowling", "a-bowl", "4/50")
	check("most_sixes", "a-bat", "3 sixes")
	check("super_striker", "a-bat", "")
	check("best_fielder", "a-bat", "2 dismissals")
	check("most_dots", "a-bowl", "1 dot ball")
	check("most_potm", "a-bat", "1 award")
	if got["highest_total"].UserID != u[0] || got["highest_total"].Value != "70/2" {
		t.Fatalf("highest total: %+v", got["highest_total"])
	}
	if got["best_economy"].CardID != "a-bowl" {
		t.Fatal("best economy: 50 off 29 beats 70 off 30")
	}
}
