package match

import (
	"sort"
	"log"
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/sudhanshushekhar/cricket-card-game/internal/bot"
	"github.com/sudhanshushekhar/cricket-card-game/internal/cards"
	"github.com/sudhanshushekhar/cricket-card-game/internal/engine"
	"github.com/sudhanshushekhar/cricket-card-game/internal/matchmaking"
	"github.com/sudhanshushekhar/cricket-card-game/internal/store"
	"github.com/sudhanshushekhar/cricket-card-game/internal/trophy"
)

const (
	StatusLineup     = "LINEUP_PENDING"
	StatusSimulating = "SIMULATING"
	StatusComplete   = "COMPLETE"
	StatusMatching   = "MATCHING"
	StatusBreak      = "INNINGS_BREAK" // first innings done, waiting for both captains' calls
	StatusSuperOver  = "SUPER_OVER"    // tied, waiting for both sides' Super Over picks
)

type Service struct {
	Store *store.Store
	Q     *matchmaking.Queue
	// OnComplete, if set, runs after a match finishes (tournaments advance from it).
	OnComplete func(context.Context, store.MatchRow)
}

func (s *Service) CreateBotMatch(ctx context.Context, user store.User) (store.MatchRow, error) {
	catalog, err := s.Store.Players(ctx)
	if err != nil {
		return store.MatchRow{}, err
	}
	seed := time.Now().UnixNano()
	deck := bot.Generate(seed, user.Trophies, catalog)
	prof, _ := json.Marshal(deck.Profile)
	m, err := s.Store.InsertMatch(ctx, store.MatchRow{
		HomeUserID: user.ID,
		IsBot:      true,
		BotProfile: prof,
		Status:     StatusLineup,
		Seed:       seed,
	})
	if err != nil {
		return m, err
	}
	snap, _ := json.Marshal(deck.Lineup.Cards)
	now := time.Now()
	ids := cardIDs(deck.Lineup.Cards)
	_ = s.Store.UpsertLineup(ctx, store.LineupRow{
		MatchID: m.ID, UserID: "bot",
		CardIDs: parseIDs(ids), BattingOrder: parseIDs(deck.Lineup.BattingOrder),
		BowlingPlan: parseIDs(deck.Lineup.BowlingPlan),
		LockedAt: &now, Snapshot: snap, CaptainID: idPtr(deck.Lineup.CaptainID),
	})
	return m, nil
}

func (s *Service) CreatePvPMatch(ctx context.Context, user store.User) (store.MatchRow, bool, error) {
	band := trophy.Band(user.Trophies)
	opp, found, err := s.Q.PopOldestOther(ctx, band, user.ID)
	if err != nil {
		return store.MatchRow{}, false, err
	}
	if found {
		existing, err := s.Store.MatchesForUser(ctx, opp, 8)
		if err != nil {
			return store.MatchRow{}, false, err
		}
		for _, cand := range existing {
			if cand.Status == StatusMatching && cand.HomeUserID == opp {
				away := user.ID
				cand.AwayUserID = &away
				cand.IsBot = false
				cand.Status = StatusLineup
				if err := s.Store.UpdateMatch(ctx, cand); err != nil {
					return cand, false, err
				}
				return cand, true, nil
			}
		}
		seed := time.Now().UnixNano()
		m, err := s.Store.InsertMatch(ctx, store.MatchRow{
			HomeUserID: user.ID,
			AwayUserID: &opp,
			IsBot:      false,
			Status:     StatusLineup,
			Seed:       seed,
		})
		return m, true, err
	}
	if err := s.Q.Enqueue(ctx, band, user.ID); err != nil {
		return store.MatchRow{}, false, err
	}
	m, err := s.Store.InsertMatch(ctx, store.MatchRow{
		HomeUserID: user.ID,
		IsBot:      false,
		Status:     StatusMatching,
		Seed:       time.Now().UnixNano(),
	})
	return m, false, err
}

// LineupGrace is how long a player-vs-player opponent who has locked in waits
// before the other side's default team is locked for them. Bot matches never
// time out: nobody is waiting.
const LineupGrace = 3 * time.Minute

// LineupDeadline returns when the given user's lineup will be auto-locked, or
// nil if no deadline applies (bot match, opponent not locked, or already locked).
func LineupDeadline(m store.MatchRow, lineups []store.LineupRow, userID uuid.UUID) *time.Time {
	if m.IsBot || m.Status != StatusLineup || m.AwayUserID == nil {
		return nil
	}
	var mine, theirs *store.LineupRow
	for i := range lineups {
		if lineups[i].UserID == userID.String() {
			mine = &lineups[i]
		} else {
			theirs = &lineups[i]
		}
	}
	if (mine != nil && mine.LockedAt != nil) || theirs == nil || theirs.LockedAt == nil {
		return nil
	}
	d := theirs.LockedAt.Add(LineupGrace)
	return &d
}

// LockStaleLineup auto-locks the idle side of a player-vs-player match with
// their saved default once the other side has waited LineupGrace.
func (s *Service) LockStaleLineup(ctx context.Context, m store.MatchRow) error {
	if m.IsBot || m.Status != StatusLineup || m.AwayUserID == nil {
		return nil
	}
	lus, err := s.Store.Lineups(ctx, m.ID)
	if err != nil {
		return err
	}
	for _, uid := range []uuid.UUID{m.HomeUserID, *m.AwayUserID} {
		d := LineupDeadline(m, lus, uid)
		if d == nil || time.Now().Before(*d) {
			continue
		}
		u, err := s.Store.UserByID(ctx, uid)
		if err != nil {
			return err
		}
		req, err := s.DefaultLineup(ctx, u)
		if err != nil {
			return err
		}
		log.Printf("match %s: lineup timed out for %s, using their default", m.ID, u.Username)
		return s.LockLineup(ctx, u, m.ID, req)
	}
	return nil
}

// DefaultLineup is the user's saved team and strategy if it is still valid
// (every card still owned, rules still met); otherwise their best cards by
// overall with balanced tactics.
func (s *Service) DefaultLineup(ctx context.Context, user store.User) (LineupReq, error) {
	owned, err := s.Store.CardsForUser(ctx, user.ID)
	if err != nil {
		return LineupReq{}, err
	}
	byID := map[string]store.CardRow{}
	for _, c := range owned {
		byID[c.ID.String()] = c
	}
	if sq, err := s.Store.Squad(ctx, user.ID); err == nil && len(sq.CardIDs) == 7 {
		req := LineupReq{CardIDs: strs(sq.CardIDs), BattingOrder: strs(sq.BattingOrder), BowlingPlan: strs(sq.BowlingPlan)}
		if sq.CaptainID != nil {
			req.CaptainID = sq.CaptainID.String()
		}
		if lu, ok := toLineup(user, req, byID); ok {
			if req.CaptainID == "" {
				req.CaptainID = engine.CaptainOf(lu).ID
				lu.CaptainID = req.CaptainID
			}
			if engine.ValidateLineup(lu) == nil {
				return req, nil
			}
		}
	}
	byRole := map[engine.Role][]store.CardRow{}
	for _, c := range owned {
		byRole[c.Player.Role] = append(byRole[c.Player.Role], c)
	}
	var pick []engine.Card
	for role, n := range map[engine.Role]int{engine.RoleBAT: 3, engine.RoleWK: 1, engine.RoleAR: 1, engine.RoleBOWL: 2} {
		cs := byRole[role]
		sort.Slice(cs, func(i, j int) bool { return engine.Overall(cs[i].ToEngine()) > engine.Overall(cs[j].ToEngine()) })
		for i := 0; i < n && i < len(cs); i++ {
			pick = append(pick, cs[i].ToEngine())
		}
	}
	if len(pick) != 7 {
		return LineupReq{}, fmt.Errorf("not enough cards to field a team")
	}
	return LineupReq{
		CardIDs: cardIDs(pick), BattingOrder: engine.DefaultBattingOrder(pick),
		BowlingPlan: engine.DefaultBowlingPlan(pick), CaptainID: engine.CaptainOf(engine.Lineup{Cards: pick}).ID,
	}, nil
}

// SaveDefault validates and stores the user's default team and strategy.
func (s *Service) SaveDefault(ctx context.Context, user store.User, req LineupReq) error {
	owned, err := s.Store.CardsForUser(ctx, user.ID)
	if err != nil {
		return err
	}
	byID := map[string]store.CardRow{}
	for _, c := range owned {
		byID[c.ID.String()] = c
	}
	lu, ok := toLineup(user, req, byID)
	if !ok {
		return fmt.Errorf("every card in the squad must be one you own")
	}
	if err := engine.ValidateLineup(lu); err != nil {
		return err
	}
	return s.Store.SaveSquad(ctx, user.ID, store.SquadRow{
		CardIDs: parseIDs(req.CardIDs), BattingOrder: parseIDs(req.BattingOrder), BowlingPlan: parseIDs(req.BowlingPlan),
		CaptainID: idPtr(req.CaptainID),
	})
}

func toLineup(user store.User, req LineupReq, owned map[string]store.CardRow) (engine.Lineup, bool) {
	var cs []engine.Card
	for _, id := range req.CardIDs {
		c, ok := owned[id]
		if !ok {
			return engine.Lineup{}, false
		}
		cs = append(cs, c.ToEngine())
	}
	return engine.Lineup{
		UserID: user.ID.String(), Cards: cs, BattingOrder: req.BattingOrder,
		BowlingPlan: req.BowlingPlan, CaptainID: req.CaptainID,
	}, true
}

func strs(ids []uuid.UUID) []string {
	out := make([]string, len(ids))
	for i, id := range ids {
		out[i] = id.String()
	}
	return out
}

func (s *Service) FallbackBotIfNeeded(ctx context.Context, m store.MatchRow, user store.User) (store.MatchRow, error) {
	if m.Status != StatusMatching {
		return m, nil
	}
	band := trophy.Band(user.Trophies)
	waited, _ := s.Q.WaitedSeconds(ctx, band, user.ID)
	opp, found, _ := s.Q.PopOldestOther(ctx, band, user.ID)
	if found {
		m.AwayUserID = &opp
		m.Status = StatusLineup
		_ = s.Q.Dequeue(ctx, band, user.ID)
		if err := s.Store.UpdateMatch(ctx, m); err != nil {
			return m, err
		}
		return m, nil
	}
	if waited < 20 {
		return m, nil
	}
	_ = s.Q.Dequeue(ctx, band, user.ID)
	catalog, err := s.Store.Players(ctx)
	if err != nil {
		return m, err
	}
	deck := bot.Generate(m.Seed, user.Trophies, catalog)
	prof, _ := json.Marshal(deck.Profile)
	m.IsBot = true
	m.BotProfile = prof
	m.Status = StatusLineup
	if err := s.Store.UpdateMatch(ctx, m); err != nil {
		return m, err
	}
	snap, _ := json.Marshal(deck.Lineup.Cards)
	now := time.Now()
	ids := cardIDs(deck.Lineup.Cards)
	_ = s.Store.UpsertLineup(ctx, store.LineupRow{
		MatchID: m.ID, UserID: "bot",
		CardIDs: parseIDs(ids), BattingOrder: parseIDs(deck.Lineup.BattingOrder),
		BowlingPlan: parseIDs(deck.Lineup.BowlingPlan),
		LockedAt: &now, Snapshot: snap, CaptainID: idPtr(deck.Lineup.CaptainID),
	})
	return m, nil
}

// LineupReq is what a player chooses before a match: the seven, the captain,
// and the batting and bowling orders. Tactics and the toss call are the captain's.
type LineupReq struct {
	CardIDs      []string `json:"cardIds"`
	BattingOrder []string `json:"battingOrder"`
	BowlingPlan  []string `json:"bowlingPlan"`
	CaptainID    string   `json:"captainId"`
}

func (s *Service) LockLineup(ctx context.Context, user store.User, matchID uuid.UUID, req LineupReq) error {
	m, err := s.Store.MatchByID(ctx, matchID)
	if err != nil {
		return err
	}
	if m.Status != StatusLineup && m.Status != StatusMatching {
		return fmt.Errorf("match is not accepting lineups")
	}
	if m.HomeUserID != user.ID && (m.AwayUserID == nil || *m.AwayUserID != user.ID) {
		return fmt.Errorf("not your match")
	}
	owned, err := s.Store.CardsForUser(ctx, user.ID)
	if err != nil {
		return err
	}
	byID := map[string]store.CardRow{}
	for _, c := range owned {
		byID[c.ID.String()] = c
	}
	var engCards []engine.Card
	for _, id := range req.CardIDs {
		c, ok := byID[id]
		if !ok {
			return fmt.Errorf("card %s not owned", id)
		}
		engCards = append(engCards, c.ToEngine())
	}
	lu := engine.Lineup{
		UserID: user.ID.String(), Cards: engCards,
		BattingOrder: req.BattingOrder, BowlingPlan: req.BowlingPlan, CaptainID: req.CaptainID,
	}
	if err := engine.ValidateLineup(lu); err != nil {
		return err
	}
	now := time.Now()
	snap, _ := json.Marshal(engCards)
	if err := s.Store.UpsertLineup(ctx, store.LineupRow{
		MatchID: matchID, UserID: user.ID.String(),
		CardIDs: parseIDs(req.CardIDs), BattingOrder: parseIDs(req.BattingOrder),
		BowlingPlan: parseIDs(req.BowlingPlan),
		LockedAt: &now, Snapshot: snap, CaptainID: idPtr(req.CaptainID),
	}); err != nil {
		return err
	}
	return s.trySimulate(ctx, matchID)
}

// RewardCardsPerWin is how many new cards a win earns.
const RewardCardsPerWin = 3

// grantRewards gives the win's cards. With boosted, the first card is rolled
// with the next arena's odds (a win-streak reward). Each arena reached for the
// first time adds a milestone card of at least that arena's guaranteed rarity.
func (s *Service) grantRewards(ctx context.Context, user store.User, matchID uuid.UUID, boosted bool, milestones []trophy.Arena) error {
	catalog, err := s.Store.Players(ctx)
	if err != nil {
		return err
	}
	byR := map[engine.Rarity][]engine.Card{}
	for _, p := range catalog {
		byR[p.Rarity] = append(byR[p.Rarity], p)
	}
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	var ids []uuid.UUID
	for i := 0; i < RewardCardsPerWin; i++ {
		arena := user.Arena
		if boosted && i == 0 {
			if next := trophy.NextAfter(user.Arena); next != nil {
				arena = next.Name
			}
		}
		r := cards.RollRarity(rng, arena)
		pool := byR[r]
		if len(pool) == 0 {
			pool = catalog
		}
		p := pool[rng.Intn(len(pool))]
		c, err := s.Store.InsertCard(ctx, user.ID, p.PlayerID, r, 1)
		if err != nil {
			return err
		}
		ids = append(ids, c.ID)
	}
	for _, a := range milestones {
		r := cards.MilestoneRarity(rng, a.Name)
		pool := byR[r]
		if len(pool) == 0 {
			pool = catalog
		}
		p := pool[rng.Intn(len(pool))]
		c, err := s.Store.InsertCard(ctx, user.ID, p.PlayerID, r, 1)
		if err != nil {
			return err
		}
		ids = append(ids, c.ID)
	}
	return s.Store.InsertReward(ctx, user.ID, matchID, ids)
}

// grantMatchXP rates each of the user's cards and pays performance XP (plus
// the consolation XP on a loss or tie), recording both in one transaction.
func (s *Service) grantMatchXP(ctx context.Context, user store.User, matchID uuid.UUID, lu engine.Lineup, ratings map[string]float64, lost bool) error {
	var entries []store.MatchXPEntry
	for _, c := range lu.Cards {
		id, err := uuid.Parse(c.ID)
		if err != nil {
			continue
		}
		row, err := s.Store.CardByID(ctx, id)
		if err != nil || row.UserID != user.ID {
			continue // sacrificed since the match, or not this user's
		}
		rating, ok := ratings[c.ID]
		if !ok {
			rating = engine.Ratings.Base
		}
		gain := cards.PerformanceXP(rating)
		if lost {
			gain += cards.LossXP()
		}
		lvl, xp, _ := cards.ApplyXP(row.Level, row.XP, row.Rarity, gain)
		entries = append(entries, store.MatchXPEntry{CardID: id, Rating: rating, XP: gain, NewLevel: lvl, NewXP: xp})
	}
	return s.Store.RecordMatchXP(ctx, matchID, user.ID, entries)
}

// MaxSacrifices caps one training session.
const MaxSacrifices = 20

// TrainResult describes a training session (real or previewed).
type TrainResult struct {
	XPGained      int `json:"xpGained"`
	LevelBefore   int `json:"levelBefore"`
	LevelAfter    int `json:"levelAfter"`
	XPAfter       int `json:"xpAfter"`
	XPToNext      int `json:"xpToNext"`
	Wasted        int `json:"wasted"`
	OverallBefore int `json:"overallBefore"`
	OverallAfter  int `json:"overallAfter"`
	LevelCap      int `json:"levelCap"`
}

func planTraining(target store.CardRow, sacs []store.CardRow) (TrainResult, error) {
	cap := engine.LevelCap(target.Rarity)
	if target.Level >= cap {
		return TrainResult{}, fmt.Errorf("%s is already at the level cap (%d)", target.Player.Name, cap)
	}
	gain := 0
	for _, c := range sacs {
		gain += cards.XPForSacrifice(engine.Overall(c.ToEngine()), c.Player.Role, target.Player.Role, c.PlayerID == target.PlayerID)
	}
	lvl, xp, wasted := cards.ApplyXP(target.Level, target.XP, target.Rarity, gain)
	before := target.ToEngine()
	after := before
	after.Level = lvl
	return TrainResult{
		XPGained: gain, LevelBefore: target.Level, LevelAfter: lvl, XPAfter: xp, XPToNext: cards.XPToNext(lvl),
		Wasted: wasted, OverallBefore: engine.Overall(before), OverallAfter: engine.Overall(after), LevelCap: cap,
	}, nil
}

// checkSacrifices rejects duplicates, the target itself, oversized batches,
// and cards in the user's saved squad.
func (s *Service) checkSacrifices(ctx context.Context, user store.User, targetID uuid.UUID, sacIDs []uuid.UUID) error {
	if len(sacIDs) == 0 {
		return fmt.Errorf("choose at least one card to sacrifice")
	}
	if len(sacIDs) > MaxSacrifices {
		return fmt.Errorf("sacrifice at most %d cards at a time", MaxSacrifices)
	}
	seen := map[uuid.UUID]bool{}
	for _, id := range sacIDs {
		if id == targetID {
			return fmt.Errorf("cannot sacrifice the card being trained")
		}
		if seen[id] {
			return fmt.Errorf("card %s is listed twice", id)
		}
		seen[id] = true
	}
	squad, err := s.Store.Squad(ctx, user.ID)
	if err != nil {
		return err
	}
	for _, id := range squad.CardIDs {
		if seen[id] {
			c, _ := s.Store.CardByID(ctx, id)
			return fmt.Errorf("%s is in your saved squad. Swap them out of the squad first", c.Player.Name)
		}
	}
	return nil
}

// PreviewTraining computes the result of a training session without changing anything.
func (s *Service) PreviewTraining(ctx context.Context, user store.User, targetID uuid.UUID, sacIDs []uuid.UUID) (TrainResult, error) {
	if err := s.checkSacrifices(ctx, user, targetID, sacIDs); err != nil {
		return TrainResult{}, err
	}
	target, err := s.Store.CardByID(ctx, targetID)
	if err != nil || target.UserID != user.ID {
		return TrainResult{}, store.ErrNotOwned
	}
	var sacs []store.CardRow
	for _, id := range sacIDs {
		c, err := s.Store.CardByID(ctx, id)
		if err != nil || c.UserID != user.ID {
			return TrainResult{}, store.ErrNotOwned
		}
		sacs = append(sacs, c)
	}
	return planTraining(target, sacs)
}

// Train sacrifices cards to level up the target, all in one transaction.
func (s *Service) Train(ctx context.Context, user store.User, targetID uuid.UUID, sacIDs []uuid.UUID) (store.CardRow, TrainResult, error) {
	if err := s.checkSacrifices(ctx, user, targetID, sacIDs); err != nil {
		return store.CardRow{}, TrainResult{}, err
	}
	var result TrainResult
	_, err := s.Store.Train(ctx, user.ID, targetID, sacIDs, func(target store.CardRow, sacs []store.CardRow) (int, int, int, error) {
		r, err := planTraining(target, sacs)
		if err != nil {
			return 0, 0, 0, err
		}
		result = r
		return r.LevelAfter, r.XPAfter, r.XPGained, nil
	})
	if err != nil {
		return store.CardRow{}, TrainResult{}, err
	}
	updated, err := s.Store.CardByID(ctx, targetID)
	return updated, result, err
}

func (s *Service) GrantStarter(ctx context.Context, user store.User) ([]store.CardRow, error) {
	catalog, err := s.Store.Players(ctx)
	if err != nil {
		return nil, err
	}
	byRole := map[engine.Role][]engine.Card{}
	for _, p := range catalog {
		if p.Rarity == engine.RarityBronze || p.Rarity == engine.RaritySilver {
			byRole[p.Role] = append(byRole[p.Role], p)
		}
	}
	rng := rand.New(rand.NewSource(time.Now().UnixNano() + int64(len(user.Username))))
	need := []engine.Role{
		engine.RoleBAT, engine.RoleBAT, engine.RoleBAT,
		engine.RoleWK, engine.RoleAR, engine.RoleBOWL, engine.RoleBOWL,
		engine.RoleBAT, engine.RoleBOWL, engine.RoleAR,
	}
	var out []store.CardRow
	used := map[string]int{}
	for _, role := range need {
		pool := byRole[role]
		if len(pool) == 0 {
			continue
		}
		p := pool[rng.Intn(len(pool))]
		tries := 0
		for used[p.PlayerID] > 0 && tries < 8 {
			p = pool[rng.Intn(len(pool))]
			tries++
		}
		used[p.PlayerID]++
		rarity := p.Rarity
		if rng.Intn(100) < 12 {
			rarity = engine.RaritySilver
		}
		c, err := s.Store.InsertCard(ctx, user.ID, p.PlayerID, rarity, 1)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, nil
}

func lineupFromRow(l store.LineupRow) (engine.Lineup, error) {
	var cards []engine.Card
	if err := json.Unmarshal(l.Snapshot, &cards); err != nil {
		return engine.Lineup{}, err
	}
	ids := func(u []uuid.UUID) []string {
		var s []string
		for _, x := range u {
			s = append(s, x.String())
		}
		return s
	}
	var tac engine.Tactics
	if len(l.Tactics) > 0 {
		_ = json.Unmarshal(l.Tactics, &tac)
	}
	captain := ""
	if l.CaptainID != nil {
		captain = l.CaptainID.String()
	}
	return engine.Lineup{
		UserID: l.UserID, Cards: cards,
		BattingOrder: ids(l.BattingOrder), BowlingPlan: ids(l.BowlingPlan),
		TossPref: l.TossPref, Tactics: tac, CaptainID: captain,
	}, nil
}

func cardIDs(cs []engine.Card) []string {
	var out []string
	for _, c := range cs {
		out = append(out, c.ID)
	}
	return out
}

func parseIDs(ss []string) []uuid.UUID {
	var out []uuid.UUID
	for _, s := range ss {
		id, err := uuid.Parse(s)
		if err != nil {
			// bot cards use generated UUIDs; if invalid, skip
			continue
		}
		out = append(out, id)
	}
	return out
}

func mustJSON(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}

func idPtr(s string) *uuid.UUID {
	id, err := uuid.Parse(s)
	if err != nil {
		return nil
	}
	return &id
}
