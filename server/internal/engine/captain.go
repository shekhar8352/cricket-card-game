package engine

import (
	"hash/fnv"
	"math"
	"math/rand"
)

// Captaincy describes how a player captains. Each value is 0-100.
type Captaincy struct {
	Aggression   int    `json:"aggression"`   // leans to attacking bat and field
	Tactics      int    `json:"tactics"`      // reads the opponent and the situation
	Calm         int    `json:"calm"`         // their batters handle pressure better
	Flair        int    `json:"flair"`        // how unpredictable their calls are
	Masterstroke string `json:"masterstroke"` // signature move code
}

// CaptainRules are the published constants of the captain AI.
type CaptainRules struct {
	AggressionDivisor  float64 `json:"aggressionDivisor"` // bias = (aggression-50)/divisor per step towards attack
	ReadBonus          float64 `json:"readBonus"`         // utility added to the counter of a predicted opponent call
	TempBase           float64 `json:"tempBase"`          // softmax temperature = base + flair/flairDivisor
	TempFlairDivisor   float64 `json:"tempFlairDivisor"`
	TempTacticsDivisor float64 `json:"tempTacticsDivisor"` // temperature -= (tactics-50)/divisor: sharp captains are decisive
	TempMin            float64 `json:"tempMin"`
	JudgementBase      float64 `json:"judgementBase"` // situation weight = base + tactics/100 * scale
	JudgementScale     float64 `json:"judgementScale"`
	RepPerTactics      int     `json:"repPerTactics"` // reputation points per +1 tactics
	RepMaxBonus        int     `json:"repMaxBonus"`
	CalmDivisor        int     `json:"calmDivisor"` // pressure relief = (calm-50)/divisor
	ArmbandTemp        int     `json:"armbandTemperament"`
	ReadTheBatters     int     `json:"readTheBattersBonus"` // tactics bonus from that break card
}

var Captain = CaptainRules{
	AggressionDivisor: 25, ReadBonus: 3.0, TempBase: 0.35, TempFlairDivisor: 60,
	TempTacticsDivisor: 150, TempMin: 0.25, JudgementBase: 0.4, JudgementScale: 0.8,
	RepPerTactics: 10, RepMaxBonus: 10, CalmDivisor: 25, ArmbandTemp: 4, ReadTheBatters: 15,
}

func hashUnit(s string) float64 {
	h := fnv.New32a()
	_, _ = h.Write([]byte(s))
	return float64(h.Sum32()%2001)/1000 - 1 // -1..+1
}

// DeriveCaptaincy builds a plausible captaincy profile from a player's
// attributes, with a small stable per-player variation so derived captains differ.
func DeriveCaptaincy(c Card) Captaincy {
	a := c.Attrs
	j := func(salt string) int { return int(math.Round(hashUnit(c.PlayerID+salt) * 8)) }
	agg := 50 + (a.Power-a.Technique)/2 + j("agg")
	tac := (a.Technique+a.Temperament)/2 - 12 + j("tac")
	if c.Role == RoleWK {
		tac += 8 // reads the game from behind the stumps
	}
	if HasTrait(c, "Keeper-Captain") {
		tac += 6
	}
	calm := a.Temperament - 5 + j("calm")
	flair := 45 + j("flair")*2
	for _, t := range c.Traits {
		switch t {
		case "Powerplay Hitter", "Mystery Spinner":
			flair += 12
			agg += 6
		case "Anchor":
			agg -= 10
			calm += 5
		case "Finisher":
			calm += 6
		}
	}
	cp := Captaincy{Aggression: clamp(agg, 15, 95), Tactics: clamp(tac, 20, 90), Calm: clamp(calm, 20, 95), Flair: clamp(flair, 15, 90)}
	cp.Masterstroke = GenericMasterstroke(cp)
	return cp
}

// CaptaincyOf returns a card's captaincy, deriving it if the catalog had none.
func CaptaincyOf(c Card) Captaincy {
	if c.Captaincy != nil {
		cp := *c.Captaincy
		if cp.Masterstroke == "" {
			cp.Masterstroke = GenericMasterstroke(cp)
		}
		return cp
	}
	return DeriveCaptaincy(c)
}

// CaptainScore ranks captains for automatic choice (bots, old lineups).
func CaptainScore(c Card) int {
	cp := CaptaincyOf(c)
	return cp.Tactics*2 + cp.Calm + cp.Aggression/2 + c.CaptainRep/5
}

// CaptainOf returns the lineup's captain, choosing the best-scoring card if none is set.
func CaptainOf(l Lineup) *Card {
	if c := CardByID(l.Cards, l.CaptainID); c != nil {
		return c
	}
	var best *Card
	for i := range l.Cards {
		if best == nil || CaptainScore(l.Cards[i]) > CaptainScore(*best) {
			best = &l.Cards[i]
		}
	}
	return best
}

func effectiveTactics(c Card, extra int) int {
	cp := CaptaincyOf(c)
	rep := c.CaptainRep / Captain.RepPerTactics
	if rep > Captain.RepMaxBonus {
		rep = Captain.RepMaxBonus
	}
	return clamp(cp.Tactics+rep+extra, 1, 99)
}

// Best responses in the approach/field cycle (see Counters).
func BestApproachVs(f FieldPlan) Approach {
	switch f {
	case FieldDefend:
		return ApproachDefend
	default:
		return ApproachAttack
	}
}

func BestFieldVs(a Approach) FieldPlan {
	if a == ApproachDefend {
		return FieldAttack
	}
	return FieldDefend
}

var options3 = [3]int{-1, 0, 1}

func approachOf(o int) Approach {
	return [3]Approach{ApproachDefend, ApproachBalanced, ApproachAttack}[o+1]
}

func fieldOf(o int) FieldPlan {
	return [3]FieldPlan{FieldDefend, FieldBalanced, FieldAttack}[o+1]
}

func stepOfApproach(a Approach) int {
	switch a {
	case ApproachDefend:
		return -1
	case ApproachAttack:
		return 1
	}
	return 0
}

func stepOfField(f FieldPlan) int {
	switch f {
	case FieldDefend:
		return -1
	case FieldAttack:
		return 1
	}
	return 0
}

// pickSoftmax samples an option index from utilities with the given temperature.
func pickSoftmax(rng *rand.Rand, u [3]float64, temp float64) int {
	m := math.Max(u[0], math.Max(u[1], u[2]))
	var w [3]float64
	sum := 0.0
	for i := range u {
		w[i] = math.Exp((u[i] - m) / temp)
		sum += w[i]
	}
	r := rng.Float64() * sum
	for i := range w {
		r -= w[i]
		if r <= 0 {
			return i
		}
	}
	return 2
}

func mostCommon[T comparable](xs []T) (T, bool) {
	var zero T
	if len(xs) == 0 {
		return zero, false
	}
	n := map[T]int{}
	best, bestN := zero, 0
	for _, x := range xs {
		n[x]++
		if n[x] > bestN {
			best, bestN = x, n[x]
		}
	}
	return best, true
}

func temperature(cap Card, extra int) float64 {
	cp := CaptaincyOf(cap)
	t := Captain.TempBase + float64(cp.Flair)/Captain.TempFlairDivisor - float64(effectiveTactics(cap, extra)-50)/Captain.TempTacticsDivisor
	return math.Max(Captain.TempMin, t)
}

// judgement scales how much a captain responds to the match situation.
func judgement(cap Card, extra int) float64 {
	return Captain.JudgementBase + float64(effectiveTactics(cap, extra))/100*Captain.JudgementScale
}

// situation is what a captain sees at the start of an over.
type situation struct {
	over, wickets, runs, target int
}

func (s situation) chasing() bool { return s.target > 0 }

// requiredRate is runs per over still needed (0 when not chasing).
func (s situation) requiredRate() float64 {
	if !s.chasing() {
		return 0
	}
	ballsLeft := (OversPerInnings - s.over) * BallsPerOver
	return float64(s.target-s.runs) / math.Max(1, float64(ballsLeft)) * 6
}

func (s situation) requiredVsCurrent() float64 {
	if !s.chasing() {
		return 0
	}
	ballsLeft := (OversPerInnings - s.over) * BallsPerOver
	ballsGone := s.over * BallsPerOver
	rrr := float64(s.target-s.runs) / math.Max(1, float64(ballsLeft)) * 6
	crr := 7.5
	if ballsGone > 0 {
		crr = float64(s.runs) / float64(ballsGone) * 6
	}
	return rrr - crr
}

// chooseApproach is the batting captain's call for an over.
func chooseApproach(rng *rand.Rand, cap Card, s situation, oppFields []FieldPlan, call BreakCall) Approach {
	cp := CaptaincyOf(cap)
	var u [3]float64
	agg := float64(cp.Aggression-50) / Captain.AggressionDivisor
	extra := 0
	if call == CallReadField {
		extra = Captain.ReadTheBatters
	}
	j := judgement(cap, extra)
	for i, o := range options3 {
		f := float64(o)
		sit := 0.0
		if PhaseOf(s.over) == PhasePowerplay {
			sit += 0.8 // fielding restrictions reward attacking
		}
		if s.over == OversPerInnings-1 {
			sit += 1.0
		}
		if s.chasing() {
			sit += math.Max(-2, math.Min(2, s.requiredVsCurrent()/3))
		}
		if s.wickets >= 4 {
			sit -= 0.8
		}
		u[i] = (agg + sit*j) * f
	}
	if pred, ok := mostCommon(oppFields); ok && rng.Float64()*100 < float64(effectiveTactics(cap, extra)) {
		u[stepOfApproach(BestApproachVs(pred))+1] += Captain.ReadBonus
	}
	return approachOf(options3[pickSoftmax(rng, u, temperature(cap, extra))])
}

// chooseField is the fielding captain's call for an over.
func chooseField(rng *rand.Rand, cap Card, s situation, oppApproaches []Approach, call BreakCall) FieldPlan {
	cp := CaptaincyOf(cap)
	var u [3]float64
	agg := float64(cp.Aggression-50) / Captain.AggressionDivisor
	extra := 0
	if call == CallReadBatters {
		extra = Captain.ReadTheBatters
	}
	j := judgement(cap, extra)
	for i, o := range options3 {
		f := float64(o)
		sit := 0.0
		if s.over == 0 {
			sit += 0.5 // new ball: go for wickets
		}
		if s.over == OversPerInnings-1 {
			sit -= 0.5
		}
		if s.chasing() && s.requiredVsCurrent() > 4 {
			sit -= 1.0 // they must hit out: protect the rope
		}
		if s.wickets >= 4 {
			sit += 0.8 // go for the kill
		}
		u[i] = (agg + sit*j) * f
	}
	if pred, ok := mostCommon(oppApproaches); ok && rng.Float64()*100 < float64(effectiveTactics(cap, extra)) {
		u[stepOfField(BestFieldVs(pred))+1] += Captain.ReadBonus
	}
	return fieldOf(options3[pickSoftmax(rng, u, temperature(cap, extra))])
}

// captainToss decides bat or chase after winning the toss.
func captainToss(rng *rand.Rand, cap Card, pitch Pitch) string {
	cp := CaptaincyOf(cap)
	if rng.Float64()*100 < float64(effectiveTactics(cap, 0)) {
		switch pitch {
		case PitchDusty:
			return "bat" // avoid the worn pitch
		case PitchFlat:
			return "chase" // pace the chase to the target
		}
	}
	batScore := float64(cp.Aggression-55)/20 + (rng.Float64()-0.5)*float64(cp.Flair)/40
	if batScore > 0 {
		return "bat"
	}
	return "chase"
}
