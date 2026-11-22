package engine

import (
	"fmt"
	"math"
)

// BallInput is everything that decides the odds of a single delivery.
type BallInput struct {
	Striker, Bowler, Keeper *Card
	Innings, Over, Ball     int
	Wickets, Runs, Target   int // Target is 0 in the first innings
	Faced, Drops            int // balls the striker has faced; chances they've survived
	Approach                Approach
	Field                   FieldPlan
	Pressure                int // consecutive dot balls before this delivery
	Pitch                   Pitch
	Conditions              Conditions // second-innings twist ("" or clear = none)
	Powerplay               bool       // fielding restrictions: 2 fielders outside the ring
	FreeHit                 bool
	Link                    int // chemistry between striker and non-striker, 0-3
	CaptainCalm             int // batting captain's calm (0 means not set: treated as 50)
	Armband                 bool
	BatStroke, BowlStroke   *Masterstroke
	Rival                   bool // the bowler "has his number"
}

// Published effects of the match quirks.
var (
	// PowerplayEffect: only 2 fielders out, so gaps over the infield, and catchers in the ring.
	PowerplayEffect = WeightDelta{Four: 2, Six: 1, Wicket: 1}
	// FreeHitEffect: the batter swings freely; the wicket weight is also removed.
	FreeHitEffect = WeightDelta{Dot: -4, Four: 4, Six: 3}
	// RivalEdge applies when a bowler has dismissed this batter RivalDismissals+ times before.
	RivalEdge       = WeightDelta{Wicket: 1}
	RivalDismissals = 3
)

// Factor records one adjustment so the UI and docs can show the working.
type Factor struct {
	Name   string      `json:"name"`
	Effect WeightDelta `json:"effect"`
}

// BallCalc is the result: final weights plus the reasons behind them.
type BallCalc struct {
	w            weights
	sAttr, bAttr Attributes
	Triggered    []string
	TightChase   bool
	Pressure     int
	Matchup      string
	Counter      string
	SkillGap     float64
	SkillShift   int
	Factors      []Factor
}

// Odds converts the final weights into probabilities per outcome.
func (b BallCalc) Odds() map[Outcome]float64 {
	w := b.w
	parts := map[Outcome]int{
		OutcomeDot: w.dot, OutcomeOne: w.one, OutcomeTwo: w.two, OutcomeThree: w.three,
		OutcomeFour: w.four, OutcomeSix: w.six, OutcomeWicket: w.wicket,
		OutcomeWide: w.wide, OutcomeNoBall: w.noball,
	}
	total := 0
	for _, n := range parts {
		if n > 0 {
			total += n
		}
	}
	out := map[Outcome]float64{}
	for o, n := range parts {
		if n > 0 {
			out[o] = float64(n) / float64(total)
		} else {
			out[o] = 0
		}
	}
	return out
}

func (b BallCalc) Weights() map[Outcome]int {
	w := b.w
	return map[Outcome]int{
		OutcomeDot: w.dot, OutcomeOne: w.one, OutcomeTwo: w.two, OutcomeThree: w.three,
		OutcomeFour: w.four, OutcomeSix: w.six, OutcomeWicket: w.wicket,
		OutcomeWide: w.wide, OutcomeNoBall: w.noball,
	}
}

// SkillShift is how many weight points a batter-vs-bowler skill gap is worth.
func SkillShift(gap float64) int {
	return int(math.Round(SkillCurveScale * math.Tanh(gap/SkillCurveWidth)))
}

// ComputeBall builds the outcome weights for one delivery. It is pure: the
// simulation rolls the dice on its result, and the odds API calls it directly.
func ComputeBall(in BallInput) BallCalc {
	striker, bowler, wk := in.Striker, in.Bowler, in.Keeper
	pitch := PitchByCode(in.Pitch)
	var calc BallCalc
	note := func(name string, d WeightDelta) { calc.Factors = append(calc.Factors, Factor{name, d}) }

	sAttr := Effective(*striker)
	bAttr := Effective(*bowler)

	chasing := in.Target > 0
	ballsLeft := (OversPerInnings-in.Over)*BallsPerOver - in.Ball
	if ballsLeft < 1 {
		ballsLeft = 1
	}
	rrr := 0.0
	if chasing {
		rrr = float64(in.Target-in.Runs) / (float64(ballsLeft) / 6.0)
	}
	tightChase := chasing && rrr > 12
	lastOver := in.Over == OversPerInnings-1

	// 1. Traits adjust attributes.
	bt := applyBatterTraits(*striker, in.Over, in.Wickets, chasing)
	bo := applyBowlerTraits(*bowler, in.Over, in.Faced, tightChase)
	var triggered []string
	triggered = append(triggered, bt.triggered...)
	triggered = append(triggered, bo.triggered...)
	sAttr.Power = clamp(sAttr.Power+bt.power, 1, 99)
	sAttr.Temperament = clamp(sAttr.Temperament+bt.temp, 1, 99)
	if in.Armband {
		sAttr.Temperament = clamp(sAttr.Temperament+Captain.ArmbandTemp, 1, 99)
		triggered = append(triggered, "Captain's armband")
	}
	if in.BatStroke != nil && in.BatStroke.TempBoost > 0 {
		sAttr.Temperament = clamp(sAttr.Temperament+in.BatStroke.TempBoost, 1, 99)
	}
	bAttr.Accuracy = clamp(bAttr.Accuracy+bo.bowlAcc, 1, 99)
	bAttr.Variation = clamp(bAttr.Variation+bo.varExtra, 1, 99)
	bAttr.DeathBowling = clamp(bAttr.DeathBowling+bo.death, 1, 99)
	if wk != nil && HasTrait(*wk, "Keeper-Captain") {
		bAttr.Accuracy = clamp(bAttr.Accuracy+3, 1, 99)
		triggered = append(triggered, "Keeper-Captain")
	}
	if HasTrait(*striker, "Spin Basher") && bowler.BowlType == BowlSpin {
		sAttr.VsSpin = clamp(sAttr.VsSpin+8, 1, 99)
		triggered = append(triggered, "Spin Basher")
	}
	if HasTrait(*striker, "Pace Basher") && bowler.BowlType == BowlPace {
		sAttr.VsPace = clamp(sAttr.VsPace+8, 1, 99)
		triggered = append(triggered, "Pace Basher")
	}

	// 2. Skill ratings, including pitch conditions.
	vs := sAttr.VsPace
	if bowler.BowlType == BowlSpin {
		vs = sAttr.VsSpin
	}
	bSkill := float64(sAttr.Technique)*0.5 + float64(sAttr.Power)*0.3 + float64(vs)*0.2
	oSkill := float64(bAttr.Accuracy)*0.4 + float64(bAttr.Variation)*0.3 + float64(bAttr.WicketTaking)*0.3
	if lastOver || tightChase {
		oSkill += float64(bAttr.DeathBowling) * 0.15
	}
	bSkill += float64(pitch.BatterBonus)
	if bowler.BowlType == BowlPace {
		oSkill += float64(pitch.PaceBonus)
	} else {
		oSkill += float64(pitch.SpinBonus)
		if in.Innings >= 1 {
			oSkill += float64(pitch.SpinWearBonus)
		}
	}
	if in.Innings >= 1 {
		cd := ConditionsByCode(in.Conditions)
		bSkill += float64(cd.BatterBonus)
		if bowler.BowlType == BowlPace {
			oSkill += float64(cd.PaceBonus)
		} else {
			oSkill += float64(cd.SpinBonus)
		}
	}
	delta := bSkill - oSkill

	// 3. Base weights, bowler accuracy, then the skill gap.
	w := baseWeights()
	accShift := (bAttr.Accuracy - 70) / 8
	w.wide = clamp(w.wide-accShift, 1, 8)
	w.noball = clamp(w.noball-accShift/2, 0, 4)
	w.dot += accShift

	shift := SkillShift(delta)
	calc.SkillGap, calc.SkillShift = delta, shift
	w.four = clamp(w.four+shift, 4, 22)
	w.six = clamp(w.six+shift/2, 2, 16)
	w.one = clamp(w.one+shift/4, 18, 38)
	w.dot = clamp(w.dot-shift, 14, 42)
	w.wicket = clamp(w.wicket-shift/2, 3, 14)

	// 4. Batter attributes and match situation.
	if sAttr.Power > 75 {
		w.six += (sAttr.Power - 75) / 8
		w.four += (sAttr.Power - 75) / 12
	}
	if sAttr.Timing > 70 {
		w.one += (sAttr.Timing - 70) / 6
		w.dot = clamp(w.dot-(sAttr.Timing-70)/8, 12, 40)
	}
	if in.Faced >= 4 {
		w.wicket = clamp(w.wicket-2, 2, 14)
		w.one += 2
	}
	if in.Drops > 0 {
		w.wicket = clamp(w.wicket-1, 2, 14)
	}
	if tightChase || lastOver {
		w.four += 3
		w.six += 3
		w.wicket += 2
		w.dot = clamp(w.dot-4, 10, 40)
	}
	if chasing && rrr > 10 {
		agg := int(math.Min(8, (rrr-10)*1.2))
		w.four += agg
		w.six += agg / 2
		w.wicket += agg / 2
	}
	if in.Wickets >= 4 {
		w.wicket = clamp(w.wicket-1, 2, 14)
	}
	if tightChase || lastOver || in.Wickets >= 3 {
		t := (sAttr.Temperament - 70) / 8
		w.wicket = clamp(w.wicket-t, 2, 14)
		w.one += t
	}
	if striker.BatHand == HandLeft {
		w.wide++
	}

	// 5. Strategy: batting approach, field setting, and how they interact.
	if d, ok := ApproachEffects[in.Approach]; ok {
		w.add(d)
		note("Batting: "+string(in.Approach), d)
	}
	if d, ok := FieldEffects[in.Field]; ok {
		if in.Powerplay && in.Field == FieldDefend {
			d = halve(d) // only 2 fielders allowed outside the ring
		}
		w.add(d)
		note("Field: "+string(in.Field), d)
	}
	app, fld := in.Approach, in.Field
	if app == "" {
		app = ApproachBalanced
	}
	if fld == "" {
		fld = FieldBalanced
	}
	if c := counterFor(app, fld); c != nil {
		eff := c.Effect
		if in.Powerplay && fld == FieldDefend {
			eff = halve(eff) // fewer sweepers to catch the lofted shots
		}
		w.add(eff)
		calc.Counter = c.Name
		note(c.Name, eff)
	}
	if in.Powerplay {
		w.add(PowerplayEffect)
		note("Powerplay", PowerplayEffect)
	}

	// 6. Matchup: batter's skill against this bowling type.
	kind := "pace"
	if bowler.BowlType == BowlSpin {
		kind = "spin"
	}
	if vs < MatchupWeakBelow {
		w.add(MatchupWeakEffect)
		calc.Matchup = "weak vs " + kind
		note("Matchup: weak vs "+kind, MatchupWeakEffect)
	} else if vs >= MatchupStrongAtLeast {
		w.add(MatchupStrongEffect)
		calc.Matchup = "strong vs " + kind
		note("Matchup: strong vs "+kind, MatchupStrongEffect)
	}

	// 7. Dot-ball pressure. Composed batters (high temperament) and calm captains resist it.
	startsAt := PressureStartsAt
	if in.BowlStroke != nil && in.BowlStroke.EarlyPress {
		startsAt = 1
	}
	noPressure := in.BatStroke != nil && in.BatStroke.NoPressure
	calm := in.CaptainCalm
	if calm == 0 {
		calm = 50
	}
	if in.Pressure >= startsAt && !noPressure {
		p := in.Pressure
		if p > PressureMax {
			p = PressureMax
		}
		extra := p - startsAt + 1 - (sAttr.Temperament-60)/15 - (calm-50)/Captain.CalmDivisor
		if extra > 0 {
			d := WeightDelta{Wicket: extra, One: 1}
			w.add(d)
			note("Pressure", d)
		}
		calc.Pressure = p
	}

	// 8. Chemistry, rivalry and masterstrokes.
	if in.Link > 0 {
		d := WeightDelta{One: in.Link * Chemistry.SinglesPerLink, Dot: -in.Link * Chemistry.DotsPerLink}
		w.add(d)
		note(fmt.Sprintf("Chemistry %d", in.Link), d)
	}
	if in.Rival {
		w.add(RivalEdge)
		note("Has his number", RivalEdge)
	}
	for _, m := range []*Masterstroke{in.BatStroke, in.BowlStroke} {
		if m != nil {
			w.add(m.Effect)
			note("Masterstroke: "+m.Name, m.Effect)
		}
	}
	if in.FreeHit {
		w.add(FreeHitEffect)
		note("Free hit", FreeHitEffect)
	}

	// 9. Trait multipliers and floors.
	w.four = int(float64(w.four) * bt.boundMul)
	w.six = int(float64(w.six) * bt.boundMul * bo.sixMul)
	w.wicket = int(float64(w.wicket) * bt.wicketMul * bo.wicketMul)
	if w.dot < 1 {
		w.dot = 1
	}
	if w.one < 1 {
		w.one = 1
	}
	if w.two < 0 {
		w.two = 0
	}
	if w.four < 1 {
		w.four = 1
	}
	if w.six < 1 {
		w.six = 1
	}
	if w.wicket < 1 {
		w.wicket = 1
	}
	if in.FreeHit {
		w.wicket = 0 // only a run-out can end a free hit
	}

	calc.w, calc.sAttr, calc.bAttr = w, sAttr, bAttr
	calc.Triggered, calc.TightChase = triggered, tightChase
	return calc
}

func halve(d WeightDelta) WeightDelta {
	return WeightDelta{Dot: d.Dot / 2, One: d.One / 2, Two: d.Two / 2, Four: d.Four / 2, Six: d.Six / 2, Wicket: d.Wicket / 2}
}
