package engine

import (
	"math"
	"testing"
)

func cell(m []MatrixCell, a Approach, f FieldPlan) MatrixCell {
	for _, c := range m {
		if c.Approach == a && c.Field == f {
			return c
		}
	}
	panic("missing cell")
}

// No plan may be best against everything: each side's best reply must depend
// on the other side's plan, forming a cycle.
func TestNoDominantPlan(t *testing.T) {
	if testing.Short() {
		t.Skip()
	}
	m := StrategyMatrix(3000)
	bestBat := func(f FieldPlan) Approach {
		best, bestRuns := Approach(""), -1.0
		for _, a := range []Approach{ApproachDefend, ApproachBalanced, ApproachAttack} {
			if r := cell(m, a, f).Runs; r > bestRuns {
				best, bestRuns = a, r
			}
		}
		return best
	}
	bestField := func(a Approach) FieldPlan {
		best, bestRuns := FieldPlan(""), math.MaxFloat64
		for _, f := range []FieldPlan{FieldDefend, FieldBalanced, FieldAttack} {
			if r := cell(m, a, f).Runs; r < bestRuns {
				best, bestRuns = f, r
			}
		}
		return best
	}
	for _, c := range m {
		t.Logf("%-8s vs %-8s field: %.1f runs, %.2f wkts", c.Approach, c.Field, c.Runs, c.Wickets)
	}
	// The cycle: attack -> (defend field) -> defend -> (attack field) -> attack.
	if got := bestField(ApproachAttack); got != FieldDefend {
		t.Errorf("best field vs attacking batting = %s, want defend", got)
	}
	if got := bestBat(FieldDefend); got != ApproachDefend {
		t.Errorf("best batting vs defensive field = %s, want defend", got)
	}
	if got := bestField(ApproachDefend); got != FieldAttack {
		t.Errorf("best field vs defensive batting = %s, want attack", got)
	}
	if got := bestBat(FieldAttack); got != ApproachAttack {
		t.Errorf("best batting vs attacking field = %s, want attack", got)
	}
	// Balanced batting is the safe hedge: its worst case beats the others' worst case.
	worst := func(a Approach) float64 {
		w := math.MaxFloat64
		for _, f := range []FieldPlan{FieldDefend, FieldBalanced, FieldAttack} {
			w = math.Min(w, cell(m, a, f).Runs)
		}
		return w
	}
	if !(worst(ApproachBalanced) > worst(ApproachAttack) && worst(ApproachBalanced) > worst(ApproachDefend)) {
		t.Errorf("balanced should have the best worst case: bal=%.1f att=%.1f def=%.1f",
			worst(ApproachBalanced), worst(ApproachAttack), worst(ApproachDefend))
	}
	// Equal sides on balanced plans stay near the documented par.
	if r := cell(m, ApproachBalanced, FieldBalanced).Runs; math.Abs(r-float64(PitchByCode(PitchBalanced).Par)) > 2.5 {
		t.Errorf("balanced vs balanced %.1f drifted from par %d", r, PitchByCode(PitchBalanced).Par)
	}
}

// A weaker side that reads the opponent's plan should win far more often than
// one that doesn't, while a much stronger side should still be favoured.
func TestCounterPlanHelpsUnderdog(t *testing.T) {
	if testing.Short() {
		t.Skip()
	}
	steady := Tactics{
		BatApproach: []Approach{ApproachBalanced, ApproachBalanced, ApproachAttack},
		FieldPlan:   []FieldPlan{FieldAttack, FieldBalanced, FieldBalanced, FieldBalanced, FieldDefend},
	}
	counter := Tactics{
		BatApproach: []Approach{ApproachAttack, ApproachAttack, ApproachDefend},
		FieldPlan:   []FieldPlan{FieldDefend, FieldDefend, FieldDefend, FieldDefend, FieldDefend},
	}
	rate := func(weakPlan Tactics, gap int) float64 {
		strong := makeXI("s", gap)
		strong.Tactics = steady
		weak := makeXI("w", 0)
		weak.Tactics = weakPlan
		wins, n := 0, 2500
		for i := 0; i < n; i++ {
			r, err := Simulate(int64(50000+i), weak, strong, TossResult{})
			if err != nil {
				t.Fatal(err)
			}
			if r.Winner == "home" {
				wins++
			}
		}
		return float64(wins) / float64(n)
	}
	balanced := Tactics{
		BatApproach: []Approach{ApproachBalanced, ApproachBalanced, ApproachBalanced},
		FieldPlan:   []FieldPlan{FieldBalanced, FieldBalanced, FieldBalanced, FieldBalanced, FieldBalanced},
	}
	plain, smart := rate(balanced, 10), rate(counter, 10)
	t.Logf("weak vs +10: balanced plan %.1f%%, counter plan %.1f%%", plain*100, smart*100)
	if smart-plain < 0.10 {
		t.Errorf("counter plan should add at least 10pp for the underdog (got %.1f -> %.1f)", plain*100, smart*100)
	}
	if smart >= 0.5 {
		t.Errorf("a 10-point stronger side should still be favoured (underdog won %.1f%%)", smart*100)
	}
}

// Documented par scores must match what the engine actually produces.
func TestPitchPar(t *testing.T) {
	if testing.Short() {
		t.Skip()
	}
	for _, p := range Pitches {
		got := PitchPar(p.Code, 3000)
		t.Logf("%-8s par %d, measured %.1f", p.Code, p.Par, got)
		if math.Abs(got-float64(p.Par)) > 2.5 {
			t.Errorf("%s: documented par %d but measured %.1f", p.Code, p.Par, got)
		}
	}
}

func TestPitchForSeedIsStableAndVaried(t *testing.T) {
	seen := map[Pitch]int{}
	for i := int64(0); i < 1000; i++ {
		p := PitchForSeed(i * 7919)
		if PitchForSeed(i*7919) != p {
			t.Fatal("pitch must be deterministic")
		}
		seen[p]++
	}
	if len(seen) != len(Pitches) {
		t.Fatalf("expected all %d pitches, saw %v", len(Pitches), seen)
	}
	if seen[PitchBalanced] < seen[PitchGreen] {
		t.Errorf("balanced should be the most common pitch: %v", seen)
	}
}

func TestComputeBallFactors(t *testing.T) {
	weak := Odds(OddsRequest{BatterRating: 75, BatterVs: 50, BowlerRating: 75, BowlType: BowlSpin, Pressure: 4, Approach: ApproachAttack, Field: FieldDefend, Over: 2})
	names := map[string]bool{}
	for _, f := range weak.Factors {
		names[f.Name] = true
	}
	for _, want := range []string{"Batting: attack", "Field: defend", "Holing out", "Matchup: weak vs spin", "Pressure"} {
		if !names[want] {
			t.Errorf("missing factor %q in %v", want, weak.Factors)
		}
	}
	base := Odds(OddsRequest{BatterRating: 75, BowlerRating: 75, BowlType: BowlSpin, Over: 2})
	if weak.WicketChance <= base.WicketChance {
		t.Errorf("weakness+pressure+holing out should raise wicket chance: %.3f vs %.3f", weak.WicketChance, base.WicketChance)
	}
	sum := 0.0
	for _, p := range base.Odds {
		sum += p
	}
	if math.Abs(sum-1) > 1e-9 {
		t.Errorf("odds should sum to 1, got %f", sum)
	}
}

func TestSkillShiftFlattens(t *testing.T) {
	if SkillShift(0) != 0 || SkillShift(10) <= 0 || SkillShift(-10) >= 0 {
		t.Fatal("shift must follow the sign of the gap")
	}
	// Doubling a big gap should add much less than double the shift.
	if s20, s40 := SkillShift(20), SkillShift(40); s40 >= 2*s20 {
		t.Errorf("curve should flatten: shift(20)=%d shift(40)=%d", s20, s40)
	}
}

func TestValidateTactics(t *testing.T) {
	if err := ValidateTactics(Tactics{BatApproach: []Approach{"attack", "defend", "balanced"}, FieldPlan: []FieldPlan{"attack"}}); err != nil {
		t.Fatal(err)
	}
	if ValidateTactics(Tactics{BatApproach: []Approach{"yolo"}}) == nil {
		t.Error("unknown approach should fail")
	}
	if ValidateTactics(Tactics{FieldPlan: make([]FieldPlan, 6)}) == nil {
		t.Error("6 overs of field plan should fail")
	}
}
