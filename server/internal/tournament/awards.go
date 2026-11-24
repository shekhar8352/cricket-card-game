package tournament

import (
	"encoding/json"
	"fmt"
	"math"
	"sort"

	"github.com/google/uuid"
	"github.com/sudhanshushekhar/cricket-card-game/internal/engine"
	"github.com/sudhanshushekhar/cricket-card-game/internal/match"
	"github.com/sudhanshushekhar/cricket-card-game/internal/store"
)

// MVP points per contribution, on the IPL's Most Valuable Player scale.
var MVPPoints = struct {
	Wicket, Dot, Four, Six, Catch, Stumping, RunOut float64
}{Wicket: 3.5, Dot: 1, Four: 2.5, Six: 3.5, Catch: 2.5, Stumping: 2.5, RunOut: 2.5}

// Qualifying minimums for the rate awards.
const (
	MinBallsForStrikeRate = 15
	MinBallsForEconomy    = 12
)

// Award is one honour given at the end of a tournament.
type Award struct {
	Code     string    `json:"code"`
	Title    string    `json:"title"`
	Blurb    string    `json:"blurb"`
	UserID   uuid.UUID `json:"userId"`
	Username string    `json:"username"`
	CardID   string    `json:"cardId,omitempty"`
	CardName string    `json:"cardName,omitempty"`
	PlayerID string    `json:"playerId,omitempty"`
	Rarity   string    `json:"rarity,omitempty"`
	Role     string    `json:"role,omitempty"`
	Value    string    `json:"value"`
	Detail   string    `json:"detail,omitempty"`
}

// Honours is everything decided when a tournament ends.
type Honours struct {
	Champion uuid.UUID   `json:"champion"`
	RunnerUp uuid.UUID   `json:"runnerUp"`
	Placings []uuid.UUID `json:"placings"`
	Awards   []Award     `json:"awards"`
}

// cardStats is one card's tournament, summed over every match it played.
type cardStats struct {
	card  engine.Card
	owner uuid.UUID

	apps                           int
	runs, balls, fours, sixes      int
	bestRuns, bestBalls            int
	bestNotOut                     bool
	wkts, bowlBalls, bowlRuns, dot int
	bestW, bestR                   int
	hasFigures                     bool
	catches, stumpings, runOuts    int
	potm                           int
	ratingSum                      float64
	ratings                        int
	reads, capMatches, capWins     int
}

func (c *cardStats) sr() float64 {
	if c.balls == 0 {
		return 0
	}
	return float64(c.runs) * 100 / float64(c.balls)
}

func (c *cardStats) econ() float64 {
	if c.bowlBalls == 0 {
		return math.Inf(1)
	}
	return float64(c.bowlRuns) * 6 / float64(c.bowlBalls)
}

func (c *cardStats) mvp() float64 {
	p := MVPPoints
	return float64(c.wkts)*p.Wicket + float64(c.dot)*p.Dot + float64(c.fours)*p.Four + float64(c.sixes)*p.Six +
		float64(c.catches)*p.Catch + float64(c.stumpings)*p.Stumping + float64(c.runOuts)*p.RunOut
}

func overs(balls int) string { return fmt.Sprintf("%d.%d", balls/6, balls%6) }

func plural(n int, one, many string) string {
	if n == 1 {
		return fmt.Sprintf("%d %s", n, one)
	}
	return fmt.Sprintf("%d %s", n, many)
}

// ComputeHonours works out the champion, the finishing order and every individual award.
func ComputeHonours(format string, players []store.TournamentPlayer, matches []store.MatchRow, lineups []store.TournamentLineup) Honours {
	table := Standings(players, matches)
	h := Honours{Placings: Placings(format, table, matches)}
	if len(h.Placings) > 0 {
		h.Champion = h.Placings[0]
	}
	if len(h.Placings) > 1 {
		h.RunnerUp = h.Placings[1]
	}
	names := map[uuid.UUID]string{}
	for _, p := range players {
		names[p.UserID] = p.Username
	}

	type sideKey struct {
		match uuid.UUID
		user  string
	}
	captains := map[sideKey]string{}
	stats := map[string]*cardStats{}
	for _, l := range lineups {
		var cards []engine.Card
		if json.Unmarshal(l.Snapshot, &cards) != nil {
			continue
		}
		owner, err := uuid.Parse(l.UserID)
		if err != nil {
			continue
		}
		for _, c := range cards {
			if stats[c.ID] == nil {
				stats[c.ID] = &cardStats{card: c, owner: owner}
			}
		}
		if l.CaptainID != nil {
			captains[sideKey{l.MatchID, l.UserID}] = l.CaptainID.String()
		}
	}
	get := func(id string) *cardStats { return stats[id] } // nil for cards we have no snapshot of

	var bestTotal struct {
		user          uuid.UUID
		runs, wickets int
		opp           uuid.UUID
		ok            bool
	}
	for _, m := range matches {
		res, ok := Result(m)
		if !ok || m.AwayUserID == nil {
			continue
		}
		for _, side := range []string{"home", "away"} {
			uid := sideUser(m, side)
			capID := captains[sideKey{m.ID, uid.String()}]
			if c := get(capID); c != nil {
				c.capMatches++
				c.reads += match.CaptainReads(res, side)
				if res.Winner == side {
					c.capWins++
				}
			}
		}
		appeared := map[string]bool{}
		for _, inn := range res.Innings {
			if !bestTotal.ok || inn.Runs > bestTotal.runs || (inn.Runs == bestTotal.runs && inn.Wickets < bestTotal.wickets) {
				bestTotal.user, bestTotal.runs, bestTotal.wickets, bestTotal.ok = sideUser(m, inn.BattingSide), inn.Runs, inn.Wickets, true
				bestTotal.opp = sideUser(m, inn.BowlingSide)
			}
			for _, b := range inn.Batters {
				c := get(b.CardID)
				if c == nil {
					continue
				}
				appeared[b.CardID] = true
				if b.Balls == 0 && b.Dismissal == nil {
					continue // didn't bat
				}
				c.runs += b.Runs
				c.balls += b.Balls
				c.fours += b.Fours
				c.sixes += b.Sixes
				if b.Runs > c.bestRuns || (b.Runs == c.bestRuns && b.Balls < c.bestBalls) || c.bestBalls == 0 {
					c.bestRuns, c.bestBalls, c.bestNotOut = b.Runs, b.Balls, b.Dismissal == nil
				}
			}
			for _, b := range inn.Bowlers {
				c := get(b.CardID)
				if c == nil || b.Balls == 0 {
					continue
				}
				appeared[b.CardID] = true
				c.wkts += b.Wickets
				c.bowlBalls += b.Balls
				c.bowlRuns += b.Runs
				if !c.hasFigures || b.Wickets > c.bestW || (b.Wickets == c.bestW && b.Runs < c.bestR) {
					c.bestW, c.bestR, c.hasFigures = b.Wickets, b.Runs, true
				}
			}
			for _, f := range inn.Fielders {
				if c := get(f.CardID); c != nil {
					c.catches += f.Catches
					c.stumpings += f.Stumpings
					c.runOuts += f.RunOuts
				}
			}
		}
		for _, b := range res.Balls {
			if b.Innings > 1 || !b.Legal || b.Runs != 0 {
				continue // Super Over balls and scoring balls aren't dots
			}
			if c := get(b.BowlerID); c != nil {
				c.dot++
			}
		}
		for id, r := range engine.PlayerRatings(res) {
			if c := get(id); c != nil {
				c.ratingSum += r
				c.ratings++
				appeared[id] = true
			}
		}
		for id := range appeared {
			stats[id].apps++
		}
		if c := get(res.POTM); c != nil {
			c.potm++
		}
	}

	all := make([]*cardStats, 0, len(stats))
	maxApps := 0
	for _, c := range stats {
		all = append(all, c)
		if c.apps > maxApps {
			maxApps = c.apps
		}
	}
	// Deterministic order for equal values.
	sort.Slice(all, func(i, j int) bool { return all[i].card.ID < all[j].card.ID })

	// best picks the card with the highest key (then the highest tie-break) among
	// those that qualify, or nil when nobody does.
	best := func(qual func(*cardStats) bool, key, tie func(*cardStats) float64) *cardStats {
		var win *cardStats
		for _, c := range all {
			if !qual(c) {
				continue
			}
			if win == nil || key(c) > key(win) || (key(c) == key(win) && tie(c) > tie(win)) {
				win = c
			}
		}
		return win
	}
	award := func(code, title, blurb string, c *cardStats, value, detail string) {
		if c == nil {
			return
		}
		h.Awards = append(h.Awards, Award{
			Code: code, Title: title, Blurb: blurb,
			UserID: c.owner, Username: names[c.owner],
			CardID: c.card.ID, CardName: c.card.Name, PlayerID: c.card.PlayerID,
			Rarity: string(c.card.Rarity), Role: string(c.card.Role),
			Value: value, Detail: detail,
		})
	}
	if c := best(func(c *cardStats) bool { return c.runs > 0 }, func(c *cardStats) float64 { return float64(c.runs) }, (*cardStats).sr); c != nil {
		award("orange_cap", "Orange Cap", "Most runs in the tournament", c, plural(c.runs, "run", "runs"), fmt.Sprintf("SR %.1f · %d balls", c.sr(), c.balls))
	}
	if c := best(func(c *cardStats) bool { return c.wkts > 0 }, func(c *cardStats) float64 { return float64(c.wkts) }, func(c *cardStats) float64 { return -c.econ() }); c != nil {
		award("purple_cap", "Purple Cap", "Most wickets in the tournament", c, plural(c.wkts, "wicket", "wickets"), fmt.Sprintf("Economy %.2f · %s overs", c.econ(), overs(c.bowlBalls)))
	}
	if c := best(func(c *cardStats) bool { return c.mvp() > 0 }, (*cardStats).mvp, func(c *cardStats) float64 { return float64(c.runs) }); c != nil {
		award("mvp", "Most Valuable Player", "Most MVP points: wickets, dots, boundaries and fielding", c, fmt.Sprintf("%.1f pts", c.mvp()),
			fmt.Sprintf("%d runs · %d wkts · %d dots", c.runs, c.wkts, c.dot))
	}
	minApps := int(math.Max(1, math.Ceil(float64(maxApps)/2)))
	if c := best(func(c *cardStats) bool { return c.ratings >= minApps }, func(c *cardStats) float64 { return c.ratingSum / float64(c.ratings) }, func(c *cardStats) float64 { return float64(c.ratings) }); c != nil {
		award("player_of_tournament", "Player of the Tournament", fmt.Sprintf("Best average match rating (at least %d matches)", minApps), c,
			fmt.Sprintf("%.1f avg rating", c.ratingSum/float64(c.ratings)), plural(c.ratings, "match", "matches"))
	}
	if c := best(func(c *cardStats) bool { return c.bestBalls > 0 }, func(c *cardStats) float64 { return float64(c.bestRuns) }, func(c *cardStats) float64 { return -float64(c.bestBalls) }); c != nil {
		star := ""
		if c.bestNotOut {
			star = "*"
		}
		award("highest_score", "Highest Score", "Best individual innings", c, fmt.Sprintf("%d%s (%d)", c.bestRuns, star, c.bestBalls), "")
	}
	if c := best(func(c *cardStats) bool { return c.hasFigures && c.bestW > 0 }, func(c *cardStats) float64 { return float64(c.bestW) }, func(c *cardStats) float64 { return -float64(c.bestR) }); c != nil {
		award("best_bowling", "Best Bowling", "Best figures in a single match", c, fmt.Sprintf("%d/%d", c.bestW, c.bestR), "")
	}
	if c := best(func(c *cardStats) bool { return c.sixes > 0 }, func(c *cardStats) float64 { return float64(c.sixes) }, func(c *cardStats) float64 { return -float64(c.balls) }); c != nil {
		award("most_sixes", "Most Sixes", "Cleared the rope most often", c, plural(c.sixes, "six", "sixes"), "")
	}
	if c := best(func(c *cardStats) bool { return c.fours > 0 }, func(c *cardStats) float64 { return float64(c.fours) }, func(c *cardStats) float64 { return -float64(c.balls) }); c != nil {
		award("most_fours", "Most Fours", "Found the boundary most often", c, plural(c.fours, "four", "fours"), "")
	}
	if c := best(func(c *cardStats) bool { return c.balls >= MinBallsForStrikeRate }, (*cardStats).sr, func(c *cardStats) float64 { return float64(c.runs) }); c != nil {
		award("super_striker", "Super Striker", fmt.Sprintf("Best strike rate (at least %d balls faced)", MinBallsForStrikeRate), c, fmt.Sprintf("SR %.1f", c.sr()), fmt.Sprintf("%d runs off %d", c.runs, c.balls))
	}
	if c := best(func(c *cardStats) bool { return c.bowlBalls >= MinBallsForEconomy }, func(c *cardStats) float64 { return -c.econ() }, func(c *cardStats) float64 { return float64(c.wkts) }); c != nil {
		award("best_economy", "Best Economy", fmt.Sprintf("Fewest runs an over (at least %d overs bowled)", MinBallsForEconomy/6), c, fmt.Sprintf("%.2f an over", c.econ()), fmt.Sprintf("%d runs in %s overs", c.bowlRuns, overs(c.bowlBalls)))
	}
	if c := best(func(c *cardStats) bool { return c.dot > 0 }, func(c *cardStats) float64 { return float64(c.dot) }, func(c *cardStats) float64 { return -c.econ() }); c != nil {
		award("most_dots", "Dot Ball King", "Most dot balls bowled", c, plural(c.dot, "dot ball", "dot balls"), "")
	}
	if c := best(func(c *cardStats) bool { return c.catches+c.stumpings+c.runOuts > 0 }, func(c *cardStats) float64 { return float64(c.catches + c.stumpings + c.runOuts) }, func(c *cardStats) float64 { return float64(c.catches) }); c != nil {
		award("best_fielder", "Best Fielder", "Most catches, stumpings and run-outs", c, plural(c.catches+c.stumpings+c.runOuts, "dismissal", "dismissals"),
			fmt.Sprintf("%d ct · %d st · %d ro", c.catches, c.stumpings, c.runOuts))
	}
	if c := best(func(c *cardStats) bool { return c.potm > 0 }, func(c *cardStats) float64 { return float64(c.potm) }, func(c *cardStats) float64 {
		if c.ratings == 0 {
			return 0
		}
		return c.ratingSum / float64(c.ratings)
	}); c != nil {
		award("most_potm", "Most Player of the Match Awards", "Match-winner most often", c, plural(c.potm, "award", "awards"), "")
	}
	if c := best(func(c *cardStats) bool { return c.capMatches > 0 && c.reads > 0 }, func(c *cardStats) float64 { return float64(c.reads) }, func(c *cardStats) float64 { return float64(c.capWins) }); c != nil {
		award("best_captain", "Captain of the Tournament", "Most overs where the captain's call beat the opponent's", c, plural(c.reads, "good read", "good reads"),
			fmt.Sprintf("Won %d of %d as captain", c.capWins, c.capMatches))
	}
	if bestTotal.ok {
		h.Awards = append(h.Awards, Award{
			Code: "highest_total", Title: "Highest Team Total", Blurb: "Biggest innings by any side",
			UserID: bestTotal.user, Username: names[bestTotal.user],
			Value: fmt.Sprintf("%d/%d", bestTotal.runs, bestTotal.wickets), Detail: "vs " + names[bestTotal.opp],
		})
	}
	return h
}
