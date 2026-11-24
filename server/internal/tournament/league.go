// Package tournament runs multi-player tournaments: a round-robin league where
// every pair of players meets once, then a final between the top two (up to 5
// players) or IPL-style playoffs for the top four (6 or more players), and
// finally the individual awards.
package tournament

import (
	"encoding/json"
	"math"
	"sort"

	"github.com/google/uuid"
	"github.com/sudhanshushekhar/cricket-card-game/internal/engine"
	"github.com/sudhanshushekhar/cricket-card-game/internal/store"
)

const (
	MinPlayers = 3
	MaxPlayers = 10
	// PlayoffsFrom is the smallest field that gets IPL-style playoffs; smaller
	// fields go straight to a final between the top two.
	PlayoffsFrom = 6

	FormatFinal    = "final"
	FormatPlayoffs = "playoffs"

	StageLeague     = "league"
	StageQualifier1 = "qualifier1"
	StageEliminator = "eliminator"
	StageQualifier2 = "qualifier2"
	StageFinal      = "final"

	PointsWin = 2
	PointsTie = 1

	StatusLobby     = "LOBBY"
	StatusLeague    = "LEAGUE"
	StatusPlayoffs  = "PLAYOFFS"
	StatusComplete  = "COMPLETE"
	StatusCancelled = "CANCELLED"
)

// FormatFor picks the knockout format for a field of n players.
func FormatFor(n int) string {
	if n >= PlayoffsFrom {
		return FormatPlayoffs
	}
	return FormatFinal
}

// Qualifiers is how many league places go through to the knockouts.
func Qualifiers(format string) int {
	if format == FormatPlayoffs {
		return 4
	}
	return 2
}

// Fixture is one scheduled match.
type Fixture struct {
	Round int
	Stage string
	Home  uuid.UUID
	Away  uuid.UUID
}

// RoundRobin pairs every player with every other exactly once, in rounds (the
// circle method). Home goes to whoever has hosted fewer so far, so it evens out.
func RoundRobin(ids []uuid.UUID) []Fixture {
	ps := append([]*uuid.UUID(nil), ptrs(ids)...)
	if len(ps)%2 == 1 {
		ps = append(ps, nil) // a bye
	}
	n := len(ps)
	var out []Fixture
	hosted := map[uuid.UUID]int{}
	for r := 0; r < n-1; r++ {
		for i := 0; i < n/2; i++ {
			a, b := ps[i], ps[n-1-i]
			if a == nil || b == nil {
				continue
			}
			if hosted[*b] < hosted[*a] || (hosted[*b] == hosted[*a] && (r+i)%2 == 1) {
				a, b = b, a
			}
			hosted[*a]++
			out = append(out, Fixture{Round: r + 1, Stage: StageLeague, Home: *a, Away: *b})
		}
		// Keep the first player fixed and rotate the rest one place.
		last := ps[n-1]
		copy(ps[2:], ps[1:n-1])
		ps[1] = last
	}
	return out
}

func ptrs(ids []uuid.UUID) []*uuid.UUID {
	out := make([]*uuid.UUID, len(ids))
	for i := range ids {
		out[i] = &ids[i]
	}
	return out
}

// Row is one line of the points table.
type Row struct {
	UserID      uuid.UUID `json:"userId"`
	Username    string    `json:"username"`
	Played      int       `json:"played"`
	Won         int       `json:"won"`
	Lost        int       `json:"lost"`
	Tied        int       `json:"tied"`
	Points      int       `json:"points"`
	RunsFor     int       `json:"runsFor"`
	BallsFaced  int       `json:"ballsFaced"`
	RunsAgainst int       `json:"runsAgainst"`
	BallsBowled int       `json:"ballsBowled"`
	NRR         float64   `json:"nrr"`
	Position    int       `json:"position"`
}

// Result reads the engine result stored on a finished match.
func Result(m store.MatchRow) (engine.MatchResult, bool) {
	var res engine.MatchResult
	if m.Status != "COMPLETE" || len(m.Result) == 0 || json.Unmarshal(m.Result, &res) != nil {
		return res, false
	}
	return res, true
}

func stageOf(m store.MatchRow) string {
	if m.Stage == nil {
		return ""
	}
	return *m.Stage
}

func sideUser(m store.MatchRow, side string) uuid.UUID {
	if side == "away" && m.AwayUserID != nil {
		return *m.AwayUserID
	}
	return m.HomeUserID
}

// ballsForNRR is the balls an innings counts for net run rate: a side bowled
// out is charged its full quota of overs, as in the IPL.
func ballsForNRR(inn engine.InningsResult) int {
	if inn.Declared || inn.Wickets >= engine.MaxWickets {
		return engine.OversPerInnings * 6
	}
	return inn.Balls
}

// Standings builds the league table from completed league matches. Ties on
// points are broken by net run rate, then wins, then name.
func Standings(players []store.TournamentPlayer, matches []store.MatchRow) []Row {
	rows := map[uuid.UUID]*Row{}
	order := make([]*Row, 0, len(players))
	for _, p := range players {
		r := &Row{UserID: p.UserID, Username: p.Username}
		rows[p.UserID] = r
		order = append(order, r)
	}
	for _, m := range matches {
		if stageOf(m) != StageLeague {
			continue
		}
		res, ok := Result(m)
		if !ok || m.AwayUserID == nil {
			continue
		}
		home, away := rows[m.HomeUserID], rows[*m.AwayUserID]
		if home == nil || away == nil {
			continue
		}
		home.Played++
		away.Played++
		switch res.Winner {
		case "home":
			home.Won++
			away.Lost++
			home.Points += PointsWin
		case "away":
			away.Won++
			home.Lost++
			away.Points += PointsWin
		default:
			home.Tied++
			away.Tied++
			home.Points += PointsTie
			away.Points += PointsTie
		}
		// A Super Over decides the winner (res.Winner) but only the main
		// innings count towards net run rate.
		for _, inn := range res.Innings {
			bat, bowl := rows[sideUser(m, inn.BattingSide)], rows[sideUser(m, inn.BowlingSide)]
			b := ballsForNRR(inn)
			bat.RunsFor += inn.Runs
			bat.BallsFaced += b
			bowl.RunsAgainst += inn.Runs
			bowl.BallsBowled += b
		}
	}
	for _, r := range order {
		var f, a float64
		if r.BallsFaced > 0 {
			f = float64(r.RunsFor) / (float64(r.BallsFaced) / 6)
		}
		if r.BallsBowled > 0 {
			a = float64(r.RunsAgainst) / (float64(r.BallsBowled) / 6)
		}
		r.NRR = math.Round((f-a)*1000) / 1000
	}
	sort.SliceStable(order, func(i, j int) bool {
		a, b := order[i], order[j]
		if a.Points != b.Points {
			return a.Points > b.Points
		}
		if a.NRR != b.NRR {
			return a.NRR > b.NRR
		}
		if a.Won != b.Won {
			return a.Won > b.Won
		}
		return a.Username < b.Username
	})
	out := make([]Row, len(order))
	for i, r := range order {
		r.Position = i + 1
		out[i] = *r
	}
	return out
}

// LeagueDone reports whether every league match has been played.
func LeagueDone(matches []store.MatchRow) bool {
	n := 0
	for _, m := range matches {
		if stageOf(m) == StageLeague {
			n++
			if m.Status != "COMPLETE" {
				return false
			}
		}
	}
	return n > 0
}

func position(table []Row, id uuid.UUID) int {
	for _, r := range table {
		if r.UserID == id {
			return r.Position
		}
	}
	return math.MaxInt
}

// Winner of a finished knockout match. A Super Over settles most ties; if the
// match is still level, the side placed higher in the league goes through.
func Winner(m store.MatchRow, table []Row) (winner, loser uuid.UUID, onTable bool) {
	away := *m.AwayUserID
	switch {
	case m.WinnerUserID != nil && *m.WinnerUserID == m.HomeUserID:
		return m.HomeUserID, away, false
	case m.WinnerUserID != nil && *m.WinnerUserID == away:
		return away, m.HomeUserID, false
	}
	if position(table, away) < position(table, m.HomeUserID) {
		return away, m.HomeUserID, true
	}
	return m.HomeUserID, away, true
}

// Knockouts indexes the knockout matches by stage.
func Knockouts(matches []store.MatchRow) map[string]store.MatchRow {
	out := map[string]store.MatchRow{}
	for _, m := range matches {
		if s := stageOf(m); s != "" && s != StageLeague {
			out[s] = m
		}
	}
	return out
}

// NextFixtures returns the knockout matches that are now ready to be scheduled
// and don't exist yet. The higher seed is at home.
//
// Final format:    1st v 2nd in the final.
// Playoffs format: Qualifier 1 (1st v 2nd) and the Eliminator (3rd v 4th);
// Qualifier 2 (loser of Q1 v winner of the Eliminator); the final (winner of
// Q1 v winner of Q2).
func NextFixtures(format string, table []Row, matches []store.MatchRow) []Fixture {
	if !LeagueDone(matches) || len(table) < Qualifiers(format) {
		return nil
	}
	ko := Knockouts(matches)
	done := func(stage string) bool { m, ok := ko[stage]; return ok && m.Status == "COMPLETE" }
	var out []Fixture
	add := func(stage string, home, away uuid.UUID) {
		if _, ok := ko[stage]; !ok {
			out = append(out, Fixture{Stage: stage, Home: home, Away: away})
		}
	}
	if format == FormatFinal {
		add(StageFinal, table[0].UserID, table[1].UserID)
		return out
	}
	add(StageQualifier1, table[0].UserID, table[1].UserID)
	add(StageEliminator, table[2].UserID, table[3].UserID)
	if done(StageQualifier1) && done(StageEliminator) {
		_, q1Loser, _ := Winner(ko[StageQualifier1], table)
		eWinner, _, _ := Winner(ko[StageEliminator], table)
		add(StageQualifier2, q1Loser, eWinner)
	}
	if done(StageQualifier1) && done(StageQualifier2) {
		q1Winner, _, _ := Winner(ko[StageQualifier1], table)
		q2Winner, _, _ := Winner(ko[StageQualifier2], table)
		add(StageFinal, q1Winner, q2Winner)
	}
	return out
}

// FinalDone reports whether the final has been played.
func FinalDone(matches []store.MatchRow) bool {
	m, ok := Knockouts(matches)[StageFinal]
	return ok && m.Status == "COMPLETE"
}

// Placings is the finishing order once the tournament is over: champion,
// runner-up, then the playoff losers by how far they got, then everyone else
// in league order.
func Placings(format string, table []Row, matches []store.MatchRow) []uuid.UUID {
	ko := Knockouts(matches)
	var out []uuid.UUID
	seen := map[uuid.UUID]bool{}
	push := func(id uuid.UUID) {
		if !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	if f, ok := ko[StageFinal]; ok && f.Status == "COMPLETE" {
		w, l, _ := Winner(f, table)
		push(w)
		push(l)
	}
	if format == FormatPlayoffs {
		for _, st := range []string{StageQualifier2, StageEliminator} {
			if m, ok := ko[st]; ok && m.Status == "COMPLETE" {
				_, l, _ := Winner(m, table)
				push(l)
			}
		}
	}
	for _, r := range table {
		push(r.UserID)
	}
	return out
}
