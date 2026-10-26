package engine

import (
	"fmt"
	"math"
	"math/rand"
)

const (
	OversPerInnings = 5
	BallsPerOver    = 6
	MaxWickets      = 6
)

type weights struct {
	dot, one, two, three, four, six, wicket, wide, noball int
}

func baseWeights() weights {
	return weights{dot: 32, one: 30, two: 8, three: 1, four: 12, six: 7, wicket: 6, wide: 3, noball: 1}
}

func Simulate(seed int64, home, away Lineup, toss TossResult) (MatchResult, error) {
	if err := ValidateLineup(home); err != nil {
		return MatchResult{}, fmt.Errorf("home lineup: %w", err)
	}
	if err := ValidateLineup(away); err != nil {
		return MatchResult{}, fmt.Errorf("away lineup: %w", err)
	}
	rng := rand.New(rand.NewSource(seed))
	if toss.WinnerSide == "" {
		if rng.Intn(2) == 0 {
			toss.WinnerSide = "home"
			toss.Decision = home.TossPref
		} else {
			toss.WinnerSide = "away"
			toss.Decision = away.TossPref
		}
	}
	if toss.Decision == "" {
		toss.Decision = "chase"
	}

	var first, second Lineup
	var firstSide, secondSide string
	winnerBatsFirst := toss.Decision == "bat"
	if (toss.WinnerSide == "home" && winnerBatsFirst) || (toss.WinnerSide == "away" && !winnerBatsFirst) {
		first, second = home, away
		firstSide, secondSide = "home", "away"
	} else {
		first, second = away, home
		firstSide, secondSide = "away", "home"
	}

	res := MatchResult{Toss: toss}
	inn1, balls1 := playInnings(rng, 0, first, second, firstSide, secondSide, -1)
	res.Innings[0] = inn1
	res.Balls = append(res.Balls, balls1...)
	target := inn1.Runs + 1
	inn2, balls2 := playInnings(rng, 1, second, first, secondSide, firstSide, target)
	res.Innings[1] = inn2
	res.Balls = append(res.Balls, balls2...)

	res.Winner, res.Margin = decide(firstSide, secondSide, inn1, inn2)
	res.POTM = playerOfMatch(res, home, away)
	return res, nil
}

func decide(firstSide, secondSide string, a, b InningsResult) (string, string) {
	if b.Runs > a.Runs {
		wktsLeft := MaxWickets - b.Wickets
		return secondSide, fmt.Sprintf("won by %d wicket%s", wktsLeft, plural(wktsLeft))
	}
	if a.Runs > b.Runs {
		margin := a.Runs - b.Runs
		return firstSide, fmt.Sprintf("won by %d run%s", margin, plural(margin))
	}
	return "tie", "match tied"
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}

func playInnings(rng *rand.Rand, innings int, batting, bowling Lineup, batSide, bowlSide string, target int) (InningsResult, []BallEvent) {
	order := make([]*Card, 0, 7)
	for _, id := range batting.BattingOrder {
		order = append(order, CardByID(batting.Cards, id))
	}
	striker, non := order[0], order[1]
	nextBat := 2
	wkts := 0
	runs := 0
	legalBalls := 0
	byes, wides, nbs := 0, 0, 0
	seq := 0

	batStats := map[string]*BatterScore{}
	bowlStats := map[string]*BowlerScore{}
	fieldStats := map[string]*FielderScore{}
	for _, c := range batting.Cards {
		cc := c
		batStats[c.ID] = &BatterScore{CardID: c.ID, NotOut: true}
		_ = cc
	}
	for _, c := range bowling.Cards {
		bowlStats[c.ID] = &BowlerScore{CardID: c.ID}
		fieldStats[c.ID] = &FielderScore{CardID: c.ID, IsKeeper: c.Role == RoleWK}
	}

	var events []BallEvent
	ballsFaced := map[string]int{}
	reprieve := map[string]int{}

	for over := 0; over < OversPerInnings && wkts < MaxWickets; over++ {
		if target > 0 && runs >= target {
			break
		}
		bowler := CardByID(bowling.Cards, bowling.BowlingPlan[over])
		legalInOver := 0
		for legalInOver < BallsPerOver && wkts < MaxWickets {
			if target > 0 && runs >= target {
				break
			}
			ev := resolveBall(rng, innings, over, legalInOver, seq, striker, non, bowler, batting, bowling, wkts, runs, target, ballsFaced[striker.ID], reprieve[striker.ID])
			ev.Score = runs + ev.Runs
			if ev.Dismissal != nil {
				ev.Wickets = wkts + 1
			} else {
				ev.Wickets = wkts
			}
			events = append(events, ev)
			seq++

			bs := batStats[striker.ID]
			bo := bowlStats[bowler.ID]
			if ev.Legal {
				legalInOver++
				legalBalls++
				bs.Balls++
				ballsFaced[striker.ID]++
				bo.Balls++
			}
			runs += ev.Runs
			bo.Runs += ev.Runs
			switch ev.Extras.Type {
			case ExtraWide:
				wides += ev.Extras.Runs
			case ExtraNoBall:
				nbs += ev.Extras.Runs
			case ExtraBye:
				byes += ev.Extras.Runs
			}
			if ev.Outcome == OutcomeFour {
				bs.Fours++
				bs.Runs += ev.Runs
			} else if ev.Outcome == OutcomeSix {
				bs.Sixes++
				bs.Runs += ev.Runs
			} else if ev.Legal && ev.Dismissal == nil && ev.Extras.Type != ExtraBye {
				bs.Runs += ev.Runs
			} else if ev.Legal && ev.Dismissal == nil && ev.Extras.Type == ExtraBye {
				// byes don't add to batter
			} else if ev.Dismissal == nil && ev.Legal {
				bs.Runs += ev.Runs
			}

			if ev.FieldingSave {
				if ev.Shot.Zone != ZonePitch && ev.Shot.Zone != ZoneWicketKeep {
					if f := ZoneFielder(bowling.Cards, bowler.ID, ev.Shot.Zone); f != nil {
						fieldStats[f.ID].RunsSaved++
					}
				}
			}
			if ev.Chance != nil {
				fs := fieldStats[ev.Chance.FielderID]
				if fs != nil {
					if ev.Chance.Converted {
						switch ev.Chance.Type {
						case ChanceCaught, ChanceCaughtBehind, ChanceCaughtBowled:
							fs.Catches++
						case ChanceStumped:
							fs.Stumpings++
						}
					} else {
						fs.Drops++
						reprieve[striker.ID]++
					}
				}
			}
			if ev.Dismissal != nil {
				if ev.Dismissal.Type == DismissRunOut && ev.Dismissal.FielderID != "" {
					if fs := fieldStats[ev.Dismissal.FielderID]; fs != nil {
						fs.RunOuts++
					}
				}
				if ev.Dismissal.Type != DismissRunOut {
					bo.Wickets++
				}
				bs.Dismissal = ev.Dismissal
				bs.NotOut = false
				wkts++
				if nextBat < len(order) && wkts < MaxWickets {
					striker = order[nextBat]
					nextBat++
				} else {
					striker = nil
				}
			} else {
				rotate := ev.Runs%2 == 1
				if rotate && striker != nil {
					striker, non = non, striker
				}
			}
		}
		if striker != nil && non != nil {
			striker, non = non, striker
		}
	}

	inn := InningsResult{
		BattingSide: batSide,
		BowlingSide: bowlSide,
		Runs:        runs,
		Wickets:     wkts,
		Balls:       legalBalls,
		Byes:        byes,
		Wides:       wides,
		NoBalls:     nbs,
		Declared:    wkts >= MaxWickets,
	}
	for _, id := range batting.BattingOrder {
		if s := batStats[id]; s != nil {
			inn.Batters = append(inn.Batters, *s)
		}
	}
	for _, id := range bowling.BowlingPlan {
		if s := bowlStats[id]; s != nil && !containsBowler(inn.Bowlers, id) {
			s.Overs = float64(s.Balls/6) + float64(s.Balls%6)/10
			inn.Bowlers = append(inn.Bowlers, *s)
		}
	}
	// WK first in fielding table
	if wk := Keeper(bowling.Cards); wk != nil {
		if s := fieldStats[wk.ID]; s != nil {
			inn.Fielders = append(inn.Fielders, *s)
		}
	}
	for _, c := range bowling.Cards {
		if c.Role == RoleWK {
			continue
		}
		if s := fieldStats[c.ID]; s != nil {
			inn.Fielders = append(inn.Fielders, *s)
		}
	}
	return inn, events
}

func containsBowler(bs []BowlerScore, id string) bool {
	for _, b := range bs {
		if b.CardID == id {
			return true
		}
	}
	return false
}

func resolveBall(rng *rand.Rand, innings, over, ball, seq int, striker, non, bowler *Card, batting, bowling Lineup, wkts, runs, target, faced, drops int) BallEvent {
	ev := BallEvent{
		Innings: innings, Over: over, Ball: ball, Seq: seq,
		BowlerID: bowler.ID, StrikerID: striker.ID,
		Legal: true,
	}
	if non != nil {
		ev.NonStrikerID = non.ID
	}

	sAttr := Effective(*striker)
	bAttr := Effective(*bowler)
	wk := Keeper(bowling.Cards)

	chasing := target > 0
	ballsLeft := (OversPerInnings-over)*BallsPerOver - ball
	if ballsLeft < 1 {
		ballsLeft = 1
	}
	need := 0
	rrr := 0.0
	if chasing {
		need = target - runs
		rrr = float64(need) / (float64(ballsLeft) / 6.0)
	}
	tightChase := chasing && rrr > 12
	lastOver := over == OversPerInnings-1

	bt := applyBatterTraits(*striker, over, wkts, chasing)
	bo := applyBowlerTraits(*bowler, over, faced, tightChase)
	var triggered []string
	triggered = append(triggered, bt.triggered...)
	triggered = append(triggered, bo.triggered...)

	sAttr.Power = clamp(sAttr.Power+bt.power, 1, 99)
	sAttr.Temperament = clamp(sAttr.Temperament+bt.temp, 1, 99)
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

	delta := BatterSkill(*striker, bowler.BowlType) - BowlerSkill(*bowler)
	// rebuild skill with modified attrs
	vs := sAttr.VsPace
	if bowler.BowlType == BowlSpin {
		vs = sAttr.VsSpin
	}
	bSkill := float64(sAttr.Technique)*0.5 + float64(sAttr.Power)*0.3 + float64(vs)*0.2
	oSkill := float64(bAttr.Accuracy)*0.4 + float64(bAttr.Variation)*0.3 + float64(bAttr.WicketTaking)*0.3
	if lastOver || tightChase {
		oSkill += float64(bAttr.DeathBowling) * 0.15
	}
	delta = bSkill - oSkill

	w := baseWeights()
	// accuracy: fewer extras, more dots
	accShift := (bAttr.Accuracy - 70) / 8
	w.wide = clamp(w.wide-accShift, 1, 8)
	w.noball = clamp(w.noball-accShift/2, 0, 4)
	w.dot += accShift

	shift := int(delta / 3)
	w.four = clamp(w.four+shift, 4, 22)
	w.six = clamp(w.six+shift/2, 2, 16)
	w.one = clamp(w.one+shift/4, 18, 38)
	w.dot = clamp(w.dot-shift, 14, 42)
	w.wicket = clamp(w.wicket-shift/2, 3, 14)

	if sAttr.Power > 75 {
		w.six += (sAttr.Power - 75) / 8
		w.four += (sAttr.Power - 75) / 12
	}
	if sAttr.Timing > 70 {
		w.one += (sAttr.Timing - 70) / 6
		w.dot = clamp(w.dot-(sAttr.Timing-70)/8, 12, 40)
	}
	if faced >= 4 {
		w.wicket = clamp(w.wicket-2, 2, 14)
		w.one += 2
	}
	if drops > 0 {
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
	if wkts >= 4 {
		w.wicket = clamp(w.wicket-1, 2, 14)
	}
	// temperament under pressure
	if tightChase || lastOver || wkts >= 3 {
		t := (sAttr.Temperament - 70) / 8
		w.wicket = clamp(w.wicket-t, 2, 14)
		w.one += t
	}
	if striker.BatHand == HandLeft {
		w.wide++
	}

	w.four = int(float64(w.four) * bt.boundMul)
	w.six = int(float64(w.six) * bt.boundMul * bo.sixMul)
	w.wicket = int(float64(w.wicket) * bt.wicketMul * bo.wicketMul)
	if w.four < 1 {
		w.four = 1
	}
	if w.six < 1 {
		w.six = 1
	}
	if w.wicket < 1 {
		w.wicket = 1
	}

	out := pickOutcome(rng, w)
	ev.Outcome = out
	ev.TraitsTriggered = unique(triggered)

	switch out {
	case OutcomeWide:
		ev.Legal = false
		ev.Runs = 1
		ev.Extras = Extras{Type: ExtraWide, Runs: 1}
		ev.Shot = Shot{Zone: ZoneFineLeg, Angle: 20, Distance: 0.15}
		ev.Commentary = commentWide(striker, bowler)
		return ev
	case OutcomeNoBall:
		ev.Legal = false
		ev.Runs = 1
		ev.Extras = Extras{Type: ExtraNoBall, Runs: 1}
		ev.Shot = Shot{Zone: ZonePitch, Distance: 0.1}
		ev.Commentary = commentNoBall(striker, bowler)
		return ev
	}

	// byes on a miss
	keep := 55
	if wk != nil {
		keep = Effective(*wk).Keeping
	}
	byeChance := (100 - keep) / 5
	if bowler.BowlType == BowlPace && bAttr.Movement > 75 {
		byeChance += 3
	}
	if (out == OutcomeDot || out == OutcomeOne) && rng.Intn(100) < byeChance {
		br := 1
		if rng.Intn(100) < 20 {
			br = 2 + rng.Intn(3)
		}
		ev.Outcome = OutcomeBye
		ev.Runs = br
		ev.Extras = Extras{Type: ExtraBye, Runs: br}
		ev.Shot = Shot{Zone: ZoneFineLeg, Angle: 10, Distance: 0.25 + float64(br)*0.1}
		ev.Commentary = commentByes(striker, bowler, wk, br)
		return ev
	}

	if out == OutcomeWicket {
		return resolveWicketChance(rng, ev, striker, bowler, batting, bowling, wk, bAttr, sAttr, tightChase)
	}

	runsScored := 0
	switch out {
	case OutcomeDot:
		runsScored = 0
	case OutcomeOne:
		runsScored = 1
	case OutcomeTwo:
		runsScored = 2
	case OutcomeThree:
		runsScored = 3
	case OutcomeFour:
		runsScored = 4
	case OutcomeSix:
		runsScored = 6
	}

	// running upgrade
	if runsScored == 1 && sAttr.Running > 78 && rng.Intn(100) < (sAttr.Running-78)*2 {
		runsScored = 2
		ev.Outcome = OutcomeTwo
	} else if runsScored == 2 && sAttr.Running > 82 && rng.Intn(100) < (sAttr.Running-82)*2 {
		runsScored = 3
		ev.Outcome = OutcomeThree
	}

	zone := pickZone(rng, out, striker.BatHand)
	aerial := out == OutcomeSix || (out == OutcomeFour && rng.Float64() < 0.25)
	dist := shotDistance(out, aerial)
	if out == OutcomeDot {
		if rng.Float64() < 0.35 {
			ev.Shot = Shot{Zone: ZonePitch, Angle: 0, Distance: 0.05, Leave: true}
		} else {
			ev.Shot = Shot{Zone: zone, Angle: zoneAngle(zone), Distance: 0.22, Aerial: false}
		}
	} else {
		ev.Shot = Shot{Zone: zone, Angle: zoneAngle(zone) + rng.Float64()*12 - 6, Aerial: aerial, Distance: dist}
	}

	// ground fielding save
	if (runsScored == 4 || runsScored == 2) && !aerial {
		f := ZoneFielder(bowling.Cards, bowler.ID, zone)
		if f != nil {
			gf := Effective(*f).GroundField
			if runsScored == 4 && rng.Intn(100) < (gf-60)/5 {
				runsScored = 2 + rng.Intn(2) // 2 or 3
				ev.FieldingSave = true
				if runsScored == 2 {
					ev.Outcome = OutcomeTwo
				} else {
					ev.Outcome = OutcomeThree
				}
				ev.Commentary = commentSave(striker, bowler, f, runsScored)
				ev.Runs = runsScored
				return ev
			}
			if runsScored == 2 && rng.Intn(100) < (gf-65)/6 {
				runsScored = 1
				ev.Outcome = OutcomeOne
				ev.FieldingSave = true
				ev.Commentary = commentSave(striker, bowler, f, 1)
				ev.Runs = 1
				return ev
			}
		}
	}

	// run out check
	if runsScored >= 1 && runsScored <= 3 {
		if d := tryRunOut(rng, striker, non, bowler, bowling, zone, runsScored, tightChase, wk); d != nil {
			ev.Outcome = OutcomeWicket
			ev.Dismissal = d
			ev.Runs = runsScored - 1
			if ev.Runs < 0 {
				ev.Runs = 0
			}
			ev.Commentary = commentRunOut(striker, d)
			return ev
		}
	}

	ev.Runs = runsScored
	ev.Commentary = commentRuns(striker, bowler, ev)
	return ev
}

func resolveWicketChance(rng *rand.Rand, ev BallEvent, striker, bowler *Card, batting, bowling Lineup, wk *Card, bAttr, sAttr Attributes, aggressive bool) BallEvent {
	kind := pickDismissalKind(rng, bowler.BowlType, bAttr.Movement, aggressive)
	var fielder *Card
	var ctype ChanceType
	converted := true

	switch kind {
	case DismissBowled, DismissLBW:
		converted = true
		ev.Shot = Shot{Zone: ZonePitch, Distance: 0.08}
	case DismissCaughtWK:
		ctype = ChanceCaughtBehind
		fielder = wk
		ev.Shot = Shot{Zone: ZoneWicketKeep, Angle: -5, Aerial: true, Distance: 0.18}
	case DismissStumped:
		ctype = ChanceStumped
		fielder = wk
		ev.Shot = Shot{Zone: ZoneWicketKeep, Distance: 0.12}
	case DismissCaughtBowl:
		ctype = ChanceCaughtBowled
		fielder = bowler
		ev.Shot = Shot{Zone: ZonePitch, Aerial: true, Distance: 0.2}
	default:
		kind = DismissCaught
		ctype = ChanceCaught
		z := pickZone(rng, OutcomeFour, striker.BatHand)
		fielder = ZoneFielder(bowling.Cards, bowler.ID, z)
		ev.Shot = Shot{Zone: z, Angle: zoneAngle(z), Aerial: true, Distance: 0.72}
	}

	if fielder != nil && ctype != "" {
		fm := applyFielderTraits(*fielder, ctype)
		ev.TraitsTriggered = unique(append(ev.TraitsTriggered, fm.triggered...))
		a := Effective(*fielder)
		rate := 0
		switch ctype {
		case ChanceCaughtBehind:
			rate = (a.Keeping*60 + a.Reflexes*40) / 100
			if bowler.BowlType == BowlPace {
				rate = (a.Keeping*40 + a.Reflexes*60) / 100
			}
			rate = int(float64(rate) * fm.catchMul)
		case ChanceStumped:
			rate = a.Stumping
			rate = int(float64(rate) * fm.stumpMul)
		case ChanceCaught, ChanceCaughtBowled:
			rate = a.Catching
			rate = int(float64(rate) * fm.catchMul)
		}
		// conversion curve: 60 -> 52%, 90 -> 88%
		conv := 16 + (rate*4)/5
		if rng.Intn(100) >= conv {
			converted = false
		} else {
			converted = true
		}
		fid := fielder.ID
		ev.Chance = &Chance{Type: ctype, FielderID: fid, Converted: converted}
	}

	if !converted {
		// dropped / missed
		if rng.Float64() < 0.45 {
			ev.Outcome = OutcomeOne
			ev.Runs = 1
		} else {
			ev.Outcome = OutcomeDot
			ev.Runs = 0
		}
		ev.Commentary = commentDrop(striker, bowler, fielder, ctype)
		return ev
	}

	ev.Outcome = OutcomeWicket
	ev.Runs = 0
	d := &Dismissal{Type: kind, BowlerID: bowler.ID}
	if fielder != nil && kind != DismissBowled && kind != DismissLBW {
		d.FielderID = fielder.ID
	}
	d.Text = dismissalText(kind, bowler, fielder)
	ev.Dismissal = d
	ev.Commentary = commentWicket(striker, bowler, d)
	return ev
}

func pickDismissalKind(rng *rand.Rand, bt BowlType, movement int, aggressive bool) DismissalType {
	type pair struct {
		k DismissalType
		w int
	}
	var ps []pair
	if bt == BowlPace {
		ps = []pair{{DismissBowled, 18}, {DismissLBW, 14}, {DismissCaughtWK, 30}, {DismissCaught, 32}, {DismissCaughtBowl, 6}}
	} else {
		ps = []pair{{DismissBowled, 16}, {DismissLBW, 10}, {DismissStumped, 20}, {DismissCaughtWK, 12}, {DismissCaught, 36}, {DismissCaughtBowl, 6}}
	}
	if movement > 75 {
		for i := range ps {
			if ps[i].k == DismissCaughtWK {
				ps[i].w += 8
			}
		}
	}
	if aggressive {
		for i := range ps {
			if ps[i].k == DismissCaught {
				ps[i].w += 8
			}
		}
	}
	total := 0
	for _, p := range ps {
		total += p.w
	}
	r := rng.Intn(total)
	acc := 0
	for _, p := range ps {
		acc += p.w
		if r < acc {
			return p.k
		}
	}
	return DismissCaught
}

func tryRunOut(rng *rand.Rand, striker, non, bowler *Card, bowling Lineup, zone Zone, runs int, tight bool, wk *Card) *Dismissal {
	f := ZoneFielder(bowling.Cards, bowler.ID, zone)
	if f == nil {
		return nil
	}
	fa := Effective(*f)
	sa := Effective(*striker)
	risk := 1
	risk += (fa.Throwing + fa.GroundField) / 80
	risk -= sa.Running / 40
	if runs == 3 {
		risk += 4
	}
	if tight {
		risk += 2
	}
	if HasTrait(*f, "Rocket Arm") {
		risk = int(float64(risk) * 1.15)
	}
	if risk < 1 {
		risk = 1
	}
	if rng.Intn(100) >= risk {
		return nil
	}
	d := &Dismissal{Type: DismissRunOut, FielderID: f.ID}
	if wk != nil && rng.Float64() < 0.45 {
		d.Text = fmt.Sprintf("run out (%s/%s)", f.Name, wk.Name)
	} else {
		d.Text = fmt.Sprintf("run out (%s)", f.Name)
	}
	return d
}

func pickOutcome(rng *rand.Rand, w weights) Outcome {
	type p struct {
		o Outcome
		n int
	}
	ps := []p{
		{OutcomeDot, w.dot}, {OutcomeOne, w.one}, {OutcomeTwo, w.two}, {OutcomeThree, w.three},
		{OutcomeFour, w.four}, {OutcomeSix, w.six}, {OutcomeWicket, w.wicket},
		{OutcomeWide, w.wide}, {OutcomeNoBall, w.noball},
	}
	total := 0
	for _, x := range ps {
		if x.n > 0 {
			total += x.n
		}
	}
	r := rng.Intn(total)
	acc := 0
	for _, x := range ps {
		if x.n <= 0 {
			continue
		}
		acc += x.n
		if r < acc {
			return x.o
		}
	}
	return OutcomeDot
}

func pickZone(rng *rand.Rand, out Outcome, hand BatHand) Zone {
	z := FieldZones[rng.Intn(len(FieldZones))]
	if out == OutcomeSix {
		offsides := []Zone{ZoneLongOn, ZoneLongOff, ZoneMidwicket, ZoneCover}
		z = offsides[rng.Intn(len(offsides))]
	}
	if hand == HandLeft {
		z = mirrorZone(z)
	}
	return z
}

func mirrorZone(z Zone) Zone {
	switch z {
	case ZoneFineLeg:
		return ZoneThirdMan
	case ZoneThirdMan:
		return ZoneFineLeg
	case ZoneSquareLeg:
		return ZonePoint
	case ZonePoint:
		return ZoneSquareLeg
	case ZoneMidwicket:
		return ZoneCover
	case ZoneCover:
		return ZoneMidwicket
	case ZoneLongOn:
		return ZoneLongOff
	case ZoneLongOff:
		return ZoneLongOn
	}
	return z
}

func zoneAngle(z Zone) float64 {
	switch z {
	case ZoneFineLeg:
		return 20
	case ZoneSquareLeg:
		return 70
	case ZoneMidwicket:
		return 110
	case ZoneLongOn:
		return 155
	case ZoneLongOff:
		return 205
	case ZoneCover:
		return 250
	case ZonePoint:
		return 290
	case ZoneThirdMan:
		return 340
	case ZoneWicketKeep:
		return 0
	}
	return 180
}

func shotDistance(out Outcome, aerial bool) float64 {
	switch out {
	case OutcomeSix:
		return 1.12
	case OutcomeFour:
		return 0.98
	case OutcomeThree:
		return 0.72
	case OutcomeTwo:
		return 0.55
	case OutcomeOne:
		return 0.38
	default:
		if aerial {
			return 0.4
		}
		return 0.2
	}
}

func unique(in []string) []string {
	seen := map[string]bool{}
	var out []string
	for _, s := range in {
		if s == "" || seen[s] {
			continue
		}
		seen[s] = true
		out = append(out, s)
	}
	return out
}

func playerOfMatch(res MatchResult, home, away Lineup) string {
	type score struct {
		id    string
		pts   int
	}
	pts := map[string]int{}
	add := func(id string, n int) { pts[id] += n }
	for _, inn := range res.Innings {
		for _, b := range inn.Batters {
			add(b.CardID, b.Runs+b.Fours+b.Sixes*2)
		}
		for _, b := range inn.Bowlers {
			add(b.CardID, b.Wickets*22-b.Runs/3)
		}
		for _, f := range inn.Fielders {
			add(f.CardID, f.Catches*12+f.Stumpings*16+f.RunOuts*14+f.RunsSaved*3-f.Drops*6)
		}
	}
	bestID := ""
	best := -999
	for id, p := range pts {
		if p > best {
			best = p
			bestID = id
		}
	}
	_ = score{}
	return bestID
}

func dismissalText(k DismissalType, bowler, fielder *Card) string {
	bn := bowler.Name
	fn := ""
	if fielder != nil {
		fn = fielder.Name
	}
	switch k {
	case DismissBowled:
		return "b " + bn
	case DismissLBW:
		return "lbw b " + bn
	case DismissCaughtWK:
		return fmt.Sprintf("c †%s b %s", fn, bn)
	case DismissCaught:
		return fmt.Sprintf("c %s b %s", fn, bn)
	case DismissCaughtBowl:
		return "c & b " + bn
	case DismissStumped:
		return fmt.Sprintf("st %s b %s", fn, bn)
	case DismissRunOut:
		return "run out (" + fn + ")"
	}
	return "out"
}
