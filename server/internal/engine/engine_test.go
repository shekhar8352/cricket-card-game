package engine

import (
	"fmt"
	"testing"
)

func sampleCard(id, name string, role Role, bowl BowlType, a Attributes, traits ...string) Card {
	return Card{
		ID: id, PlayerID: id, Name: name, Country: "IND",
		Role: role, BatHand: HandRight, BowlType: bowl,
		Rarity: RarityGold, Level: 1, Attrs: a, Traits: traits,
	}
}

func batAttrs(tech, power, timing, vp, vs, temp, run int) Attributes {
	return Attributes{
		Technique: tech, Power: power, Timing: timing, VsPace: vp, VsSpin: vs,
		Temperament: temp, Running: run,
		Accuracy: 30, Variation: 25, WicketTaking: 20, Movement: 20, DeathBowling: 20,
		Catching: 70, GroundField: 68, Throwing: 65,
		Keeping: 8, Stumping: 6, Reflexes: 8,
	}
}

func bowlAttrs(acc, vari, wt, mov, death int) Attributes {
	return Attributes{
		Technique: 38, Power: 32, Timing: 35, VsPace: 36, VsSpin: 34,
		Temperament: 40, Running: 45,
		Accuracy: acc, Variation: vari, WicketTaking: wt, Movement: mov, DeathBowling: death,
		Catching: 62, GroundField: 64, Throwing: 70,
		Keeping: 6, Stumping: 4, Reflexes: 6,
	}
}

func wkAttrs(tech, power, keep, stump, reflex int) Attributes {
	a := batAttrs(tech, power, 72, 70, 68, 74, 70)
	a.Keeping = keep
	a.Stumping = stump
	a.Reflexes = reflex
	a.Catching = keep
	return a
}

func arAttrs() Attributes {
	a := batAttrs(72, 74, 70, 68, 70, 70, 72)
	a.Accuracy = 72
	a.Variation = 70
	a.WicketTaking = 68
	a.Movement = 66
	a.DeathBowling = 70
	return a
}

func makeXI(prefix string, bump int) Lineup {
	shift := func(a Attributes, n int) Attributes {
		a.Technique = clamp(a.Technique+n, 1, 99)
		a.Power = clamp(a.Power+n, 1, 99)
		a.Timing = clamp(a.Timing+n, 1, 99)
		a.Accuracy = clamp(a.Accuracy+n, 1, 99)
		a.Variation = clamp(a.Variation+n, 1, 99)
		a.WicketTaking = clamp(a.WicketTaking+n, 1, 99)
		return a
	}
	cards := []Card{
		sampleCard(prefix+"b1", prefix+" Batter1", RoleBAT, BowlPace, shift(batAttrs(80, 70, 76, 78, 72, 74, 72), bump)),
		sampleCard(prefix+"b2", prefix+" Batter2", RoleBAT, BowlPace, shift(batAttrs(74, 82, 70, 70, 68, 70, 74), bump)),
		sampleCard(prefix+"b3", prefix+" Batter3", RoleBAT, BowlPace, shift(batAttrs(72, 76, 74, 72, 74, 72, 70), bump)),
		sampleCard(prefix+"wk", prefix+" Keeper", RoleWK, BowlPace, shift(wkAttrs(70, 68, 80, 76, 78), bump)),
		sampleCard(prefix+"ar", prefix+" Allrounder", RoleAR, BowlPace, shift(arAttrs(), bump)),
		sampleCard(prefix+"p1", prefix+" Pacer", RoleBOWL, BowlPace, shift(bowlAttrs(78, 74, 76, 72, 70), bump)),
		sampleCard(prefix+"s1", prefix+" Spinner", RoleBOWL, BowlSpin, shift(bowlAttrs(74, 80, 72, 78, 64), bump)),
	}
	return Lineup{
		UserID:       prefix,
		Cards:        cards,
		BattingOrder: DefaultBattingOrder(cards),
		BowlingPlan:  DefaultBowlingPlan(cards),
		TossPref:     "chase",
	}
}

func TestValidateLineup(t *testing.T) {
	l := makeXI("h", 0)
	if err := ValidateLineup(l); err != nil {
		t.Fatal(err)
	}
	l.BowlingPlan[1] = l.BowlingPlan[0]
	if err := ValidateLineup(l); err == nil {
		t.Fatal("expected consecutive over error")
	}
}

func TestSimulateDeterministic(t *testing.T) {
	h, a := makeXI("h", 0), makeXI("a", 0)
	r1, err := Simulate(42, h, a, TossResult{WinnerSide: "home", Decision: "bat"})
	if err != nil {
		t.Fatal(err)
	}
	r2, err := Simulate(42, h, a, TossResult{WinnerSide: "home", Decision: "bat"})
	if err != nil {
		t.Fatal(err)
	}
	if len(r1.Balls) != len(r2.Balls) {
		t.Fatalf("ball count mismatch %d vs %d", len(r1.Balls), len(r2.Balls))
	}
	for i := range r1.Balls {
		if r1.Balls[i].Outcome != r2.Balls[i].Outcome || r1.Balls[i].Runs != r2.Balls[i].Runs {
			t.Fatalf("ball %d differs", i)
		}
	}
	if r1.Winner != r2.Winner {
		t.Fatal("winner differs")
	}
}

func TestSimulateProducesScore(t *testing.T) {
	h, a := makeXI("h", 0), makeXI("a", 0)
	r, err := Simulate(7, h, a, TossResult{WinnerSide: "home", Decision: "bat"})
	if err != nil {
		t.Fatal(err)
	}
	if r.Innings[0].Runs < 10 {
		t.Fatalf("implausibly low first innings: %d", r.Innings[0].Runs)
	}
	if len(r.Balls) < 20 {
		t.Fatalf("too few balls: %d", len(r.Balls))
	}
}

func TestDefaultPlanValid(t *testing.T) {
	l := makeXI("x", 0)
	if err := ValidateBowlingPlan(l); err != nil {
		t.Fatal(err)
	}
}

func TestOverallRange(t *testing.T) {
	l := makeXI("x", 0)
	for _, c := range l.Cards {
		o := Overall(c)
		if o < 20 || o > 99 {
			t.Fatalf("overall out of range for %s: %d", c.Name, o)
		}
	}
}

func TestBalance(t *testing.T) {
	if testing.Short() {
		t.Skip()
	}
	const n = 4000
	h := makeXI("h", 0)
	a := makeXI("a", 0)
	var totalScore, homeWins, ties, wkDismiss, stumpSpin, spinWickets, runouts, allWickets int
	for i := 0; i < n; i++ {
		r, err := Simulate(int64(i+1), h, a, TossResult{})
		if err != nil {
			t.Fatal(err)
		}
		totalScore += r.Innings[0].Runs + r.Innings[1].Runs
		if r.Winner == "home" {
			homeWins++
		}
		if r.Winner == "tie" {
			ties++
		}
		for _, b := range r.Balls {
			if b.Dismissal == nil {
				continue
			}
			allWickets++
			switch b.Dismissal.Type {
			case DismissCaughtWK, DismissStumped:
				wkDismiss++
			case DismissRunOut:
				runouts++
			}
			bowl := CardByID(append(h.Cards, a.Cards...), b.BowlerID)
			if bowl != nil && bowl.BowlType == BowlSpin {
				spinWickets++
				if b.Dismissal.Type == DismissStumped {
					stumpSpin++
				}
			}
		}
	}
	avg := float64(totalScore) / float64(n*2)
	if avg < 38 || avg > 78 {
		t.Fatalf("average score %.1f outside 38-78 band", avg)
	}
	homeRate := float64(homeWins) / float64(n-ties)
	if homeRate < 0.42 || homeRate > 0.58 {
		t.Fatalf("matched win rate %.2f not ~50%% (ties=%d)", homeRate, ties)
	}

	// strength edge
	strong := makeXI("s", 10)
	weak := makeXI("w", 0)
	sw := 0
	for i := 0; i < 2000; i++ {
		r, err := Simulate(int64(10000+i), strong, weak, TossResult{WinnerSide: "home", Decision: "bat"})
		if err != nil {
			t.Fatal(err)
		}
		if r.Winner == "home" {
			sw++
		}
	}
	edge := float64(sw) / 2000
	if edge < 0.58 || edge > 0.85 {
		t.Fatalf("10-rating edge win rate %.2f outside 58-85", edge)
	}

	if allWickets > 0 {
		wkShare := float64(wkDismiss) / float64(allWickets)
		if wkShare < 0.10 || wkShare > 0.40 {
			t.Fatalf("WK dismissal share %.2f outside 10-40%%", wkShare)
		}
		roShare := float64(runouts) / float64(allWickets)
		if roShare > 0.18 {
			t.Fatalf("run-out share %.2f too high", roShare)
		}
	}
	if spinWickets > 50 {
		st := float64(stumpSpin) / float64(spinWickets)
		if st > 0.25 {
			t.Fatalf("stumping share vs spin %.2f too high", st)
		}
	}
	t.Logf("avg=%.1f home=%.2f edge=%.2f wk=%.2f ro=%.2f stumpSpin=%.2f",
		avg, homeRate, edge,
		float64(wkDismiss)/float64(allWickets+1),
		float64(runouts)/float64(allWickets+1),
		float64(stumpSpin)/float64(spinWickets+1))
}

func TestKeeperMatters(t *testing.T) {
	if testing.Short() {
		t.Skip()
	}
	weak := makeXI("h", 0)
	strongK := makeXI("h", 0)
	for i := range weak.Cards {
		if weak.Cards[i].Role == RoleWK {
			weak.Cards[i].Attrs.Keeping = 60
			weak.Cards[i].Attrs.Stumping = 55
			weak.Cards[i].Attrs.Reflexes = 58
		}
	}
	for i := range strongK.Cards {
		if strongK.Cards[i].Role == RoleWK {
			strongK.Cards[i].Attrs.Keeping = 90
			strongK.Cards[i].Attrs.Stumping = 88
			strongK.Cards[i].Attrs.Reflexes = 90
		}
	}
	opp := makeXI("a", 0)
	var w1, w2 int
	const n = 1500
	for i := 0; i < n; i++ {
		r1, _ := Simulate(int64(20000+i), weak, opp, TossResult{WinnerSide: "away", Decision: "bat"})
		r2, _ := Simulate(int64(20000+i), strongK, opp, TossResult{WinnerSide: "away", Decision: "bat"})
		if r1.Winner == "home" {
			w1++
		}
		if r2.Winner == "home" {
			w2++
		}
	}
	d := (float64(w2) - float64(w1)) / float64(n) * 100
	if d < 0.5 || d > 12 {
		t.Fatalf("keeper upgrade delta %.1fpp outside 0.5-12", d)
	}
	t.Logf("keeper delta %.1fpp (%d vs %d / %d)", d, w1, w2, n)
}

func TestTraitCap(t *testing.T) {
	if testing.Short() {
		t.Skip()
	}
	plain := makeXI("h", 0)
	traited := makeXI("h", 0)
	for i := range traited.Cards {
		if traited.Cards[i].Role == RoleBAT {
			traited.Cards[i].Traits = []string{"Finisher", "Powerplay Hitter"}
		}
	}
	opp := makeXI("a", 0)
	var w1, w2 int
	const n = 1200
	for i := 0; i < n; i++ {
		r1, _ := Simulate(int64(30000+i), plain, opp, TossResult{WinnerSide: "home", Decision: "bat"})
		r2, _ := Simulate(int64(30000+i), traited, opp, TossResult{WinnerSide: "home", Decision: "bat"})
		if r1.Winner == "home" {
			w1++
		}
		if r2.Winner == "home" {
			w2++
		}
	}
	d := (float64(w2) - float64(w1)) / float64(n) * 100
	if d > 8 {
		t.Fatalf("trait swing %.1fpp exceeds 8", d)
	}
	t.Logf("trait swing %.1fpp", d)
}

func TestCommentaryPresent(t *testing.T) {
	h, a := makeXI("h", 0), makeXI("a", 0)
	r, err := Simulate(99, h, a, TossResult{WinnerSide: "home", Decision: "bat"})
	if err != nil {
		t.Fatal(err)
	}
	for i, b := range r.Balls {
		if b.Commentary == "" {
			t.Fatalf("ball %d missing commentary", i)
		}
	}
}

func ExampleSimulate_scoreline() {
	h, a := makeXI("h", 0), makeXI("a", 0)
	r, _ := Simulate(1, h, a, TossResult{WinnerSide: "home", Decision: "bat"})
	fmt.Printf("%s %d/%d vs %s %d/%d\n",
		r.Innings[0].BattingSide, r.Innings[0].Runs, r.Innings[0].Wickets,
		r.Innings[1].BattingSide, r.Innings[1].Runs, r.Innings[1].Wickets)
}
