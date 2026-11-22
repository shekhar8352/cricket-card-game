package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// CardForm summarises a card's match ratings.
type CardForm struct {
	Avg     float64   `json:"avg"`
	Matches int       `json:"matches"`
	Best    float64   `json:"best"`
	Recent  []float64 `json:"recent"` // last 5, oldest first
}

// MatchXPEntry is one card's result from a finished match.
type MatchXPEntry struct {
	CardID   uuid.UUID
	Rating   float64
	XP       int
	NewLevel int
	NewXP    int
}

// RecordMatchXP stores ratings and applies XP for one user's cards in one
// transaction. It is idempotent per (card, match): a retry never pays twice.
func (s *Store) RecordMatchXP(ctx context.Context, matchID, userID uuid.UUID, entries []MatchXPEntry) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	for _, e := range entries {
		tag, err := tx.Exec(ctx, `
			INSERT INTO card_ratings (card_id, match_id, user_id, rating, xp)
			SELECT $1, $2, $3, $4, $5 WHERE EXISTS (SELECT 1 FROM cards WHERE id=$1 AND user_id=$3)
			ON CONFLICT (card_id, match_id) DO NOTHING`,
			e.CardID, matchID, userID, e.Rating, e.XP)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			continue // already recorded, or the card no longer exists
		}
		if _, err := tx.Exec(ctx, `UPDATE cards SET xp=$2, level=$3 WHERE id=$1`, e.CardID, e.NewXP, e.NewLevel); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// CardForms returns rating summaries for all of a user's cards that have played.
func (s *Store) CardForms(ctx context.Context, userID uuid.UUID) (map[uuid.UUID]CardForm, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT card_id, rating::float8,
			row_number() OVER (PARTITION BY card_id ORDER BY created_at DESC) AS rn
		FROM card_ratings WHERE user_id=$1
		ORDER BY card_id, created_at`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	type acc struct {
		sum    float64
		n      int
		best   float64
		recent []float64
	}
	tmp := map[uuid.UUID]*acc{}
	for rows.Next() {
		var id uuid.UUID
		var r float64
		var rn int
		if err := rows.Scan(&id, &r, &rn); err != nil {
			return nil, err
		}
		a := tmp[id]
		if a == nil {
			a = &acc{}
			tmp[id] = a
		}
		a.sum += r
		a.n++
		if r > a.best {
			a.best = r
		}
		if rn <= 5 {
			a.recent = append(a.recent, r)
		}
	}
	out := make(map[uuid.UUID]CardForm, len(tmp))
	for id, a := range tmp {
		out[id] = CardForm{Avg: float64(int(a.sum/float64(a.n)*10+0.5)) / 10, Matches: a.n, Best: a.best, Recent: a.recent}
	}
	return out, rows.Err()
}

// MatchXP returns what each of the user's cards earned in one match.
func (s *Store) MatchXP(ctx context.Context, matchID, userID uuid.UUID) (map[string]int, error) {
	rows, err := s.Pool.Query(ctx, `SELECT card_id, xp FROM card_ratings WHERE match_id=$1 AND user_id=$2`, matchID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]int{}
	for rows.Next() {
		var id uuid.UUID
		var xp int
		if err := rows.Scan(&id, &xp); err != nil {
			return nil, err
		}
		out[id.String()] = xp
	}
	return out, rows.Err()
}

// TrainPlan decides the outcome of a training session from locked card rows.
type TrainPlan func(target CardRow, sacrifices []CardRow) (newLevel, newXP, gained int, err error)

var ErrNotOwned = errors.New("not your card")

// Train locks the target and sacrifice cards, applies plan, and commits the
// XP update, the deletions and the log together, so a failure never leaves
// XP granted with the sacrificed cards still in place (or the reverse).
func (s *Store) Train(ctx context.Context, userID, targetID uuid.UUID, sacIDs []uuid.UUID, plan TrainPlan) (int, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	lock := func(id uuid.UUID) (CardRow, error) {
		c, err := scanCard(tx.QueryRow(ctx, cardSelect+` WHERE c.id=$1 FOR UPDATE OF c`, id))
		if errors.Is(err, pgx.ErrNoRows) {
			return c, fmt.Errorf("card %s not found", id)
		}
		if err == nil && c.UserID != userID {
			return c, ErrNotOwned
		}
		return c, err
	}
	target, err := lock(targetID)
	if err != nil {
		return 0, err
	}
	sacs := make([]CardRow, 0, len(sacIDs))
	for _, id := range sacIDs {
		c, err := lock(id)
		if err != nil {
			return 0, err
		}
		sacs = append(sacs, c)
	}
	lvl, xp, gained, err := plan(target, sacs)
	if err != nil {
		return 0, err
	}
	if _, err := tx.Exec(ctx, `UPDATE cards SET xp=$2, level=$3 WHERE id=$1`, targetID, xp, lvl); err != nil {
		return 0, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM cards WHERE id = ANY($1)`, sacIDs); err != nil {
		return 0, err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO training_log (user_id, target_card_id, sacrifice_ids, xp_gained, new_level)
		VALUES ($1,$2,$3,$4,$5)`, userID, targetID, sacIDs, gained, lvl); err != nil {
		return 0, err
	}
	return gained, tx.Commit(ctx)
}
