package httpapi

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/sudhanshushekhar/cricket-card-game/internal/engine"
	"github.com/sudhanshushekhar/cricket-card-game/internal/stats"
	"github.com/sudhanshushekhar/cricket-card-game/internal/store"
)

// myStats powers the Account page: profile details, collection summary, and
// career stats across every completed match.
func (s *Server) myStats(w http.ResponseWriter, r *http.Request) {
	out, _, err := s.career(r.Context(), userFrom(r))
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	writeJSON(w, 200, out)
}

// userProfile is another player's public profile, opened from the leaderboard:
// the same career stats as the Account page plus their saved default seven.
func (s *Server) userProfile(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "bad id", 400)
		return
	}
	u, err := s.Store.UserByID(ctx, id)
	if err == pgx.ErrNoRows {
		http.Error(w, "player not found", 404)
		return
	} else if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	out, cards, err := s.career(ctx, u)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	squad, err := s.publicSquad(ctx, u.ID, cards)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	out["squad"] = squad
	out["me"] = u.ID == userFrom(r).ID
	writeJSON(w, 200, out)
}

// publicSquad returns the user's saved default seven (cards in batting order),
// or nil when they haven't saved one. Cards since used up in training are skipped.
func (s *Server) publicSquad(ctx context.Context, userID uuid.UUID, owned []store.CardRow) (map[string]any, error) {
	sq, err := s.Store.Squad(ctx, userID)
	if err != nil || len(sq.CardIDs) == 0 {
		return nil, err
	}
	forms, err := s.Store.CardForms(ctx, userID)
	if err != nil {
		return nil, err
	}
	byID := map[uuid.UUID]store.CardRow{}
	for _, c := range owned {
		byID[c.ID] = c
	}
	order := sq.BattingOrder
	if len(order) == 0 {
		order = sq.CardIDs
	}
	cards := []map[string]any{}
	for _, id := range order {
		c, ok := byID[id]
		if !ok {
			continue
		}
		m := mapCard(c)
		if f, ok := forms[c.ID]; ok {
			m["form"] = f
		}
		cards = append(cards, m)
	}
	keep := func(ids []uuid.UUID) []uuid.UUID {
		out := []uuid.UUID{}
		for _, id := range ids {
			if _, ok := byID[id]; ok {
				out = append(out, id)
			}
		}
		return out
	}
	return map[string]any{
		"cards": cards, "battingOrder": keep(order), "bowlingPlan": keep(sq.BowlingPlan),
		"captainId": sq.CaptainID,
	}, nil
}

// career builds the account, collection and stats sections shared by the
// Account page and public profiles. It also returns the user's cards.
func (s *Server) career(ctx context.Context, u store.User) (map[string]any, []store.CardRow, error) {
	rows, err := s.Store.CompletedMatchesWithLineup(ctx, u.ID)
	if err != nil {
		return nil, nil, err
	}
	opponents := map[uuid.UUID]string{}
	matches := make([]stats.Match, 0, len(rows))
	for _, row := range rows {
		var res engine.MatchResult
		if err := json.Unmarshal(row.Result, &res); err != nil {
			continue
		}
		var cards []engine.Card
		_ = json.Unmarshal(row.Snapshot, &cards)

		side, delta := "home", row.TrophyDeltaHome
		oppID := row.AwayUserID
		if row.HomeUserID != u.ID {
			side, delta = "away", row.TrophyDeltaAway
			oppID = &row.HomeUserID
		}
		opp := "Bot"
		if row.IsBot {
			var p struct {
				Name string `json:"name"`
			}
			if json.Unmarshal(row.BotProfile, &p) == nil && p.Name != "" {
				opp = p.Name
			}
		} else if oppID != nil {
			name, ok := opponents[*oppID]
			if !ok {
				if ou, err := s.Store.UserByID(ctx, *oppID); err == nil {
					name = ou.Username
				}
				opponents[*oppID] = name
			}
			if name != "" {
				opp = name
			}
		}
		d := 0
		if delta != nil {
			d = *delta
		}
		matches = append(matches, stats.Match{
			ID: row.ID.String(), Side: side, Opponent: opp, VsBot: row.IsBot,
			Result: res, Cards: cards, TrophyDelta: d, PlayedAt: row.CreatedAt,
		})
	}

	cards, err := s.Store.CardsForUser(ctx, u.ID)
	if err != nil {
		return nil, nil, err
	}
	byRarity := map[string]int{"Bronze": 0, "Silver": 0, "Gold": 0, "Legend": 0}
	byRole := map[string]int{"BAT": 0, "WK": 0, "AR": 0, "BOWL": 0}
	var best map[string]any
	bestOverall := -1
	for _, c := range cards {
		byRarity[string(c.Rarity)]++
		byRole[string(c.Player.Role)]++
		if o := engine.Overall(c.ToEngine()); o > bestOverall {
			bestOverall, best = o, mapCard(c)
		}
	}

	rank, _ := s.Store.Rank(ctx, u.Trophies)
	total, _ := s.Store.CountUsers(ctx)
	account := publicUser(u)
	account["createdAt"] = u.CreatedAt
	account["rank"] = rank
	account["totalPlayers"] = total

	return map[string]any{
		"account": account,
		"collection": map[string]any{
			"total": len(cards), "byRarity": byRarity, "byRole": byRole, "best": best,
		},
		"stats": stats.Build(matches),
	}, cards, nil
}
