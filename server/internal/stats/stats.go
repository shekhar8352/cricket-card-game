// Package stats aggregates a player's completed matches into career numbers:
// win/loss record, team bests, and leaderboards for the cards they fielded.
package stats

import (
	"math"
	"sort"
	"time"

	"github.com/sudhanshushekhar/cricket-card-game/internal/engine"
)

// Match is one completed match seen from the viewing user's side.
type Match struct {
	ID          string
	Side        string // "home" or "away": which side the user played
	Opponent    string
	VsBot       bool
	Result      engine.MatchResult
	Cards       []engine.Card // the user's lineup snapshot
	TrophyDelta int
	PlayedAt    time.Time
}

type TeamScore struct {
	MatchID  string    `json:"matchId"`
	Runs     int       `json:"runs"`
	Wickets  int       `json:"wickets"`
	Balls    int       `json:"balls"`
	Opponent string    `json:"opponent"`
	PlayedAt time.Time `json:"playedAt"`
}

type Summary struct {
	Played        int        `json:"played"`
	Won           int        `json:"won"`
	Lost          int        `json:"lost"`
	Tied          int        `json:"tied"`
	WinRate       float64    `json:"winRate"`
	CurrentStreak int        `json:"currentStreak"` // >0 wins in a row, <0 losses in a row
	BestWinStreak int        `json:"bestWinStreak"`
	VsBots        int        `json:"vsBots"`
	VsPlayers     int        `json:"vsPlayers"`
	TrophiesWon   int        `json:"trophiesWon"`
	TrophiesLost  int        `json:"trophiesLost"`
	TeamRuns      int        `json:"teamRuns"`
	WicketsTaken  int        `json:"wicketsTaken"`
	Fours         int        `json:"fours"`
	Sixes         int        `json:"sixes"`
	HighestTotal  *TeamScore `json:"highestTotal,omitempty"`
	LowestTotal   *TeamScore `json:"lowestTotal,omitempty"`
	BestDefence   *TeamScore `json:"bestBowlingEffort,omitempty"` // fewest runs conceded by the user's bowlers
	Form          []string   `json:"form"`                        // most recent last: "W", "L", "T"
}

type Player struct {
	PlayerID  string  `json:"playerId"`
	Name      string  `json:"name"`
	Country   string  `json:"country"`
	Role      string  `json:"role"`
	Rarity    string  `json:"rarity"`
	Matches   int     `json:"matches"`
	AvgRating float64 `json:"avgRating"` // average match rating across appearances
}

type Batter struct {
	Player
	Innings    int     `json:"innings"`
	Runs       int     `json:"runs"`
	Balls      int     `json:"balls"`
	Fours      int     `json:"fours"`
	Sixes      int     `json:"sixes"`
	Outs       int     `json:"outs"`
	High       int     `json:"highScore"`
	HighNotOut bool    `json:"highNotOut"`
	Average    float64 `json:"average"` // runs per dismissal; equals runs when never out
	StrikeRate float64 `json:"strikeRate"`
}

type Bowler struct {
	Player
	Innings int     `json:"innings"`
	Balls   int     `json:"balls"`
	Runs    int     `json:"runs"`
	Wickets int     `json:"wickets"`
	BestW   int     `json:"bestWickets"`
	BestR   int     `json:"bestRuns"`
	Economy float64 `json:"economy"`
	Average float64 `json:"average"` // runs per wicket; 0 when wicketless
}

type Fielder struct {
	Player
	Catches   int `json:"catches"`
	Stumpings int `json:"stumpings"`
	RunOuts   int `json:"runOuts"`
	Total     int `json:"total"`
}

type Award struct {
	Player
	Awards int `json:"awards"`
}

// Rated is a player's match-rating record.
type Rated struct {
	Player
	Best float64 `json:"bestRating"`
}

type Report struct {
	Summary  Summary   `json:"summary"`
	Rated    []Rated   `json:"rated"`
	Batting  []Batter  `json:"batting"`
	Bowling  []Bowler  `json:"bowling"`
	Fielding []Fielder `json:"fielding"`
	Awards   []Award   `json:"playerOfMatch"`
}

// Limit caps each leaderboard so the payload stays small.
const Limit = 10

// Build aggregates matches. Order does not matter; it sorts by PlayedAt.
func Build(matches []Match) Report {
	ms := append([]Match(nil), matches...)
	sort.Slice(ms, func(i, j int) bool { return ms[i].PlayedAt.Before(ms[j].PlayedAt) })

	var sum Summary
	sum.Form = []string{}
	bat := map[string]*Batter{}
	bowl := map[string]*Bowler{}
	field := map[string]*Fielder{}
	awards := map[string]*Award{}
	apps := map[string]int{} // lineup appearances per player
	ratingSum := map[string]float64{}
	ratingBest := map[string]float64{}
	people := map[string]Player{}
	streak := 0

	for _, m := range ms {
		res := m.Result
		byCard := map[string]engine.Card{}
		for _, c := range m.Cards {
			byCard[c.ID] = c
		}
		info := func(cardID string) (Player, bool) {
			c, ok := byCard[cardID]
			if !ok {
				return Player{}, false
			}
			pid := c.PlayerID
			if pid == "" {
				pid = c.ID
			}
			return Player{PlayerID: pid, Name: c.Name, Country: c.Country, Role: string(c.Role), Rarity: string(c.Rarity)}, true
		}

		sum.Played++
		if m.VsBot {
			sum.VsBots++
		} else {
			sum.VsPlayers++
		}
		if m.TrophyDelta > 0 {
			sum.TrophiesWon += m.TrophyDelta
		} else {
			sum.TrophiesLost -= m.TrophyDelta
		}
		switch res.Winner {
		case "tie":
			sum.Tied++
			sum.Form = append(sum.Form, "T")
			streak = 0
		case m.Side:
			sum.Won++
			sum.Form = append(sum.Form, "W")
			if streak < 0 {
				streak = 0
			}
			streak++
			if streak > sum.BestWinStreak {
				sum.BestWinStreak = streak
			}
		default:
			sum.Lost++
			sum.Form = append(sum.Form, "L")
			if streak > 0 {
				streak = 0
			}
			streak--
		}

		for _, inn := range res.Innings {
			score := &TeamScore{MatchID: m.ID, Runs: inn.Runs, Wickets: inn.Wickets, Balls: inn.Balls, Opponent: m.Opponent, PlayedAt: m.PlayedAt}
			if inn.BattingSide == m.Side {
				sum.TeamRuns += inn.Runs
				if sum.HighestTotal == nil || inn.Runs > sum.HighestTotal.Runs {
					sum.HighestTotal = score
				}
				if sum.LowestTotal == nil || inn.Runs < sum.LowestTotal.Runs {
					sum.LowestTotal = score
				}
				for _, b := range inn.Batters {
					p, ok := info(b.CardID)
					if !ok {
						continue
					}
					sum.Fours += b.Fours
					sum.Sixes += b.Sixes
					if b.Balls == 0 && b.Dismissal == nil {
						continue // did not bat
					}
					a := bat[p.PlayerID]
					if a == nil {
						a = &Batter{Player: p}
						bat[p.PlayerID] = a
					}
					a.Innings++
					a.Runs += b.Runs
					a.Balls += b.Balls
					a.Fours += b.Fours
					a.Sixes += b.Sixes
					out := b.Dismissal != nil
					if out {
						a.Outs++
					}
					if b.Runs > a.High || (b.Runs == a.High && !out) {
						a.High, a.HighNotOut = b.Runs, !out
					}
				}
			}
			if inn.BowlingSide == m.Side {
				sum.WicketsTaken += inn.Wickets
				if inn.Balls > 0 && (sum.BestDefence == nil || inn.Runs < sum.BestDefence.Runs) {
					sum.BestDefence = score
				}
				for _, b := range inn.Bowlers {
					p, ok := info(b.CardID)
					if !ok || b.Balls == 0 {
						continue
					}
					a := bowl[p.PlayerID]
					if a == nil {
						a = &Bowler{Player: p}
						bowl[p.PlayerID] = a
					}
					a.Innings++
					a.Balls += b.Balls
					a.Runs += b.Runs
					a.Wickets += b.Wickets
					if a.Innings == 1 || b.Wickets > a.BestW || (b.Wickets == a.BestW && b.Runs < a.BestR) {
						a.BestW, a.BestR = b.Wickets, b.Runs
					}
				}
				for _, f := range inn.Fielders {
					p, ok := info(f.CardID)
					if !ok {
						continue
					}
					n := f.Catches + f.Stumpings + f.RunOuts
					if n == 0 {
						continue
					}
					a := field[p.PlayerID]
					if a == nil {
						a = &Fielder{Player: p}
						field[p.PlayerID] = a
					}
					a.Catches += f.Catches
					a.Stumpings += f.Stumpings
					a.RunOuts += f.RunOuts
					a.Total += n
				}
			}
		}
		inXI := map[string]bool{}
		ratings := engine.PlayerRatings(res)
		for _, c := range m.Cards {
			if p, ok := info(c.ID); ok && !inXI[p.PlayerID] {
				inXI[p.PlayerID] = true
				apps[p.PlayerID]++
				r := ratings[c.ID]
				ratingSum[p.PlayerID] += r
				if r > ratingBest[p.PlayerID] {
					ratingBest[p.PlayerID] = r
				}
				people[p.PlayerID] = p
			}
		}
		if p, ok := info(res.POTM); ok {
			a := awards[p.PlayerID]
			if a == nil {
				a = &Award{Player: p}
				awards[p.PlayerID] = a
			}
			a.Awards++
		}
	}

	sum.CurrentStreak = streak
	if sum.Played > 0 {
		sum.WinRate = float64(sum.Won) / float64(sum.Played)
	}
	if len(sum.Form) > 5 {
		sum.Form = sum.Form[len(sum.Form)-5:]
	}

	avgRating := func(pid string) float64 {
		if apps[pid] == 0 {
			return 0
		}
		return math.Round(ratingSum[pid]/float64(apps[pid])*10) / 10
	}
	r := Report{Summary: sum, Rated: []Rated{}, Batting: []Batter{}, Bowling: []Bowler{}, Fielding: []Fielder{}, Awards: []Award{}}
	for pid, p := range people {
		p.Matches, p.AvgRating = apps[pid], avgRating(pid)
		r.Rated = append(r.Rated, Rated{Player: p, Best: ratingBest[pid]})
	}
	for _, a := range bat {
		a.Matches = apps[a.PlayerID]
		a.AvgRating = avgRating(a.PlayerID)
		if a.Outs > 0 {
			a.Average = round2(float64(a.Runs) / float64(a.Outs))
		} else {
			a.Average = float64(a.Runs)
		}
		if a.Balls > 0 {
			a.StrikeRate = round2(float64(a.Runs) / float64(a.Balls) * 100)
		}
		r.Batting = append(r.Batting, *a)
	}
	for _, a := range bowl {
		a.Matches = apps[a.PlayerID]
		a.AvgRating = avgRating(a.PlayerID)
		if a.Balls > 0 {
			a.Economy = round2(float64(a.Runs) / float64(a.Balls) * 6)
		}
		if a.Wickets > 0 {
			a.Average = round2(float64(a.Runs) / float64(a.Wickets))
		}
		r.Bowling = append(r.Bowling, *a)
	}
	for _, a := range field {
		a.Matches = apps[a.PlayerID]
		a.AvgRating = avgRating(a.PlayerID)
		r.Fielding = append(r.Fielding, *a)
	}
	for _, a := range awards {
		a.Matches = apps[a.PlayerID]
		a.AvgRating = avgRating(a.PlayerID)
		r.Awards = append(r.Awards, *a)
	}
	sort.Slice(r.Batting, func(i, j int) bool {
		a, b := r.Batting[i], r.Batting[j]
		if a.Runs != b.Runs {
			return a.Runs > b.Runs
		}
		if a.StrikeRate != b.StrikeRate {
			return a.StrikeRate > b.StrikeRate
		}
		return a.Name < b.Name
	})
	sort.Slice(r.Bowling, func(i, j int) bool {
		a, b := r.Bowling[i], r.Bowling[j]
		if a.Wickets != b.Wickets {
			return a.Wickets > b.Wickets
		}
		if a.Economy != b.Economy {
			return a.Economy < b.Economy
		}
		return a.Name < b.Name
	})
	sort.Slice(r.Fielding, func(i, j int) bool {
		a, b := r.Fielding[i], r.Fielding[j]
		if a.Total != b.Total {
			return a.Total > b.Total
		}
		return a.Name < b.Name
	})
	sort.Slice(r.Awards, func(i, j int) bool {
		a, b := r.Awards[i], r.Awards[j]
		if a.Awards != b.Awards {
			return a.Awards > b.Awards
		}
		return a.Name < b.Name
	})
	sort.Slice(r.Rated, func(i, j int) bool {
		a, b := r.Rated[i], r.Rated[j]
		if a.AvgRating != b.AvgRating {
			return a.AvgRating > b.AvgRating
		}
		if a.Matches != b.Matches {
			return a.Matches > b.Matches
		}
		return a.Name < b.Name
	})
	r.Rated = head(r.Rated, Limit)
	r.Batting = head(r.Batting, Limit)
	r.Bowling = head(r.Bowling, Limit)
	r.Fielding = head(r.Fielding, Limit)
	r.Awards = head(r.Awards, Limit)
	return r
}

func head[T any](xs []T, n int) []T {
	if len(xs) > n {
		return xs[:n]
	}
	return xs
}

func round2(x float64) float64 {
	return float64(int(x*100+0.5)) / 100
}
