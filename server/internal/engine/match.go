package engine

import (
	"fmt"
	"math/rand"
)

// Seeds for the parts of a match that are simulated separately, so each is
// deterministic given the match seed and the decisions made before it.
const (
	secondInningsSalt = 0x2545F4914F6CDD1D
	superOverSalt     = 0x61C8864680B583EB
	autoCallSalt      = 0x1B873593
)

// OverCall records both captains' choices for one over.
type OverCall struct {
	Over           int       `json:"over"`
	Approach       Approach  `json:"approach"`
	Field          FieldPlan `json:"field"`
	BatRead        bool      `json:"batRead"`   // approach was the best reply to the field actually set
	FieldRead      bool      `json:"fieldRead"` // field was the best reply to the approach actually played
	Masterstroke   string    `json:"masterstroke,omitempty"`
	MasterstrokeBy string    `json:"masterstrokeBy,omitempty"`
}

// CaptainMemory is what captains have seen so far, carried across the break.
type CaptainMemory struct {
	BatCalls   map[string][]Approach  `json:"batCalls"`   // side -> approaches seen when that side batted
	FieldCalls map[string][]FieldPlan `json:"fieldCalls"` // side -> fields seen when that side bowled
	Used       map[string]bool        `json:"used"`       // side -> masterstroke already played
}

func newMemory() *CaptainMemory {
	return &CaptainMemory{BatCalls: map[string][]Approach{}, FieldCalls: map[string][]FieldPlan{}, Used: map[string]bool{}}
}

func (m *CaptainMemory) clone() *CaptainMemory {
	c := newMemory()
	for k, v := range m.BatCalls {
		c.BatCalls[k] = append([]Approach(nil), v...)
	}
	for k, v := range m.FieldCalls {
		c.FieldCalls[k] = append([]FieldPlan(nil), v...)
	}
	for k, v := range m.Used {
		c.Used[k] = v
	}
	return c
}

// FirstInnings is the state at the innings break.
type FirstInnings struct {
	Toss       TossResult     `json:"toss"`
	Pitch      Pitch          `json:"pitch"`
	Conditions Conditions     `json:"conditions"` // revealed at the break
	FirstSide  string         `json:"firstSide"`
	SecondSide string         `json:"secondSide"`
	Innings    InningsResult  `json:"innings"`
	Balls      []BallEvent    `json:"balls"`
	Memory     *CaptainMemory `json:"memory"`
}

// Target is what the side batting second needs.
func (f FirstInnings) Target() int { return f.Innings.Runs + 1 }

// RoleOf returns "chase" or "defend" for a side in the second innings.
func (f FirstInnings) RoleOf(side string) string {
	if side == f.SecondSide {
		return "chase"
	}
	return "defend"
}

func sideLineup(home, away Lineup, side string) Lineup {
	if side == "home" {
		return home
	}
	return away
}

// SimulateFirstInnings plays the toss and the first innings.
func SimulateFirstInnings(seed int64, home, away Lineup, toss TossResult) (FirstInnings, error) {
	if err := ValidateLineup(home); err != nil {
		return FirstInnings{}, fmt.Errorf("home lineup: %w", err)
	}
	if err := ValidateLineup(away); err != nil {
		return FirstInnings{}, fmt.Errorf("away lineup: %w", err)
	}
	rng := rand.New(rand.NewSource(seed))
	pitch := PitchForSeed(seed)
	if toss.WinnerSide == "" {
		toss.WinnerSide = "away"
		if rng.Intn(2) == 0 {
			toss.WinnerSide = "home"
		}
		winner := sideLineup(home, away, toss.WinnerSide)
		toss.Decision = winner.TossPref
		if toss.Decision == "" {
			toss.Decision = captainToss(rng, *CaptainOf(winner), pitch)
		}
	}
	if toss.Decision == "" {
		toss.Decision = "chase"
	}
	firstSide := "away"
	if (toss.WinnerSide == "home") == (toss.Decision == "bat") {
		firstSide = "home"
	}
	secondSide := map[string]string{"home": "away", "away": "home"}[firstSide]

	mem := newMemory()
	inn, balls := playInnings(rng, &inningsCtx{
		innings: 0, batting: sideLineup(home, away, firstSide), bowling: sideLineup(home, away, secondSide),
		batSide: firstSide, bowlSide: secondSide, target: -1, pitch: pitch, cond: CondClear,
		mem: mem, overs: OversPerInnings, maxWickets: MaxWickets,
	})
	return FirstInnings{
		Toss: toss, Pitch: pitch, Conditions: ConditionsForSeed(seed),
		FirstSide: firstSide, SecondSide: secondSide, Innings: inn, Balls: balls, Memory: mem,
	}, nil
}

// SimulateSecondInnings plays the chase. home and away may carry a new
// batting order (chasing side) or bowling plan (defending side) chosen at the break.
func SimulateSecondInnings(seed int64, home, away Lineup, fi FirstInnings, homeCall, awayCall BreakCall) (MatchResult, error) {
	chasing, defending := sideLineup(home, away, fi.SecondSide), sideLineup(home, away, fi.FirstSide)
	if err := ValidateLineup(chasing); err != nil {
		return MatchResult{}, fmt.Errorf("%s lineup: %w", fi.SecondSide, err)
	}
	if err := ValidateLineup(defending); err != nil {
		return MatchResult{}, fmt.Errorf("%s lineup: %w", fi.FirstSide, err)
	}
	calls := map[string]BreakCall{"home": homeCall, "away": awayCall}
	mem := fi.Memory
	if mem == nil {
		mem = newMemory()
	} else {
		mem = mem.clone()
	}
	rng := rand.New(rand.NewSource(seed ^ secondInningsSalt))
	inn2, balls2 := playInnings(rng, &inningsCtx{
		innings: 1, batting: chasing, bowling: defending,
		batSide: fi.SecondSide, bowlSide: fi.FirstSide, target: fi.Target(), pitch: fi.Pitch, cond: fi.Conditions,
		batCall: calls[fi.SecondSide], bowlCall: calls[fi.FirstSide],
		mem: mem, overs: OversPerInnings, maxWickets: MaxWickets,
	})
	res := MatchResult{Toss: fi.Toss, Pitch: fi.Pitch, Conditions: fi.Conditions}
	res.Innings[0], res.Innings[1] = fi.Innings, inn2
	res.Balls = append(append([]BallEvent(nil), fi.Balls...), balls2...)
	res.BreakCalls = map[string]string{"home": string(orCaptain(homeCall)), "away": string(orCaptain(awayCall))}
	res.Winner, res.Margin = decide(fi.FirstSide, fi.SecondSide, fi.Innings, inn2)
	res.POTM = playerOfMatch(res, home, away)
	return res, nil
}

func orCaptain(c BreakCall) BreakCall {
	if c == "" {
		return CallCaptain
	}
	return c
}

// AutoBreakCall is the card a side's own captain picks.
func AutoBreakCall(seed int64, l Lineup, fi FirstInnings, side string) BreakCall {
	rng := rand.New(rand.NewSource(seed ^ autoCallSalt ^ int64(len(side))))
	return CaptainBreakCall(rng, *CaptainOf(l), fi.RoleOf(side), fi.Target(), PitchByCode(fi.Pitch).Par)
}

// Simulate plays a whole match with every decision left to the captains,
// including a Super Over on a tie. Used by tests, docs and measurements.
func Simulate(seed int64, home, away Lineup, toss TossResult) (MatchResult, error) {
	fi, err := SimulateFirstInnings(seed, home, away, toss)
	if err != nil {
		return MatchResult{}, err
	}
	res, err := SimulateSecondInnings(seed, home, away, fi, CallCaptain, CallCaptain)
	if err != nil || res.Winner != "tie" {
		return res, err
	}
	return SimulateSuperOver(seed, home, away, res, AutoSuperOverPicks(home), AutoSuperOverPicks(away))
}

// SuperOverPicks are the 3 batters (in order) and the bowler for a Super Over.
type SuperOverPicks struct {
	Batters []string `json:"batters"`
	Bowler  string   `json:"bowler"`
}

type SuperOverResult struct {
	Innings [2]InningsResult          `json:"innings"`
	Picks   map[string]SuperOverPicks `json:"picks"`
	Winner  string                    `json:"winner"`
	Decider string                    `json:"decider"` // "runs", "boundaries", "match boundaries" or "tie"
}

const SuperOverBatters, SuperOverWickets = 3, 2

func ValidateSuperOverPicks(l Lineup, p SuperOverPicks) error {
	if len(p.Batters) != SuperOverBatters {
		return fmt.Errorf("pick %d batters", SuperOverBatters)
	}
	seen := map[string]bool{}
	for _, id := range p.Batters {
		if CardByID(l.Cards, id) == nil {
			return fmt.Errorf("batter %s is not in your team", id)
		}
		if seen[id] {
			return fmt.Errorf("a batter is picked twice")
		}
		seen[id] = true
	}
	b := CardByID(l.Cards, p.Bowler)
	if b == nil || (b.Role != RoleBOWL && b.Role != RoleAR) {
		return fmt.Errorf("the Super Over bowler must be a bowler or all-rounder from your team")
	}
	return nil
}

// AutoSuperOverPicks: the captain's picks, hitters first and the best death bowler.
func AutoSuperOverPicks(l Lineup) SuperOverPicks {
	cards := append([]Card(nil), l.Cards...)
	hit := func(c Card) int { a := Effective(c); return a.Power*2 + a.Technique + a.Timing }
	for i := range cards {
		for j := i + 1; j < len(cards); j++ {
			if hit(cards[j]) > hit(cards[i]) {
				cards[i], cards[j] = cards[j], cards[i]
			}
		}
	}
	p := SuperOverPicks{}
	for _, c := range cards[:SuperOverBatters] {
		p.Batters = append(p.Batters, c.ID)
	}
	best := -1
	for _, c := range l.Cards {
		if c.Role != RoleBOWL && c.Role != RoleAR {
			continue
		}
		a := Effective(c)
		if s := a.DeathBowling*2 + a.Accuracy + a.WicketTaking; s > best {
			best, p.Bowler = s, c.ID
		}
	}
	return p
}

// SimulateSuperOver settles a tied match. The side that batted second bats first.
func SimulateSuperOver(seed int64, home, away Lineup, res MatchResult, homePicks, awayPicks SuperOverPicks) (MatchResult, error) {
	picks := map[string]SuperOverPicks{"home": homePicks, "away": awayPicks}
	lineups := map[string]Lineup{"home": home, "away": away}
	for side, p := range picks {
		if err := ValidateSuperOverPicks(lineups[side], p); err != nil {
			return res, fmt.Errorf("%s super over: %w", side, err)
		}
	}
	first := res.Innings[1].BattingSide
	second := res.Innings[0].BattingSide
	so := func(side string, asBatting bool) Lineup {
		l := lineups[side]
		l.Tactics = Tactics{}
		if asBatting {
			l.BattingOrder = picks[side].Batters
		} else {
			l.BowlingPlan = []string{picks[side].Bowler}
		}
		return l
	}
	rng := rand.New(rand.NewSource(seed ^ superOverSalt))
	mem := newMemory()
	a, ballsA := playInnings(rng, &inningsCtx{innings: 2, batting: so(first, true), bowling: so(second, false), batSide: first, bowlSide: second,
		target: -1, pitch: res.Pitch, cond: res.Conditions, mem: mem, overs: 1, maxWickets: SuperOverWickets, superOver: true})
	b, ballsB := playInnings(rng, &inningsCtx{innings: 3, batting: so(second, true), bowling: so(first, false), batSide: second, bowlSide: first,
		target: a.Runs + 1, pitch: res.Pitch, cond: res.Conditions, mem: mem, overs: 1, maxWickets: SuperOverWickets, superOver: true})

	out := &SuperOverResult{Innings: [2]InningsResult{a, b}, Picks: picks}
	bound := func(inns ...InningsResult) int {
		n := 0
		for _, in := range inns {
			for _, bt := range in.Batters {
				n += bt.Fours + bt.Sixes
			}
		}
		return n
	}
	sideBound := func(side string) int {
		for _, in := range res.Innings {
			if in.BattingSide == side {
				return bound(in)
			}
		}
		return 0
	}
	switch {
	case b.Runs > a.Runs:
		out.Winner, out.Decider = second, "runs"
	case a.Runs > b.Runs:
		out.Winner, out.Decider = first, "runs"
	case bound(a) != bound(b):
		out.Decider = "boundaries"
		out.Winner = first
		if bound(b) > bound(a) {
			out.Winner = second
		}
	case sideBound(first) != sideBound(second):
		out.Decider = "match boundaries"
		out.Winner = first
		if sideBound(second) > sideBound(first) {
			out.Winner = second
		}
	default:
		out.Winner, out.Decider = "tie", "tie"
	}
	res.SuperOver = out
	res.Balls = append(append(res.Balls, ballsA...), ballsB...)
	if out.Winner != "tie" {
		res.Winner = out.Winner
		res.Margin = "won the Super Over"
		if out.Decider != "runs" {
			res.Margin = "won the Super Over on " + out.Decider
		}
	}
	return res, nil
}
