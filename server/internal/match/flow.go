package match

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/sudhanshushekhar/cricket-card-game/internal/bot"
	"github.com/sudhanshushekhar/cricket-card-game/internal/engine"
	"github.com/sudhanshushekhar/cricket-card-game/internal/store"
	"github.com/sudhanshushekhar/cricket-card-game/internal/trophy"
)

// A match runs in stages so captains can make calls between them:
//
//	LINEUP_PENDING -> (both locked) first innings -> INNINGS_BREAK
//	INNINGS_BREAK  -> (both called) second innings -> COMPLETE, or SUPER_OVER on a tie
//	SUPER_OVER     -> (both picked) Super Over -> COMPLETE
//
// Bots decide instantly. Players in a player-vs-player match have a grace
// period at each pause, after which their captain decides for them.
const (
	BreakGrace     = 60 * time.Second
	SuperOverGrace = 45 * time.Second
)

// Captain reputation earned per match.
const (
	RepPerMatch = 1
	RepPerWin   = 1
	ReadsPerRep = 2 // one point per this many correct reads
)

// ResultExtras are stored next to the engine result for the result screen.
type ResultExtras struct {
	Streak      map[string]int  `json:"streak,omitempty"`      // side -> win streak after this match
	StreakBonus map[string]int  `json:"streakBonus,omitempty"` // side -> bonus trophies
	Reads       map[string]int  `json:"reads,omitempty"`       // side -> overs the captain read correctly
	RepGained   map[string]int  `json:"repGained,omitempty"`   // side -> captain reputation gained
	Boosted     map[string]bool `json:"boosted,omitempty"`     // side -> streak-boosted reward roll
}

type storedResult struct {
	engine.MatchResult
	Extras ResultExtras `json:"extras"`
}

func (s *Service) loadSides(ctx context.Context, id uuid.UUID) (store.MatchRow, *store.LineupRow, *store.LineupRow, error) {
	m, err := s.Store.MatchByID(ctx, id)
	if err != nil {
		return m, nil, nil, err
	}
	lus, err := s.Store.Lineups(ctx, id)
	if err != nil {
		return m, nil, nil, err
	}
	var home, away *store.LineupRow
	for i := range lus {
		if lus[i].UserID == m.HomeUserID.String() {
			home = &lus[i]
		} else {
			away = &lus[i]
		}
	}
	return m, home, away, nil
}

// SideOf returns "home", "away" or "" for a user in a match.
func SideOf(m store.MatchRow, userID uuid.UUID) string {
	if m.HomeUserID == userID {
		return "home"
	}
	if m.AwayUserID != nil && *m.AwayUserID == userID {
		return "away"
	}
	return ""
}

func (s *Service) publish(ctx context.Context, m store.MatchRow, typ string) {
	if s.Q == nil {
		return
	}
	payload, _ := json.Marshal(map[string]any{"type": typ, "matchId": m.ID, "status": m.Status, "ballLog": json.RawMessage(orNull(m.BallLog))})
	_ = s.Q.Publish(ctx, m.ID, string(payload))
}

func orNull(b []byte) []byte {
	if len(b) == 0 {
		return []byte("null")
	}
	return b
}

// lineups builds both engine lineups, with each human side's rivalry history
// and, when fi is given, the orders chosen at the innings break.
func (s *Service) lineups(ctx context.Context, m store.MatchRow, homeL, awayL *store.LineupRow, fi *engine.FirstInnings) (engine.Lineup, engine.Lineup, error) {
	home, err := lineupFromRow(*homeL)
	if err != nil {
		return home, home, err
	}
	away, err := lineupFromRow(*awayL)
	if err != nil {
		return home, away, err
	}
	home.Rivals = s.rivals(ctx, m.HomeUserID, home, away)
	if !m.IsBot && m.AwayUserID != nil {
		away.Rivals = s.rivals(ctx, *m.AwayUserID, away, home)
	}
	if fi != nil {
		applyBreakOrder(&home, homeL, fi.RoleOf("home"))
		applyBreakOrder(&away, awayL, fi.RoleOf("away"))
	}
	return home, away, nil
}

func applyBreakOrder(l *engine.Lineup, row *store.LineupRow, role string) {
	if len(row.BreakOrder) == 0 {
		return
	}
	if role == "chase" {
		l.BattingOrder = strs(row.BreakOrder)
	} else {
		l.BowlingPlan = strs(row.BreakOrder)
	}
}

// rivals: dismissals by this side's bowlers of the opposing batters, from the user's history.
func (s *Service) rivals(ctx context.Context, userID uuid.UUID, mine, theirs engine.Lineup) map[string]int {
	var pids []string
	for _, c := range mine.Cards {
		pids = append(pids, c.PlayerID)
	}
	rs, err := s.Store.Rivalries(ctx, userID, pids)
	if err != nil {
		return nil
	}
	opp := map[string]bool{}
	for _, c := range theirs.Cards {
		opp[c.PlayerID] = true
	}
	own := map[string]bool{}
	for _, p := range pids {
		own[p] = true
	}
	out := map[string]int{}
	for _, r := range rs {
		if own[r.Bowler] && opp[r.Batter] {
			out[r.Bowler+"|"+r.Batter] = r.Dismissals
		}
	}
	return out
}

// trySimulate starts the match once both lineups are locked: it plays the
// first innings and pauses at the break.
func (s *Service) trySimulate(ctx context.Context, matchID uuid.UUID) error {
	m, homeL, awayL, err := s.loadSides(ctx, matchID)
	if err != nil || m.Status != StatusLineup {
		return err
	}
	if homeL == nil || homeL.LockedAt == nil || awayL == nil || awayL.LockedAt == nil {
		return nil
	}
	if !m.IsBot && m.AwayUserID == nil {
		return nil
	}
	if won, err := s.Store.TransitionStatus(ctx, m.ID, StatusLineup, StatusSimulating); err != nil || !won {
		return err
	}
	home, away, err := s.lineups(ctx, m, homeL, awayL, nil)
	if err != nil {
		return err
	}
	fi, err := engine.SimulateFirstInnings(m.Seed, home, away, engine.TossResult{})
	if err != nil {
		_, _ = s.Store.TransitionStatus(ctx, m.ID, StatusSimulating, StatusLineup)
		return err
	}
	now := time.Now()
	m.Status = StatusBreak
	m.Toss = mustJSON(fi.Toss)
	m.BreakState = mustJSON(fi)
	m.BallLog = mustJSON(fi.Balls)
	m.BreakStartedAt = &now
	if err := s.Store.UpdateMatch(ctx, m); err != nil {
		return err
	}
	if m.IsBot {
		call := engine.AutoBreakCall(m.Seed, away, fi, "away")
		if err := s.Store.SetBreakDecision(ctx, m.ID, awayL.UserID, string(call), nil); err != nil {
			return err
		}
	}
	s.publish(ctx, m, "break")
	return s.tryResumeAfterBreak(ctx, m.ID)
}

func breakState(m store.MatchRow) (engine.FirstInnings, error) {
	var fi engine.FirstInnings
	err := json.Unmarshal(m.BreakState, &fi)
	return fi, err
}

// BreakReq is a player's call at the innings break.
type BreakReq struct {
	Call         string   `json:"call"`         // engine.BreakCall code, or "captain"
	BattingOrder []string `json:"battingOrder"` // chasing side only, optional
	BowlingPlan  []string `json:"bowlingPlan"`  // defending side only, optional
}

func (s *Service) SubmitBreak(ctx context.Context, user store.User, matchID uuid.UUID, req BreakReq) error {
	m, homeL, awayL, err := s.loadSides(ctx, matchID)
	if err != nil {
		return err
	}
	if m.Status != StatusBreak {
		return fmt.Errorf("the match is not at the innings break")
	}
	side := SideOf(m, user.ID)
	row := map[string]*store.LineupRow{"home": homeL, "away": awayL}[side]
	if side == "" || row == nil {
		return fmt.Errorf("not your match")
	}
	if row.BreakLocked != nil {
		return fmt.Errorf("you have already made your call")
	}
	fi, err := breakState(m)
	if err != nil {
		return err
	}
	role := fi.RoleOf(side)
	call := engine.BreakCall(req.Call)
	if call == "" {
		call = engine.CallCaptain
	}
	if err := engine.ValidateBreakCall(call, role); err != nil {
		return err
	}
	var order []string
	if role == "chase" && len(req.BattingOrder) > 0 {
		order = req.BattingOrder
	} else if role == "defend" && len(req.BowlingPlan) > 0 {
		order = req.BowlingPlan
	} else if len(req.BattingOrder) > 0 || len(req.BowlingPlan) > 0 {
		return fmt.Errorf("at the break the chasing side may change its batting order and the defending side its bowling order")
	}
	if len(order) > 0 {
		lu, err := lineupFromRow(*row)
		if err != nil {
			return err
		}
		if role == "chase" {
			lu.BattingOrder = order
		} else {
			lu.BowlingPlan = order
		}
		if err := engine.ValidateLineup(lu); err != nil {
			return err
		}
	}
	if call == engine.CallCaptain {
		lu, _ := lineupFromRow(*row)
		call = engine.AutoBreakCall(m.Seed, lu, fi, side)
	}
	if err := s.Store.SetBreakDecision(ctx, m.ID, row.UserID, string(call), parseIDs(order)); err != nil {
		return err
	}
	return s.tryResumeAfterBreak(ctx, m.ID)
}

// tryResumeAfterBreak plays the second innings once both sides have called.
func (s *Service) tryResumeAfterBreak(ctx context.Context, matchID uuid.UUID) error {
	m, homeL, awayL, err := s.loadSides(ctx, matchID)
	if err != nil || m.Status != StatusBreak || homeL == nil || awayL == nil {
		return err
	}
	if homeL.BreakLocked == nil || awayL.BreakLocked == nil {
		return nil
	}
	if won, err := s.Store.TransitionStatus(ctx, m.ID, StatusBreak, StatusSimulating); err != nil || !won {
		return err
	}
	fi, err := breakState(m)
	if err != nil {
		return err
	}
	home, away, err := s.lineups(ctx, m, homeL, awayL, &fi)
	if err != nil {
		return err
	}
	res, err := engine.SimulateSecondInnings(m.Seed, home, away, fi, callOf(homeL), callOf(awayL))
	if err != nil {
		_, _ = s.Store.TransitionStatus(ctx, m.ID, StatusSimulating, StatusBreak)
		return err
	}
	if res.Winner == "tie" {
		now := time.Now()
		m.Status = StatusSuperOver
		m.SuperState = mustJSON(res)
		m.BallLog = mustJSON(res.Balls)
		m.SuperStartedAt = &now
		if err := s.Store.UpdateMatch(ctx, m); err != nil {
			return err
		}
		if m.IsBot {
			if err := s.Store.SetSuperPicks(ctx, m.ID, awayL.UserID, mustJSON(engine.AutoSuperOverPicks(away))); err != nil {
				return err
			}
		}
		s.publish(ctx, m, "super_over")
		return s.tryFinishSuperOver(ctx, m.ID)
	}
	return s.finishMatch(ctx, m, res, home, away)
}

func callOf(row *store.LineupRow) engine.BreakCall {
	if row.BreakCall == nil {
		return engine.CallCaptain
	}
	return engine.BreakCall(*row.BreakCall)
}

func (s *Service) SubmitSuperOver(ctx context.Context, user store.User, matchID uuid.UUID, picks engine.SuperOverPicks) error {
	m, homeL, awayL, err := s.loadSides(ctx, matchID)
	if err != nil {
		return err
	}
	if m.Status != StatusSuperOver {
		return fmt.Errorf("there is no Super Over to pick for")
	}
	side := SideOf(m, user.ID)
	row := map[string]*store.LineupRow{"home": homeL, "away": awayL}[side]
	if side == "" || row == nil {
		return fmt.Errorf("not your match")
	}
	if row.SuperLocked != nil {
		return fmt.Errorf("you have already picked")
	}
	lu, err := lineupFromRow(*row)
	if err != nil {
		return err
	}
	if len(picks.Batters) == 0 && picks.Bowler == "" {
		picks = engine.AutoSuperOverPicks(lu) // let the captain pick
	}
	if err := engine.ValidateSuperOverPicks(lu, picks); err != nil {
		return err
	}
	if err := s.Store.SetSuperPicks(ctx, m.ID, row.UserID, mustJSON(picks)); err != nil {
		return err
	}
	return s.tryFinishSuperOver(ctx, m.ID)
}

func (s *Service) tryFinishSuperOver(ctx context.Context, matchID uuid.UUID) error {
	m, homeL, awayL, err := s.loadSides(ctx, matchID)
	if err != nil || m.Status != StatusSuperOver || homeL == nil || awayL == nil {
		return err
	}
	if homeL.SuperLocked == nil || awayL.SuperLocked == nil {
		return nil
	}
	if won, err := s.Store.TransitionStatus(ctx, m.ID, StatusSuperOver, StatusSimulating); err != nil || !won {
		return err
	}
	var res engine.MatchResult
	if err := json.Unmarshal(m.SuperState, &res); err != nil {
		return err
	}
	fi, err := breakState(m)
	if err != nil {
		return err
	}
	home, away, err := s.lineups(ctx, m, homeL, awayL, &fi)
	if err != nil {
		return err
	}
	var hp, ap engine.SuperOverPicks
	_ = json.Unmarshal(homeL.SuperPicks, &hp)
	_ = json.Unmarshal(awayL.SuperPicks, &ap)
	res, err = engine.SimulateSuperOver(m.Seed, home, away, res, hp, ap)
	if err != nil {
		_, _ = s.Store.TransitionStatus(ctx, m.ID, StatusSimulating, StatusSuperOver)
		return err
	}
	return s.finishMatch(ctx, m, res, home, away)
}

// finishMatch settles trophies (with win-streak bonus), rewards, ratings and XP,
// captain reputation and rivalries.
func (s *Service) finishMatch(ctx context.Context, m store.MatchRow, res engine.MatchResult, home, away engine.Lineup) error {
	homeU, err := s.Store.UserByID(ctx, m.HomeUserID)
	if err != nil {
		return err
	}
	var awayU *store.User
	if !m.IsBot && m.AwayUserID != nil {
		if u, err := s.Store.UserByID(ctx, *m.AwayUserID); err == nil {
			awayU = &u
		}
	}
	oppTrophies := homeU.Trophies
	if m.IsBot {
		var p bot.Profile
		_ = json.Unmarshal(m.BotProfile, &p)
		oppTrophies = p.Trophies
	} else if awayU != nil {
		oppTrophies = awayU.Trophies
	}

	ex := ResultExtras{Streak: map[string]int{}, StreakBonus: map[string]int{}, Reads: map[string]int{}, RepGained: map[string]int{}, Boosted: map[string]bool{}}
	won := map[string]bool{"home": res.Winner == "home", "away": res.Winner == "away"}
	// Streaks are counted before this match is marked complete.
	settle := func(side string, u store.User, opp int) int {
		d := trophy.Delta(u.Trophies, opp, won[side])
		if res.Winner == "tie" {
			d = 0
		}
		if won[side] {
			prev, _ := s.Store.WinStreak(ctx, u.ID)
			ex.Streak[side] = prev + 1
			ex.StreakBonus[side] = trophy.StreakBonus(prev + 1)
			ex.Boosted[side] = prev+1 >= trophy.StreakBoostAt
			d += ex.StreakBonus[side]
		}
		return d
	}
	hd := settle("home", homeU, oppTrophies)
	ad := 0
	if awayU != nil {
		ad = settle("away", *awayU, homeU.Trophies)
	}
	// Captain reputation: +1 per match, +1 for a win, +1 per two good reads.
	for _, side := range []string{"home", "away"} {
		ex.Reads[side] = captainReads(res, side)
		ex.RepGained[side] = RepPerMatch + ex.Reads[side]/ReadsPerRep
		if won[side] {
			ex.RepGained[side] += RepPerWin
		}
	}

	var winner *uuid.UUID
	if won["home"] {
		winner = &homeU.ID
	} else if won["away"] && awayU != nil {
		winner = &awayU.ID
	}
	now := time.Now()
	m.Status = StatusComplete
	m.Toss = mustJSON(res.Toss)
	m.Result = mustJSON(storedResult{MatchResult: res, Extras: ex})
	m.BallLog = mustJSON(res.Balls)
	m.WinnerUserID = winner
	m.TrophyDeltaHome = &hd
	m.TrophyDeltaAway = &ad
	m.CompletedAt = &now
	if err := s.Store.UpdateMatch(ctx, m); err != nil {
		return err
	}

	ht := trophy.Apply(homeU.Trophies, hd)
	_ = s.Store.UpdateTrophies(ctx, homeU.ID, ht, trophy.ArenaFor(ht).Name)
	if s.Q != nil {
		_ = s.Q.SetScore(ctx, homeU.ID, ht)
	}
	if awayU != nil {
		at := trophy.Apply(awayU.Trophies, ad)
		_ = s.Store.UpdateTrophies(ctx, awayU.ID, at, trophy.ArenaFor(at).Name)
		if s.Q != nil {
			_ = s.Q.SetScore(ctx, awayU.ID, at)
		}
	}

	ratings := engine.PlayerRatings(res)
	humans := []struct {
		side string
		user store.User
		lu   engine.Lineup
	}{{"home", homeU, home}}
	if awayU != nil {
		humans = append(humans, struct {
			side string
			user store.User
			lu   engine.Lineup
		}{"away", *awayU, away})
	}
	for _, h := range humans {
		if err := s.grantMatchXP(ctx, h.user, m.ID, h.lu, ratings, !won[h.side]); err != nil {
			log.Printf("match %s: %s XP: %v", m.ID, h.side, err)
		}
		if won[h.side] {
			if err := s.grantRewards(ctx, h.user, m.ID, ex.Boosted[h.side]); err != nil {
				log.Printf("match %s: %s rewards: %v", m.ID, h.side, err)
			}
		}
		if cap := engine.CaptainOf(h.lu); cap != nil {
			if id, err := uuid.Parse(cap.ID); err == nil {
				_ = s.Store.AddCaptainRep(ctx, id, ex.RepGained[h.side])
			}
		}
		if err := s.Store.RecordRivalries(ctx, h.user.ID, rivalryDeltas(res, home, away)); err != nil {
			log.Printf("match %s: rivalries: %v", m.ID, err)
		}
	}
	s.publish(ctx, m, "complete")
	return nil
}

// captainReads counts overs in which a side's captain made the best reply to
// the other captain's actual call.
func captainReads(res engine.MatchResult, side string) int {
	n := 0
	for _, inn := range res.Innings {
		for _, c := range inn.Calls {
			if inn.BattingSide == side && c.BatRead {
				n++
			}
			if inn.BowlingSide == side && c.FieldRead {
				n++
			}
		}
	}
	return n
}

// rivalryDeltas tallies every bowler-vs-batter matchup in the main innings.
func rivalryDeltas(res engine.MatchResult, home, away engine.Lineup) []store.RivalryDelta {
	pid := map[string]string{}
	for _, c := range append(append([]engine.Card(nil), home.Cards...), away.Cards...) {
		pid[c.ID] = c.PlayerID
	}
	agg := map[[2]string]*store.RivalryDelta{}
	for _, b := range res.Balls {
		if b.Innings > 1 {
			continue // Super Over balls don't count
		}
		k := [2]string{pid[b.BowlerID], pid[b.StrikerID]}
		if k[0] == "" || k[1] == "" {
			continue
		}
		d := agg[k]
		if d == nil {
			d = &store.RivalryDelta{Bowler: k[0], Batter: k[1]}
			agg[k] = d
		}
		if b.Legal {
			d.Balls++
		}
		if b.Outcome != engine.OutcomeWide && b.Outcome != engine.OutcomeNoBall && b.Outcome != engine.OutcomeBye {
			d.Runs += b.Runs
		}
		if b.Dismissal != nil && b.Dismissal.Type != engine.DismissRunOut {
			d.Dismissals++
		}
	}
	out := make([]store.RivalryDelta, 0, len(agg))
	for _, d := range agg {
		out = append(out, *d)
	}
	return out
}

// PauseDeadline is when an idle player-vs-player side's captain decides for
// them at the innings break or Super Over (nil when no deadline applies).
func PauseDeadline(m store.MatchRow, lineups []store.LineupRow, userID uuid.UUID) *time.Time {
	if m.IsBot || m.AwayUserID == nil {
		return nil
	}
	var mine *store.LineupRow
	for i := range lineups {
		if lineups[i].UserID == userID.String() {
			mine = &lineups[i]
		}
	}
	if mine == nil {
		return nil
	}
	switch {
	case m.Status == StatusBreak && mine.BreakLocked == nil && m.BreakStartedAt != nil:
		d := m.BreakStartedAt.Add(BreakGrace)
		return &d
	case m.Status == StatusSuperOver && mine.SuperLocked == nil && m.SuperStartedAt != nil:
		d := m.SuperStartedAt.Add(SuperOverGrace)
		return &d
	}
	return nil
}

// ResolveStalePause lets the captain decide for any side past its deadline.
func (s *Service) ResolveStalePause(ctx context.Context, m store.MatchRow) error {
	if m.IsBot || m.AwayUserID == nil || (m.Status != StatusBreak && m.Status != StatusSuperOver) {
		return nil
	}
	lus, err := s.Store.Lineups(ctx, m.ID)
	if err != nil {
		return err
	}
	for _, uid := range []uuid.UUID{m.HomeUserID, *m.AwayUserID} {
		d := PauseDeadline(m, lus, uid)
		if d == nil || time.Now().Before(*d) {
			continue
		}
		u, err := s.Store.UserByID(ctx, uid)
		if err != nil {
			return err
		}
		log.Printf("match %s: %s ran out of time, captain decides", m.ID, u.Username)
		if m.Status == StatusBreak {
			if err := s.SubmitBreak(ctx, u, m.ID, BreakReq{Call: string(engine.CallCaptain)}); err != nil {
				return err
			}
		} else if err := s.SubmitSuperOver(ctx, u, m.ID, engine.SuperOverPicks{}); err != nil {
			return err
		}
	}
	return nil
}
