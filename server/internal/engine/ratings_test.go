package engine

import "testing"

func TestPlayerRatingsCases(t *testing.T) {
	res := MatchResult{
		Winner: "home",
		POTM:   "hero",
		Innings: [2]InningsResult{
			{
				BattingSide: "home", BowlingSide: "away",
				Batters: []BatterScore{
					{CardID: "hero", Runs: 40, Balls: 18, Fours: 4, Sixes: 2, NotOut: true},
					{CardID: "duck", Runs: 0, Balls: 2, Dismissal: &Dismissal{Type: DismissBowled}},
					{CardID: "dnb"},
				},
				Bowlers:  []BowlerScore{{CardID: "tidy", Balls: 12, Runs: 10, Wickets: 2}, {CardID: "leaky", Balls: 12, Runs: 32}},
				Fielders: []FielderScore{{CardID: "safe", Catches: 2}, {CardID: "butter", Drops: 2}},
			},
		},
	}
	got := PlayerRatings(res)
	// hero: 6 + (40-27)/8 + 40/25 + 0.3 not out + 0.2 win + 0.3 POTM = 10.025 -> capped at 10
	if got["hero"] != 10 {
		t.Errorf("hero = %v, want 10 (capped)", got["hero"])
	}
	// duck: 6 + (0-3)/8 - 0.8 + win 0.2 = 5.025 -> 5.0
	if got["duck"] != 5.0 {
		t.Errorf("duck = %v, want 5.0", got["duck"])
	}
	// did not bat, on the winning side: 6.2
	if got["dnb"] != 6.2 {
		t.Errorf("dnb = %v, want 6.2", got["dnb"])
	}
	// tidy bowler on the losing side: 6 + 2 + (18-10)/6 = 9.33
	if got["tidy"] != 9.3 {
		t.Errorf("tidy = %v, want 9.3", got["tidy"])
	}
	// leaky: 6 + (18-32)/6 = 3.67
	if got["leaky"] != 3.7 {
		t.Errorf("leaky = %v, want 3.7", got["leaky"])
	}
	if got["safe"] != 6.8 || got["butter"] != 5.0 {
		t.Errorf("fielders safe=%v butter=%v, want 6.8 and 5.0", got["safe"], got["butter"])
	}
}

// Across many simulated matches, ratings should centre near the base and use the scale.
func TestPlayerRatingsDistribution(t *testing.T) {
	if testing.Short() {
		t.Skip()
	}
	var sum float64
	var n, high, low int
	for i := 0; i < 1500; i++ {
		res, err := Simulate(int64(i+1), ReferenceXI("h"), ReferenceXI("a"), TossResult{})
		if err != nil {
			t.Fatal(err)
		}
		for _, v := range PlayerRatings(res) {
			sum += v
			n++
			if v >= 8 {
				high++
			}
			if v < 5 {
				low++
			}
		}
	}
	avg := sum / float64(n)
	t.Logf("avg %.2f, >=8: %.1f%%, <5: %.1f%%", avg, float64(high)*100/float64(n), float64(low)*100/float64(n))
	if avg < 5.9 || avg > 6.6 {
		t.Errorf("average rating %.2f should sit near 6.0-6.5", avg)
	}
	if high == 0 || low == 0 {
		t.Errorf("ratings should use the scale (>=8: %d, <5: %d)", high, low)
	}
}
