package store

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type TournamentRow struct {
	ID          uuid.UUID
	Code        string
	Name        string
	HostUserID  uuid.UUID
	Status      string
	Format      *string
	Awards      []byte
	CreatedAt   time.Time
	StartedAt   *time.Time
	CompletedAt *time.Time
}

type TournamentPlayer struct {
	UserID   uuid.UUID
	Username string
	Trophies int
	JoinedAt time.Time
}

// ErrTournamentFull and ErrTournamentClosed come back from AddTournamentPlayer.
var (
	ErrTournamentFull   = errors.New("this tournament is full")
	ErrTournamentClosed = errors.New("this tournament has already started")
)

const tournamentCols = `id, code, name, host_user_id, status, format, awards, created_at, started_at, completed_at`

// tournamentColsT is tournamentCols for queries that alias tournaments as t.
const tournamentColsT = `t.id, t.code, t.name, t.host_user_id, t.status, t.format, t.awards, t.created_at, t.started_at, t.completed_at`

func tournamentDest(t *TournamentRow) []any {
	return []any{&t.ID, &t.Code, &t.Name, &t.HostUserID, &t.Status, &t.Format, &t.Awards, &t.CreatedAt, &t.StartedAt, &t.CompletedAt}
}

// InsertTournament creates the tournament and seats the host as its first player.
func (s *Store) InsertTournament(ctx context.Context, t TournamentRow) (TournamentRow, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return t, err
	}
	defer tx.Rollback(ctx)
	if err := tx.QueryRow(ctx, `
		INSERT INTO tournaments (code, name, host_user_id, status) VALUES ($1,$2,$3,$4)
		RETURNING `+tournamentCols, t.Code, t.Name, t.HostUserID, t.Status).Scan(tournamentDest(&t)...); err != nil {
		return t, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO tournament_players (tournament_id, user_id) VALUES ($1,$2)`, t.ID, t.HostUserID); err != nil {
		return t, err
	}
	return t, tx.Commit(ctx)
}

func (s *Store) TournamentByID(ctx context.Context, id uuid.UUID) (TournamentRow, error) {
	var t TournamentRow
	err := s.Pool.QueryRow(ctx, `SELECT `+tournamentCols+` FROM tournaments WHERE id=$1`, id).Scan(tournamentDest(&t)...)
	return t, err
}

// OpenTournamentByCode finds a tournament lobby still taking players.
func (s *Store) OpenTournamentByCode(ctx context.Context, code string) (TournamentRow, error) {
	var t TournamentRow
	err := s.Pool.QueryRow(ctx, `SELECT `+tournamentCols+` FROM tournaments WHERE code=$1 AND status='LOBBY'`, code).Scan(tournamentDest(&t)...)
	return t, err
}

// TournamentByCodeForPlayer finds a tournament with this code the user is already in.
func (s *Store) TournamentByCodeForPlayer(ctx context.Context, code string, userID uuid.UUID) (TournamentRow, error) {
	var t TournamentRow
	err := s.Pool.QueryRow(ctx, `SELECT `+tournamentColsT+` FROM tournaments t
		JOIN tournament_players p ON p.tournament_id = t.id AND p.user_id = $2
		WHERE t.code=$1 AND t.status <> 'CANCELLED' ORDER BY t.created_at DESC LIMIT 1`, code, userID).Scan(tournamentDest(&t)...)
	return t, err
}

// AddTournamentPlayer seats the user in a lobby that has room. Joining twice is a no-op.
func (s *Store) AddTournamentPlayer(ctx context.Context, id, userID uuid.UUID, max int) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var status string
	if err := tx.QueryRow(ctx, `SELECT status FROM tournaments WHERE id=$1 FOR UPDATE`, id).Scan(&status); err != nil {
		return err
	}
	var n int
	var already bool
	if err := tx.QueryRow(ctx, `SELECT count(*), bool_or(user_id=$2) FROM tournament_players WHERE tournament_id=$1`, id, userID).Scan(&n, &already); err != nil {
		return err
	}
	if already {
		return nil
	}
	if status != "LOBBY" {
		return ErrTournamentClosed
	}
	if n >= max {
		return ErrTournamentFull
	}
	if _, err := tx.Exec(ctx, `INSERT INTO tournament_players (tournament_id, user_id) VALUES ($1,$2)`, id, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// RemoveTournamentPlayer takes a player out of a lobby that hasn't started.
func (s *Store) RemoveTournamentPlayer(ctx context.Context, id, userID uuid.UUID) (bool, error) {
	tag, err := s.Pool.Exec(ctx, `DELETE FROM tournament_players p USING tournaments t
		WHERE p.tournament_id=$1 AND p.user_id=$2 AND t.id=p.tournament_id AND t.status='LOBBY'`, id, userID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

// TournamentPlayers lists the players in join order.
func (s *Store) TournamentPlayers(ctx context.Context, id uuid.UUID) ([]TournamentPlayer, error) {
	rows, err := s.Pool.Query(ctx, `SELECT u.id, u.username, u.trophies, p.joined_at
		FROM tournament_players p JOIN users u ON u.id = p.user_id
		WHERE p.tournament_id=$1 ORDER BY p.joined_at, u.username`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []TournamentPlayer
	for rows.Next() {
		var p TournamentPlayer
		if err := rows.Scan(&p.UserID, &p.Username, &p.Trophies, &p.JoinedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// TournamentsForUser lists the tournaments the user is in, newest first,
// leaving out cancelled ones.
func (s *Store) TournamentsForUser(ctx context.Context, userID uuid.UUID, limit int) ([]TournamentRow, error) {
	rows, err := s.Pool.Query(ctx, `SELECT `+tournamentColsT+` FROM tournaments t
		JOIN tournament_players p ON p.tournament_id = t.id AND p.user_id = $1
		WHERE t.status <> 'CANCELLED' ORDER BY t.created_at DESC LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []TournamentRow
	for rows.Next() {
		var t TournamentRow
		if err := rows.Scan(tournamentDest(&t)...); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// TransitionTournament moves a tournament between statuses only if it is still
// in the expected one, stamping start and end times. It reports whether this
// caller made the move.
func (s *Store) TransitionTournament(ctx context.Context, id uuid.UUID, from, to string, format *string) (bool, error) {
	tag, err := s.Pool.Exec(ctx, `UPDATE tournaments SET status=$3,
			format = COALESCE($4, format),
			started_at = CASE WHEN $2 = 'LOBBY' AND $3 <> 'CANCELLED' THEN now() ELSE started_at END,
			completed_at = CASE WHEN $3 = 'COMPLETE' THEN now() ELSE completed_at END
		WHERE id=$1 AND status=$2`, id, from, to, format)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

func (s *Store) SetTournamentAwards(ctx context.Context, id uuid.UUID, awards []byte) error {
	_, err := s.Pool.Exec(ctx, `UPDATE tournaments SET awards=$2 WHERE id=$1`, id, awards)
	return err
}

// MatchesForTournament returns every match in the tournament, oldest first.
func (s *Store) MatchesForTournament(ctx context.Context, id uuid.UUID) ([]MatchRow, error) {
	rows, err := s.Pool.Query(ctx, `SELECT `+matchCols+` FROM matches WHERE tournament_id=$1 ORDER BY created_at, id`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []MatchRow
	for rows.Next() {
		var m MatchRow
		if err := rows.Scan(matchDest(&m)...); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// TournamentLineup is one side's locked team in a tournament match.
type TournamentLineup struct {
	MatchID   uuid.UUID
	UserID    string
	Snapshot  []byte
	CaptainID *uuid.UUID
}

// TournamentLineups returns the lineup snapshots for every match in the tournament.
func (s *Store) TournamentLineups(ctx context.Context, id uuid.UUID) ([]TournamentLineup, error) {
	rows, err := s.Pool.Query(ctx, `SELECT l.match_id, l.user_id, l.cards_snapshot, l.captain_id
		FROM match_lineups l JOIN matches m ON m.id = l.match_id
		WHERE m.tournament_id=$1 AND l.cards_snapshot IS NOT NULL`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []TournamentLineup
	for rows.Next() {
		var l TournamentLineup
		if err := rows.Scan(&l.MatchID, &l.UserID, &l.Snapshot, &l.CaptainID); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

// IsNoRows reports whether err is "no rows".
func IsNoRows(err error) bool { return errors.Is(err, pgx.ErrNoRows) }
