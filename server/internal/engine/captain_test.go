package engine

import (
	"math"
	"math/rand"
	"testing"
)

func withCaptain(l Lineup, cp Captaincy) Lineup {
	l.Cards = append([]Card(nil), l.Cards...)
	c := cp
	l.Cards[0].Captaincy = &c
	l.CaptainID = l.Cards[0].ID
	return l
}

var (
	sharpCap = Captaincy{Aggression: 50, Tactics: 95, Calm: 80, Flair: 40, Masterstroke: "trap_set"}
	dullCap  = Captaincy{Aggression: 50, Tactics: 20, Calm: 40, Flair: 40, Masterstroke: "trap_set"}
	brashCap = Captaincy{Aggression: 88, Tactics: 25, Calm: 40, Flair: 20, Masterstroke: "all_out_attack"}
)

func winRate(t *testing.T, a, b Captaincy, gapA, gapB, n int) float64 {
	t.Helper()
	w := 0
	for i := 0; i < n; i++ {
		r, err := Simulate(int64(i+7), withCaptain(makeXI("a", gapA), a), withCaptain(makeXI("b", gapB), b), TossResult{})
		if err != nil {
			t.Fatal(err)
		}
		if r.Winner == "home" {
			w++
		}
	}
	return float64(w) / float64(n)
}

func TestCaptainAggressionShapesCalls(t *testing.T) {
	share := func(agg int) float64 {
		cap := Card{ID: "c", PlayerID: "c", Captaincy: &Captaincy{Aggression: agg, Tactics: 60, Calm: 60, Flair: 30}}
		rng := rand.New(rand.NewSource(1))
		att := 0
		for i := 0; i < 4000; i++ {
			if chooseApproach(rng, cap, situation{over: 2, target: -1}, nil, "") == ApproachAttack {
				att++
			}
		}
		return float64(att) / 4000
	}
	hi, lo := share(90), share(30)
	t.Logf("attack share: aggression 90 = %.2f, aggression 30 = %.2f", hi, lo)
	if hi < 0.6 || lo > 0.25 {
		t.Errorf("aggressive captains should attack most overs (got %.2f) and cautious ones rarely (got %.2f)", hi, lo)
	}
}

func TestCaptainFlairAddsVariety(t *testing.T) {
	entropy := func(flair int) float64 {
		cap := Card{ID: "c", PlayerID: "c", Captaincy: &Captaincy{Aggression: 70, Tactics: 50, Calm: 60, Flair: flair}}
		rng := rand.New(rand.NewSource(2))
		n := map[Approach]float64{}
		for i := 0; i < 4000; i++ {
			n[chooseApproach(rng, cap, situation{over: 2, target: -1}, nil, "")]++
		}
		h := 0.0
		for _, c := range n {
			p := c / 4000
			h -= p * math.Log2(p)
		}
		return h
	}
	if wild, steady := entropy(90), entropy(15); wild <= steady+0.2 {
		t.Errorf("high-flair captains should be harder to predict: entropy %.2f vs %.2f", wild, steady)
	}
}

func TestCaptainTacticsWin(t *testing.T) {
	if testing.Short() {
		t.Skip()
	}
	vsRandom := winRate(t, sharpCap, dullCap, 0, 0, 3000)
	vsPredictable := winRate(t, sharpCap, brashCap, 0, 0, 3000)
	underdogSharp := winRate(t, sharpCap, brashCap, 0, 10, 3000)
	underdogDull := winRate(t, dullCap, brashCap, 0, 10, 3000)
	t.Logf("sharp vs hard-to-read %.3f, sharp vs predictable %.3f, underdog sharp %.3f vs dull %.3f", vsRandom, vsPredictable, underdogSharp, underdogDull)
	if vsRandom < 0.52 || vsRandom > 0.62 {
		t.Errorf("a sharp captain should edge a random one between equal teams (got %.3f)", vsRandom)
	}
	if vsPredictable < 0.6 {
		t.Errorf("a sharp captain should exploit a predictable one (got %.3f)", vsPredictable)
	}
	if underdogSharp-underdogDull < 0.10 {
		t.Errorf("a sharp captain should lift an underdog by 10pp+ (got %.3f -> %.3f)", underdogDull, underdogSharp)
	}
	if underdogSharp >= 0.5 {
		t.Errorf("ratings should still matter: a 10-point weaker side won %.3f", underdogSharp)
	}
}

func TestTwoPhaseMatchesSimulate(t *testing.T) {
	for seed := int64(1); seed < 200; seed++ {
		h, a := makeXI("h", 0), makeXI("a", 0)
		whole, err := Simulate(seed, h, a, TossResult{})
		if err != nil {
			t.Fatal(err)
		}
		if whole.SuperOver != nil {
			continue
		}
		fi, _ := SimulateFirstInnings(seed, h, a, TossResult{})
		split, _ := SimulateSecondInnings(seed, h, a, fi, CallCaptain, CallCaptain)
		if split.Innings[1].Runs != whole.Innings[1].Runs || split.Winner != whole.Winner || len(split.Balls) != len(whole.Balls) {
			t.Fatalf("seed %d: split match differs from Simulate", seed)
		}
	}
}

func TestBreakCallsSteerCaptain(t *testing.T) {
	early := func(call BreakCall) float64 {
		att, n := 0, 0
		for seed := int64(1); seed <= 600; seed++ {
			h, a := makeXI("h", 0), makeXI("a", 0)
			fi, _ := SimulateFirstInnings(seed, h, a, TossResult{})
			calls := map[string]BreakCall{fi.FirstSide: CallCaptain, fi.SecondSide: call}
			res, _ := SimulateSecondInnings(seed, h, a, fi, calls["home"], calls["away"])
			for _, c := range res.Innings[1].Calls {
				if c.Over <= 1 {
					n++
					if c.Approach == ApproachAttack {
						att++
					}
				}
			}
		}
		return float64(att) / float64(n)
	}
	fast, late := early(CallFastStart), early(CallLateCharge)
	t.Logf("attack share in overs 1-2: fast start %.2f, late charge %.2f", fast, late)
	if fast-late < 0.3 {
		t.Errorf("Fast start should attack the powerplay far more than Late charge (%.2f vs %.2f)", fast, late)
	}
	if err := ValidateBreakCall(CallHunt, "chase"); err == nil {
		t.Error("a defending card must not be allowed for the chasing side")
	}
}

func TestConditionsFrequencies(t *testing.T) {
	n := map[Conditions]int{}
	for i := int64(0); i < 20000; i++ {
		n[ConditionsForSeed(i*2654435761)]++
	}
	for _, d := range ConditionsList {
		got := float64(n[d.Code]) / 200
		if math.Abs(got-float64(d.Chance)) > 2 {
			t.Errorf("%s: %.1f%%, want about %d%%", d.Code, got, d.Chance)
		}
	}
}

func TestQuirksAcrossMatches(t *testing.T) {
	if testing.Short() {
		t.Skip()
	}
	strokes := 0
	for seed := int64(1); seed <= 1500; seed++ {
		r, err := Simulate(seed, makeXI("h", 0), makeXI("a", 0), TossResult{})
		if err != nil {
			t.Fatal(err)
		}
		bySide := map[string]map[string]bool{}
		for i, inn := range r.Innings {
			for _, c := range inn.Calls {
				if c.Masterstroke == "" {
					continue
				}
				side := inn.BattingSide
				if c.MasterstrokeBy == "bowl" {
					side = inn.BowlingSide
				}
				if bySide[side] == nil {
					bySide[side] = map[string]bool{}
				}
				if len(bySide[side]) > 0 {
					t.Fatalf("seed %d innings %d: %s played a second masterstroke", seed, i, side)
				}
				bySide[side][c.Masterstroke] = true
				strokes++
			}
			if PhaseOf(0) == PhasePowerplay {
				for _, b := range r.Balls {
					if b.Innings == i && b.Over <= 1 && b.FieldingSave && b.Runs >= 2 {
						t.Fatalf("seed %d: a four was saved in the powerplay", seed)
					}
				}
			}
		}
		for _, b := range r.Balls {
			if b.FreeHit && b.Dismissal != nil && b.Dismissal.Type != DismissRunOut {
				t.Fatalf("seed %d: out %s on a free hit", seed, b.Dismissal.Type)
			}
		}
	}
	if strokes == 0 {
		t.Error("masterstrokes should be played")
	}
}

func TestSuperOver(t *testing.T) {
	h, a := makeXI("h", 0), makeXI("a", 0)
	for seed := int64(1); seed < 5000; seed++ {
		fi, _ := SimulateFirstInnings(seed, h, a, TossResult{})
		res, _ := SimulateSecondInnings(seed, h, a, fi, CallCaptain, CallCaptain)
		if res.Winner != "tie" {
			continue
		}
		one, err := SimulateSuperOver(seed, h, a, res, AutoSuperOverPicks(h), AutoSuperOverPicks(a))
		if err != nil {
			t.Fatal(err)
		}
		two, _ := SimulateSuperOver(seed, h, a, res, AutoSuperOverPicks(h), AutoSuperOverPicks(a))
		if one.SuperOver == nil || one.Winner != two.Winner || one.SuperOver.Innings[0].Runs != two.SuperOver.Innings[0].Runs {
			t.Fatal("super over must be deterministic")
		}
		so := one.SuperOver
		if so.Innings[0].BattingSide != res.Innings[1].BattingSide {
			t.Error("the side that batted second must bat first in the Super Over")
		}
		if so.Innings[0].Balls > 6 || so.Innings[0].Wickets > SuperOverWickets {
			t.Error("a Super Over is one over and ends at 2 wickets")
		}
		if so.Winner != "tie" && one.Margin == "" {
			t.Error("winner needs a margin")
		}
		bad := SuperOverPicks{Batters: []string{h.Cards[0].ID, h.Cards[0].ID, h.Cards[1].ID}, Bowler: h.Cards[0].ID}
		if ValidateSuperOverPicks(h, bad) == nil {
			t.Error("duplicate batters and a batter bowling should be rejected")
		}
		return
	}
	t.Fatal("no tied match found to test the Super Over")
}

func TestChemistryHelpsRunning(t *testing.T) {
	if testing.Short() {
		t.Skip()
	}
	countries := []string{"IND", "AUS", "ENG", "SA", "NZ", "SL", "WI"}
	build := func(prefix string, linked bool) Lineup {
		l := makeXI(prefix, 0)
		ids := []string{}
		for _, c := range l.Cards {
			ids = append(ids, c.PlayerID)
		}
		for i := range l.Cards {
			if linked {
				l.Cards[i].Country, l.Cards[i].Partners = "IND", ids
			} else {
				l.Cards[i].Country, l.Cards[i].Partners = countries[i], nil
			}
		}
		l.Tactics = Tactics{BatApproach: []Approach{"balanced", "balanced", "balanced"}, FieldPlan: []FieldPlan{"balanced", "balanced", "balanced", "balanced", "balanced"}}
		return l
	}
	// Run-outs are measured per run attempted: linked pairs run more, so per ball is unfair.
	stats := func(linked bool) (twosPerBall, runOutsPerAttempt float64) {
		twos, ros, balls, attempts := 0, 0, 0, 0
		for i := 0; i < 3000; i++ {
			rng := rand.New(rand.NewSource(int64(i + 1)))
			_, evs := measureInnings(rng, build("b", linked), build("o", false), PitchBalanced, false)
			for _, e := range evs {
				if !e.Legal {
					continue
				}
				balls++
				if e.Outcome == OutcomeTwo || e.Outcome == OutcomeThree {
					twos++
				}
				if e.Dismissal != nil && e.Dismissal.Type == DismissRunOut {
					ros++
					attempts++
				} else if e.Dismissal == nil && e.Runs >= 1 && e.Runs <= 3 && e.Extras.Type == "" {
					attempts++
				}
			}
		}
		return float64(twos) / float64(balls), float64(ros) / float64(attempts)
	}
	tw1, ro1 := stats(true)
	tw0, ro0 := stats(false)
	t.Logf("linked pairs: twos %.3f run-outs %.4f; strangers: twos %.3f run-outs %.4f", tw1, ro1, tw0, ro0)
	if tw1 <= tw0 || ro1 >= ro0 {
		t.Errorf("chemistry should mean more twos and fewer run-outs")
	}
	l := makeXI("t", 0)
	if TeamChemistry(l.Cards, l.BattingOrder) == 0 {
		t.Error("same-country batters should have some team chemistry")
	}
}

func TestRivalEdge(t *testing.T) {
	bat, bowl := makeXI("b", 0), makeXI("o", 0)
	bat.Tactics = Tactics{BatApproach: []Approach{"balanced"}}
	bowl.Tactics = Tactics{FieldPlan: []FieldPlan{"balanced"}}
	run := func(n int) bool {
		bowl.Rivals = map[string]int{}
		for _, c := range bowl.Cards {
			for _, b := range bat.Cards {
				bowl.Rivals[c.PlayerID+"|"+b.PlayerID] = n
			}
		}
		_, evs := measureInnings(rand.New(rand.NewSource(3)), bat, bowl, PitchBalanced, false)
		for _, e := range evs {
			if e.Rivalry {
				return true
			}
		}
		return false
	}
	if run(RivalDismissals - 1) {
		t.Error("no rivalry edge below the threshold")
	}
	if !run(RivalDismissals) {
		t.Error("rivalry edge should apply at the threshold")
	}
}

func TestDeriveCaptaincyIsStableAndBounded(t *testing.T) {
	for _, c := range ReferenceXI("x").Cards {
		a, b := DeriveCaptaincy(c), DeriveCaptaincy(c)
		if a != b {
			t.Fatal("derived captaincy must be deterministic")
		}
		for _, v := range []int{a.Aggression, a.Tactics, a.Calm, a.Flair} {
			if v < 1 || v > 99 {
				t.Fatalf("captaincy value out of range: %+v", a)
			}
		}
		if _, ok := MasterstrokeByCode(a.Masterstroke); !ok {
			t.Fatalf("derived captain needs a valid masterstroke: %+v", a)
		}
	}
}
