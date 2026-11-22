package engine

import "math/rand"

// BaseWeights are the outcome weights before any adjustment (they sum to 100).
func BaseWeights() map[Outcome]int {
	w := baseWeights()
	return map[Outcome]int{
		OutcomeDot: w.dot, OutcomeOne: w.one, OutcomeTwo: w.two, OutcomeThree: w.three,
		OutcomeFour: w.four, OutcomeSix: w.six, OutcomeWicket: w.wicket,
		OutcomeWide: w.wide, OutcomeNoBall: w.noball,
	}
}

// MatrixCell is the measured result of one batting approach against one field.
type MatrixCell struct {
	Approach Approach  `json:"approach"`
	Field    FieldPlan `json:"field"`
	Runs     float64   `json:"runs"`
	Wickets  float64   `json:"wickets"`
}

// StrategyMatrix simulates n first innings between two identical average sides
// for every approach/field pairing, holding the plan for the whole innings.
func StrategyMatrix(n int) []MatrixCell {
	var out []MatrixCell
	for _, a := range []Approach{ApproachDefend, ApproachBalanced, ApproachAttack} {
		for _, f := range []FieldPlan{FieldDefend, FieldBalanced, FieldAttack} {
			bat, bowl := ReferenceXI("bat"), ReferenceXI("bowl")
			bat.Tactics = Tactics{BatApproach: []Approach{a, a, a}}
			bowl.Tactics = Tactics{FieldPlan: []FieldPlan{f, f, f, f, f}}
			runs, wk := 0, 0
			for i := 0; i < n; i++ {
				rng := rand.New(rand.NewSource(int64(i + 1)))
				inn, _ := measureInnings(rng, bat, bowl, PitchBalanced, false)
				runs += inn.Runs
				wk += inn.Wickets
			}
			out = append(out, MatrixCell{a, f, float64(runs) / float64(n), float64(wk) / float64(n)})
		}
	}
	return out
}

// PitchPar simulates n first innings on a pitch between two reference sides.
func PitchPar(p Pitch, n int) float64 {
	runs := 0
	for i := 0; i < n; i++ {
		rng := rand.New(rand.NewSource(int64(i + 1)))
		inn, _ := measureInnings(rng, ReferenceXI("a"), ReferenceXI("b"), p, true)
		runs += inn.Runs
	}
	return float64(runs) / float64(n)
}

// ReferenceXI is an average side (cards rated in the low 70s) used for
// measurements: three batters, a keeper, an all-rounder, one pacer and one spinner.
func ReferenceXI(prefix string) Lineup {
	bat := func(tech, power, timing, vp, vs, temp, run int) Attributes {
		return Attributes{
			Technique: tech, Power: power, Timing: timing, VsPace: vp, VsSpin: vs, Temperament: temp, Running: run,
			Accuracy: 30, Variation: 25, WicketTaking: 20, Movement: 20, DeathBowling: 20,
			Catching: 70, GroundField: 68, Throwing: 65, Keeping: 8, Stumping: 6, Reflexes: 8,
		}
	}
	bowl := func(acc, vari, wt, mov, death int) Attributes {
		return Attributes{
			Technique: 38, Power: 32, Timing: 35, VsPace: 36, VsSpin: 34, Temperament: 40, Running: 45,
			Accuracy: acc, Variation: vari, WicketTaking: wt, Movement: mov, DeathBowling: death,
			Catching: 62, GroundField: 64, Throwing: 70, Keeping: 6, Stumping: 4, Reflexes: 6,
		}
	}
	wk := bat(70, 68, 72, 70, 68, 74, 70)
	wk.Keeping, wk.Stumping, wk.Reflexes, wk.Catching = 80, 76, 78, 80
	ar := bat(72, 74, 70, 68, 70, 70, 72)
	ar.Accuracy, ar.Variation, ar.WicketTaking, ar.Movement, ar.DeathBowling = 72, 70, 68, 66, 70
	card := func(id string, role Role, bt BowlType, a Attributes) Card {
		return Card{ID: prefix + id, PlayerID: prefix + id, Name: prefix + " " + id, Role: role, BatHand: HandRight, BowlType: bt, Rarity: RarityGold, Level: 1, Attrs: a}
	}
	cards := []Card{
		card("b1", RoleBAT, BowlPace, bat(80, 70, 76, 78, 72, 74, 72)),
		card("b2", RoleBAT, BowlPace, bat(74, 82, 70, 70, 68, 70, 74)),
		card("b3", RoleBAT, BowlPace, bat(72, 76, 74, 72, 74, 72, 70)),
		card("wk", RoleWK, BowlPace, wk),
		card("ar", RoleAR, BowlPace, ar),
		card("p1", RoleBOWL, BowlPace, bowl(78, 74, 76, 72, 70)),
		card("s1", RoleBOWL, BowlSpin, bowl(74, 80, 72, 78, 64)),
	}
	return Lineup{UserID: prefix, Cards: cards, BattingOrder: DefaultBattingOrder(cards), BowlingPlan: DefaultBowlingPlan(cards), TossPref: "chase"}
}

// OddsRequest describes a hypothetical delivery for the public odds calculator.
// Ratings set every relevant attribute of a synthetic batter/bowler.
type OddsRequest struct {
	BatterRating int       `json:"batterRating"`
	BatterVs     int       `json:"batterVs"` // skill vs this bowling type; 0 = same as rating
	BowlerRating int       `json:"bowlerRating"`
	BowlType     BowlType  `json:"bowlType"`
	Approach     Approach  `json:"approach"`
	Field        FieldPlan `json:"field"`
	Pitch        Pitch     `json:"pitch"`
	Over         int       `json:"over"`    // 1-5
	Innings      int       `json:"innings"` // 1 or 2
	Pressure     int       `json:"pressure"`
	Wickets      int       `json:"wickets"`
	Need         int       `json:"need"` // runs needed (2nd innings only)
}

type OddsResult struct {
	Odds         map[Outcome]float64 `json:"odds"`
	Weights      map[Outcome]int     `json:"weights"`
	Factors      []Factor            `json:"factors"`
	SkillGap     float64             `json:"skillGap"`
	SkillShift   int                 `json:"skillShift"`
	RunsPerBall  float64             `json:"runsPerBall"`
	WicketChance float64             `json:"wicketChance"`
	Matchup      string              `json:"matchup,omitempty"`
}

func Odds(r OddsRequest) OddsResult {
	r.BatterRating = clamp(r.BatterRating, 30, 99)
	r.BowlerRating = clamp(r.BowlerRating, 30, 99)
	if r.BatterVs == 0 {
		r.BatterVs = r.BatterRating
	}
	r.BatterVs = clamp(r.BatterVs, 30, 99)
	r.Over = clamp(r.Over, 1, OversPerInnings)
	r.Pressure = clamp(r.Pressure, 0, PressureMax)
	r.Wickets = clamp(r.Wickets, 0, MaxWickets-1)
	if r.BowlType != BowlSpin {
		r.BowlType = BowlPace
	}
	b, o := r.BatterRating, r.BowlerRating
	striker := Card{ID: "bat", Name: "Batter", Role: RoleBAT, BatHand: HandRight, Level: 1,
		Attrs: Attributes{Technique: b, Power: b, Timing: b, VsPace: r.BatterVs, VsSpin: r.BatterVs, Temperament: b, Running: b}}
	bowler := Card{ID: "bowl", Name: "Bowler", Role: RoleBOWL, BowlType: r.BowlType, Level: 1,
		Attrs: Attributes{Accuracy: o, Variation: o, WicketTaking: o, Movement: o, DeathBowling: o}}
	in := BallInput{
		Striker: &striker, Bowler: &bowler,
		Over: r.Over - 1, Wickets: r.Wickets,
		Approach: r.Approach, Field: r.Field, Pressure: r.Pressure, Pitch: r.Pitch,
		Faced: 2,
	}
	if r.Innings == 2 {
		in.Innings = 1
		need := r.Need
		if need < 1 {
			need = 1
		}
		in.Target, in.Runs = need, 0
	}
	c := ComputeBall(in)
	if c.Factors == nil {
		c.Factors = []Factor{} // encode as [] rather than null
	}
	odds := c.Odds()
	rpb := odds[OutcomeOne] + 2*odds[OutcomeTwo] + 3*odds[OutcomeThree] + 4*odds[OutcomeFour] + 6*odds[OutcomeSix] + odds[OutcomeWide] + odds[OutcomeNoBall]
	return OddsResult{
		Odds: odds, Weights: c.Weights(), Factors: c.Factors,
		SkillGap: c.SkillGap, SkillShift: c.SkillShift,
		RunsPerBall: rpb, WicketChance: odds[OutcomeWicket], Matchup: c.Matchup,
	}
}

// measureInnings plays one first innings for measurement. With powerplay
// false the overs are played without fielding restrictions, which isolates the
// approach/field cycle; captains still decide whenever no fixed plan is given.
func measureInnings(rng *rand.Rand, bat, bowl Lineup, p Pitch, powerplay bool) (InningsResult, []BallEvent) {
	return playInnings(rng, &inningsCtx{
		innings: 0, batting: bat, bowling: bowl, batSide: "home", bowlSide: "away", target: -1, pitch: p,
		mem: newMemory(), overs: OversPerInnings, maxWickets: MaxWickets, noPowerplay: !powerplay,
	})
}
