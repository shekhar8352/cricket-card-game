package match

import (
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
)

type Service struct {
	Store *store.Store
	Q     *matchmaking.Queue
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
		BowlingPlan: parseIDs(deck.Lineup.BowlingPlan), TossPref: "chase",
		LockedAt: &now, Snapshot: snap,
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

func (s *Service) AutoPickIfTimedOut(ctx context.Context, m store.MatchRow, user store.User) error {
	if m.Status != StatusLineup {
		return nil
	}
	if time.Since(m.CreatedAt) < 60*time.Second {
		return nil
	}
	lus, err := s.Store.Lineups(ctx, m.ID)
	if err != nil {
		return err
	}
	for _, l := range lus {
		if l.UserID == user.ID.String() && l.LockedAt != nil {
			return nil
		}
	}
	owned, err := s.Store.CardsForUser(ctx, user.ID)
	if err != nil {
		return err
	}
	byRole := map[engine.Role][]store.CardRow{}
	for _, c := range owned {
		byRole[c.Player.Role] = append(byRole[c.Player.Role], c)
	}
	need := []engine.Role{engine.RoleBAT, engine.RoleBAT, engine.RoleBAT, engine.RoleWK, engine.RoleAR, engine.RoleBOWL, engine.RoleBOWL}
	var pick []engine.Card
	used := map[string]bool{}
	for _, role := range need {
		for _, c := range byRole[role] {
			if used[c.ID.String()] {
				continue
			}
			used[c.ID.String()] = true
			pick = append(pick, c.ToEngine())
			break
		}
	}
	if len(pick) != 7 {
		return nil
	}
	req := LineupReq{
		CardIDs: cardIDs(pick),
		BattingOrder: engine.DefaultBattingOrder(pick),
		BowlingPlan:  engine.DefaultBowlingPlan(pick),
		TossPref:     "chase",
	}
	return s.LockLineup(ctx, user, m.ID, req)
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
		BowlingPlan: parseIDs(deck.Lineup.BowlingPlan), TossPref: "chase",
		LockedAt: &now, Snapshot: snap,
	})
	return m, nil
}

type LineupReq struct {
	CardIDs      []string `json:"cardIds"`
	BattingOrder []string `json:"battingOrder"`
	BowlingPlan  []string `json:"bowlingPlan"`
	TossPref     string   `json:"tossPref"`
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
		BattingOrder: req.BattingOrder, BowlingPlan: req.BowlingPlan, TossPref: req.TossPref,
	}
	if lu.TossPref == "" {
		lu.TossPref = "chase"
	}
	if err := engine.ValidateLineup(lu); err != nil {
		return err
	}
	now := time.Now()
	snap, _ := json.Marshal(engCards)
	if err := s.Store.UpsertLineup(ctx, store.LineupRow{
		MatchID: matchID, UserID: user.ID.String(),
		CardIDs: parseIDs(req.CardIDs), BattingOrder: parseIDs(req.BattingOrder),
		BowlingPlan: parseIDs(req.BowlingPlan), TossPref: lu.TossPref,
		LockedAt: &now, Snapshot: snap,
	}); err != nil {
		return err
	}
	return s.trySimulate(ctx, matchID)
}

func (s *Service) trySimulate(ctx context.Context, matchID uuid.UUID) error {
	m, err := s.Store.MatchByID(ctx, matchID)
	if err != nil {
		return err
	}
	lus, err := s.Store.Lineups(ctx, matchID)
	if err != nil {
		return err
	}
	homeU, err := s.Store.UserByID(ctx, m.HomeUserID)
	if err != nil {
		return err
	}
	var homeL, awayL *store.LineupRow
	for i := range lus {
		if lus[i].UserID == m.HomeUserID.String() {
			homeL = &lus[i]
		} else {
			awayL = &lus[i]
		}
	}
	if homeL == nil || homeL.LockedAt == nil {
		return nil
	}
	if !m.IsBot {
		if m.AwayUserID == nil {
			return nil
		}
		if awayL == nil || awayL.LockedAt == nil {
			return nil
		}
	} else if awayL == nil {
		return nil
	}

	homeLU, err := lineupFromRow(*homeL)
	if err != nil {
		return err
	}
	awayLU, err := lineupFromRow(*awayL)
	if err != nil {
		return err
	}

	m.Status = StatusSimulating
	_ = s.Store.UpdateMatch(ctx, m)

	res, err := engine.Simulate(m.Seed, homeLU, awayLU, engine.TossResult{})
	if err != nil {
		return err
	}
	toss, _ := json.Marshal(res.Toss)
	result, _ := json.Marshal(res)
	balls, _ := json.Marshal(res.Balls)

	oppTrophies := homeU.Trophies
	if m.IsBot {
		var p bot.Profile
		_ = json.Unmarshal(m.BotProfile, &p)
		oppTrophies = p.Trophies
	} else if m.AwayUserID != nil {
		awayU, err := s.Store.UserByID(ctx, *m.AwayUserID)
		if err == nil {
			oppTrophies = awayU.Trophies
		}
	}

	homeWon := res.Winner == "home"
	awayWon := res.Winner == "away"
	hd := trophy.Delta(homeU.Trophies, oppTrophies, homeWon)
	if res.Winner == "tie" {
		hd = 0
	}
	ht := trophy.Apply(homeU.Trophies, hd)
	_ = s.Store.UpdateTrophies(ctx, homeU.ID, ht, trophy.ArenaFor(ht).Name)
	if s.Q != nil {
		_ = s.Q.SetScore(ctx, homeU.ID, ht)
	}

	var winner *uuid.UUID
	if homeWon {
		id := homeU.ID
		winner = &id
	}
	ad := 0
	if !m.IsBot && m.AwayUserID != nil {
		awayU, err := s.Store.UserByID(ctx, *m.AwayUserID)
		if err == nil {
			ad = trophy.Delta(awayU.Trophies, homeU.Trophies, awayWon)
			if res.Winner == "tie" {
				ad = 0
			}
			at := trophy.Apply(awayU.Trophies, ad)
			_ = s.Store.UpdateTrophies(ctx, awayU.ID, at, trophy.ArenaFor(at).Name)
			if s.Q != nil {
				_ = s.Q.SetScore(ctx, awayU.ID, at)
			}
			if awayWon {
				id := awayU.ID
				winner = &id
			}
		}
	}

	now := time.Now()
	m.Status = StatusComplete
	m.Toss = toss
	m.Result = result
	m.BallLog = balls
	m.WinnerUserID = winner
	m.TrophyDeltaHome = &hd
	m.TrophyDeltaAway = &ad
	m.CompletedAt = &now
	if err := s.Store.UpdateMatch(ctx, m); err != nil {
		return err
	}

	if homeWon {
		if err := s.grantRewards(ctx, homeU, m.ID); err != nil {
			return err
		}
	} else {
		_ = s.grantLossXP(ctx, homeU, homeLU)
	}
	if !m.IsBot && m.AwayUserID != nil {
		awayU, err := s.Store.UserByID(ctx, *m.AwayUserID)
		if err == nil {
			if awayWon {
				_ = s.grantRewards(ctx, awayU, m.ID)
			} else {
				_ = s.grantLossXP(ctx, awayU, awayLU)
			}
		}
	}
	if s.Q != nil {
		payload, _ := json.Marshal(map[string]any{"type": "complete", "matchId": m.ID})
		_ = s.Q.Publish(ctx, m.ID, string(payload))
	}
	return nil
}

func (s *Service) grantRewards(ctx context.Context, user store.User, matchID uuid.UUID) error {
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
	for i := 0; i < 3; i++ {
		r := cards.RollRarity(rng, user.Arena)
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

func (s *Service) grantLossXP(ctx context.Context, user store.User, lu engine.Lineup) error {
	for _, c := range lu.Cards {
		id, err := uuid.Parse(c.ID)
		if err != nil {
			continue
		}
		row, err := s.Store.CardByID(ctx, id)
		if err != nil {
			continue
		}
		xp := row.XP + cards.LossXP()
		lvl := row.Level
		for lvl < engine.LevelCap(row.Rarity) && xp >= cards.XPToNext(lvl) {
			xp -= cards.XPToNext(lvl)
			lvl++
		}
		_ = s.Store.UpdateCardXP(ctx, id, xp, lvl)
	}
	return nil
}

func (s *Service) Train(ctx context.Context, user store.User, targetID uuid.UUID, sacIDs []uuid.UUID) (store.CardRow, int, error) {
	target, err := s.Store.CardByID(ctx, targetID)
	if err != nil {
		return target, 0, err
	}
	if target.UserID != user.ID {
		return target, 0, fmt.Errorf("not your card")
	}
	if target.Level >= engine.LevelCap(target.Rarity) && target.XP >= cards.XPToNext(target.Level) {
		return target, 0, fmt.Errorf("card is at level cap")
	}
	if target.Level >= engine.LevelCap(target.Rarity) {
		return target, 0, fmt.Errorf("card is at level cap")
	}
	xp := 0
	for _, id := range sacIDs {
		if id == targetID {
			return target, 0, fmt.Errorf("cannot sacrifice the target card")
		}
		c, err := s.Store.CardByID(ctx, id)
		if err != nil {
			return target, 0, err
		}
		if c.UserID != user.ID {
			return target, 0, fmt.Errorf("not your card")
		}
		xp += cards.XPForSacrifice(c.Rarity, c.PlayerID == target.PlayerID)
	}
	newXP := target.XP + xp
	lvl := target.Level
	for lvl < engine.LevelCap(target.Rarity) && newXP >= cards.XPToNext(lvl) {
		newXP -= cards.XPToNext(lvl)
		lvl++
	}
	if err := s.Store.UpdateCardXP(ctx, targetID, newXP, lvl); err != nil {
		return target, 0, err
	}
	if err := s.Store.DeleteCards(ctx, sacIDs); err != nil {
		return target, 0, err
	}
	_ = s.Store.InsertTraining(ctx, user.ID, targetID, sacIDs, xp, lvl)
	updated, err := s.Store.CardByID(ctx, targetID)
	return updated, xp, err
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
	return engine.Lineup{
		UserID: l.UserID, Cards: cards,
		BattingOrder: ids(l.BattingOrder), BowlingPlan: ids(l.BowlingPlan),
		TossPref: l.TossPref,
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
