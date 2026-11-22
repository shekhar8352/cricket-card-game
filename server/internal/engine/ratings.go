package engine

import "math"

// RatingRules turns a scorecard line into a 3.0–10.0 match rating. Every player
// starts from Base; batting, bowling and fielding add or subtract from there.
// The values are exported through the engine model so they are public.
type RatingRules struct {
	Base float64 `json:"base"`
	Min  float64 `json:"min"`
	Max  float64 `json:"max"`

	ParRunsPerBall float64 `json:"parRunsPerBall"` // what an average side scores per ball (par 45 / 30 balls)

	BatPerRunAbovePar float64 `json:"batPerRunAbovePar"` // per run scored above (balls faced × par)
	BatPerRun         float64 `json:"batPerRun"`         // volume: per run scored
	Duck              float64 `json:"duck"`              // out for 0
	CheapDismissal    float64 `json:"cheapDismissal"`    // out for 1 to CheapBelow-1
	CheapBelow        int     `json:"cheapBelow"`
	NotOutBonus       float64 `json:"notOutBonus"` // not out with at least NotOutMinRuns
	NotOutMinRuns     int     `json:"notOutMinRuns"`

	BowlPerWicket      float64 `json:"bowlPerWicket"`
	BowlPerRunBelowPar float64 `json:"bowlPerRunBelowPar"` // per run conceded below (balls bowled × par)

	Catch    float64 `json:"catch"`
	Stumping float64 `json:"stumping"`
	RunOut   float64 `json:"runOut"`
	Drop     float64 `json:"drop"`
	Save     float64 `json:"save"`

	Win           float64 `json:"win"`
	PlayerOfMatch float64 `json:"playerOfMatch"`
}

var Ratings = RatingRules{
	Base: 6.0, Min: 3.0, Max: 10.0,
	ParRunsPerBall:    1.5,
	BatPerRunAbovePar: 1.0 / 8,
	BatPerRun:         1.0 / 25,
	Duck:              -0.8,
	CheapDismissal:    -0.4,
	CheapBelow:        5,
	NotOutBonus:       0.3,
	NotOutMinRuns:     10,

	BowlPerWicket:      1.0,
	BowlPerRunBelowPar: 1.0 / 6,

	Catch: 0.4, Stumping: 0.5, RunOut: 0.5, Drop: -0.5, Save: 0.1,

	Win: 0.2, PlayerOfMatch: 0.3,
}

// PlayerRatings rates every card that appears in the result, keyed by card ID.
func PlayerRatings(res MatchResult) map[string]float64 {
	r := Ratings
	score := map[string]float64{}
	side := map[string]string{}
	touch := func(id, s string) {
		if _, ok := score[id]; !ok {
			score[id] = r.Base
		}
		side[id] = s
	}

	for _, inn := range res.Innings {
		for _, b := range inn.Batters {
			touch(b.CardID, inn.BattingSide)
			batted := b.Balls > 0 || b.Dismissal != nil
			if !batted {
				continue
			}
			pts := (float64(b.Runs)-float64(b.Balls)*r.ParRunsPerBall)*r.BatPerRunAbovePar + float64(b.Runs)*r.BatPerRun
			if b.Dismissal != nil {
				if b.Runs == 0 {
					pts += r.Duck
				} else if b.Runs < r.CheapBelow {
					pts += r.CheapDismissal
				}
			} else if b.Runs >= r.NotOutMinRuns {
				pts += r.NotOutBonus
			}
			score[b.CardID] += pts
		}
		for _, b := range inn.Bowlers {
			touch(b.CardID, inn.BowlingSide)
			if b.Balls == 0 {
				continue
			}
			score[b.CardID] += float64(b.Wickets)*r.BowlPerWicket +
				(float64(b.Balls)*r.ParRunsPerBall-float64(b.Runs))*r.BowlPerRunBelowPar
		}
		for _, f := range inn.Fielders {
			touch(f.CardID, inn.BowlingSide)
			score[f.CardID] += float64(f.Catches)*r.Catch + float64(f.Stumpings)*r.Stumping +
				float64(f.RunOuts)*r.RunOut + float64(f.Drops)*r.Drop + float64(f.RunsSaved)*r.Save
		}
	}

	out := make(map[string]float64, len(score))
	for id, v := range score {
		if res.Winner != "" && res.Winner != "tie" && side[id] == res.Winner {
			v += r.Win
		}
		if id == res.POTM {
			v += r.PlayerOfMatch
		}
		v = math.Max(r.Min, math.Min(r.Max, v))
		out[id] = math.Round(v*10) / 10
	}
	return out
}
