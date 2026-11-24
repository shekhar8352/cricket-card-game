package store

import (
	"context"

	"github.com/google/uuid"
)

// SetBreakDecision records a side's innings-break call and optional new order.
func (s *Store) SetBreakDecision(ctx context.Context, matchID uuid.UUID, userID, call string, order []uuid.UUID) error {
	_, err := s.Pool.Exec(ctx, `
		UPDATE match_lineups SET break_call=$3, break_order=$4, break_locked_at=now()
		WHERE match_id=$1 AND user_id=$2 AND break_locked_at IS NULL`, matchID, userID, call, order)
	return err
}

// SetSuperPicks records a side's Super Over picks.
func (s *Store) SetSuperPicks(ctx context.Context, matchID uuid.UUID, userID string, picks []byte) error {
	_, err := s.Pool.Exec(ctx, `
		UPDATE match_lineups SET super_picks=$3, super_locked_at=now()
		WHERE match_id=$1 AND user_id=$2 AND super_locked_at IS NULL`, matchID, userID, picks)
	return err
}

// AddCaptainRep adds reputation to a card, capped at 100.
func (s *Store) AddCaptainRep(ctx context.Context, cardID uuid.UUID, delta int) error {
	_, err := s.Pool.Exec(ctx, `UPDATE cards SET captain_rep = LEAST(100, captain_rep + $2) WHERE id=$1`, cardID, delta)
	return err
}

// RivalryDelta is one bowler-vs-batter tally from a match.
type RivalryDelta struct {
	Bowler, Batter          string // player IDs
	Balls, Runs, Dismissals int
}

func (s *Store) RecordRivalries(ctx context.Context, userID uuid.UUID, ds []RivalryDelta) error {
	if len(ds) == 0 {
		return nil
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	for _, d := range ds {
		if _, err := tx.Exec(ctx, `
			INSERT INTO rivalries (user_id, bowler_player_id, batter_player_id, balls, runs, dismissals)
			VALUES ($1,$2,$3,$4,$5,$6)
			ON CONFLICT (user_id, bowler_player_id, batter_player_id) DO UPDATE SET
				balls = rivalries.balls + EXCLUDED.balls, runs = rivalries.runs + EXCLUDED.runs,
				dismissals = rivalries.dismissals + EXCLUDED.dismissals`,
			userID, d.Bowler, d.Batter, d.Balls, d.Runs, d.Dismissals); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// Rivalry is a head-to-head record from one user's matches.
type Rivalry struct {
	Bowler     string `json:"bowler"`
	Batter     string `json:"batter"`
	Balls      int    `json:"balls"`
	Runs       int    `json:"runs"`
	Dismissals int    `json:"dismissals"`
}

// Rivalries returns the user's head-to-heads that involve any of the given players.
func (s *Store) Rivalries(ctx context.Context, userID uuid.UUID, players []string) ([]Rivalry, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT bowler_player_id, batter_player_id, balls, runs, dismissals FROM rivalries
		WHERE user_id=$1 AND (bowler_player_id = ANY($2) OR batter_player_id = ANY($2))
		ORDER BY dismissals DESC, balls DESC`, userID, players)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Rivalry
	for rows.Next() {
		var r Rivalry
		if err := rows.Scan(&r.Bowler, &r.Batter, &r.Balls, &r.Runs, &r.Dismissals); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// WinStreak counts the user's consecutive wins in completed matches, newest first.
func (s *Store) WinStreak(ctx context.Context, userID uuid.UUID) (int, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT winner_user_id FROM matches
		WHERE (home_user_id=$1 OR away_user_id=$1) AND status='COMPLETE' AND mode = 'ranked'
		ORDER BY completed_at DESC NULLS LAST, created_at DESC LIMIT 50`, userID)
	if err != nil {
		return 0, err
	}
	defer rows.Close()
	n := 0
	for rows.Next() {
		var w *uuid.UUID
		if err := rows.Scan(&w); err != nil {
			return 0, err
		}
		if w == nil || *w != userID {
			break
		}
		n++
	}
	return n, rows.Err()
}

// TransitionStatus moves a match from one status to another only if it is
// still in the expected state. It reports whether this caller won the move.
func (s *Store) TransitionStatus(ctx context.Context, id uuid.UUID, from, to string) (bool, error) {
	tag, err := s.Pool.Exec(ctx, `UPDATE matches SET status=$3 WHERE id=$1 AND status=$2`, id, from, to)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

// OpenRoomByCode finds a friendly room still waiting for a guest.
func (s *Store) OpenRoomByCode(ctx context.Context, code string) (MatchRow, error) {
	var m MatchRow
	err := s.Pool.QueryRow(ctx, `SELECT `+matchCols+` FROM matches WHERE room_code=$1 AND status='WAITING_ROOM'`, code).Scan(matchDest(&m)...)
	return m, err
}

// OpenRoomForHost returns the host's room that is still waiting for a guest, if any.
func (s *Store) OpenRoomForHost(ctx context.Context, userID uuid.UUID) (MatchRow, error) {
	var m MatchRow
	err := s.Pool.QueryRow(ctx, `SELECT `+matchCols+` FROM matches
		WHERE home_user_id=$1 AND status='WAITING_ROOM' ORDER BY created_at DESC LIMIT 1`, userID).Scan(matchDest(&m)...)
	return m, err
}

// ClaimRoom seats the guest in a waiting room. It reports false if someone
// else got there first or the room closed.
func (s *Store) ClaimRoom(ctx context.Context, id, guest uuid.UUID, nextStatus string) (bool, error) {
	tag, err := s.Pool.Exec(ctx, `UPDATE matches SET away_user_id=$2, status=$3
		WHERE id=$1 AND status='WAITING_ROOM' AND home_user_id<>$2`, id, guest, nextStatus)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

// JoinedRoom returns the guest's match from this room code, if they already joined it.
func (s *Store) JoinedRoom(ctx context.Context, code string, guest uuid.UUID) (MatchRow, error) {
	var m MatchRow
	err := s.Pool.QueryRow(ctx, `SELECT `+matchCols+` FROM matches
		WHERE room_code=$1 AND away_user_id=$2 AND status <> 'CANCELLED'
		ORDER BY created_at DESC LIMIT 1`, code, guest).Scan(matchDest(&m)...)
	return m, err
}
