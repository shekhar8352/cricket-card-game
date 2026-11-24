package store

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sudhanshushekhar/cricket-card-game/internal/engine"
	"github.com/sudhanshushekhar/cricket-card-game/internal/seedcatalog"
)

type Store struct {
	Pool *pgxpool.Pool
}

func Connect(ctx context.Context, url string) (*Store, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, err
	}
	cfg.MaxConns = 10
	p, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := p.Ping(ctx); err != nil {
		return nil, err
	}
	return &Store{Pool: p}, nil
}

func (s *Store) Close() { s.Pool.Close() }

func (s *Store) Migrate(ctx context.Context, path string) error {
	b, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	_, err = s.Pool.Exec(ctx, string(b))
	return err
}

func (s *Store) Seed(ctx context.Context) error {
	for _, t := range engine.TraitCatalog {
		_, err := s.Pool.Exec(ctx, `
			INSERT INTO traits (code, name, description) VALUES ($1,$2,$3)
			ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description
		`, t.Code, t.Name, t.Description)
		if err != nil {
			return err
		}
	}
	for _, c := range seedcatalog.All() {
		attrs, _ := json.Marshal(c.Attrs)
		_, err := s.Pool.Exec(ctx, `
			INSERT INTO players (id, name, country, role, bat_hand, bowl_type, base_rarity, attrs, traits)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
			ON CONFLICT (id) DO UPDATE SET
				name=EXCLUDED.name, country=EXCLUDED.country, role=EXCLUDED.role,
				bat_hand=EXCLUDED.bat_hand, bowl_type=EXCLUDED.bowl_type,
				base_rarity=EXCLUDED.base_rarity, attrs=EXCLUDED.attrs, traits=EXCLUDED.traits
		`, c.ID, c.Name, c.Country, c.Role, c.BatHand, c.BowlType, c.Rarity, attrs, c.Traits)
		if err != nil {
			return err
		}
	}
	return nil
}

type User struct {
	ID           uuid.UUID `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	Trophies     int       `json:"trophies"`
	Arena        string    `json:"arena"`
	CreatedAt    time.Time `json:"createdAt"`
}

func (s *Store) CreateUser(ctx context.Context, username, hash string) (User, error) {
	var u User
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO users (username, password_hash) VALUES ($1,$2)
		RETURNING id, username, password_hash, trophies, arena, created_at
	`, username, hash).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Trophies, &u.Arena, &u.CreatedAt)
	return u, err
}

func (s *Store) UserByName(ctx context.Context, username string) (User, error) {
	var u User
	err := s.Pool.QueryRow(ctx, `
		SELECT id, username, password_hash, trophies, arena, created_at FROM users WHERE username=$1
	`, username).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Trophies, &u.Arena, &u.CreatedAt)
	return u, err
}

func (s *Store) UserByID(ctx context.Context, id uuid.UUID) (User, error) {
	var u User
	err := s.Pool.QueryRow(ctx, `
		SELECT id, username, password_hash, trophies, arena, created_at FROM users WHERE id=$1
	`, id).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Trophies, &u.Arena, &u.CreatedAt)
	return u, err
}

func (s *Store) UpdateTrophies(ctx context.Context, id uuid.UUID, trophies int, arena string) error {
	_, err := s.Pool.Exec(ctx, `UPDATE users SET trophies=$2, arena=$3 WHERE id=$1`, id, trophies, arena)
	return err
}

type CardRow struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	PlayerID  string
	Rarity    engine.Rarity
	Level     int
	XP        int
	CreatedAt  time.Time
	CaptainRep int
	Player     engine.Card
}

func (c CardRow) ToEngine() engine.Card {
	e := c.Player
	e.ID = c.ID.String()
	e.PlayerID = c.PlayerID
	e.Rarity = c.Rarity
	e.Level = c.Level
	e.XP = c.XP
	e.CaptainRep = c.CaptainRep
	return e
}

func scanCard(row pgx.Row) (CardRow, error) {
	var c CardRow
	var attrs []byte
	var traits []string
	var rarity string
	err := row.Scan(&c.ID, &c.UserID, &c.PlayerID, &rarity, &c.Level, &c.XP, &c.CreatedAt, &c.CaptainRep,
		&c.Player.Name, &c.Player.Country, &c.Player.Role, &c.Player.BatHand, &c.Player.BowlType, &attrs, &traits)
	if err != nil {
		return c, err
	}
	c.Rarity = engine.Rarity(rarity)
	_ = json.Unmarshal(attrs, &c.Player.Attrs)
	c.Player.Traits = traits
	c.Player.PlayerID = c.PlayerID
	seedcatalog.Enrich(&c.Player)
	return c, nil
}

const cardSelect = `
	SELECT c.id, c.user_id, c.player_id, c.rarity, c.level, c.xp, c.created_at, c.captain_rep,
		p.name, p.country, p.role, p.bat_hand, p.bowl_type, p.attrs, p.traits
	FROM cards c JOIN players p ON p.id = c.player_id`

func (s *Store) CardsForUser(ctx context.Context, userID uuid.UUID) ([]CardRow, error) {
	rows, err := s.Pool.Query(ctx, cardSelect+` WHERE c.user_id=$1 ORDER BY c.created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []CardRow
	for rows.Next() {
		c, err := scanCard(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) CardByID(ctx context.Context, id uuid.UUID) (CardRow, error) {
	return scanCard(s.Pool.QueryRow(ctx, cardSelect+` WHERE c.id=$1`, id))
}

func (s *Store) InsertCard(ctx context.Context, userID uuid.UUID, playerID string, rarity engine.Rarity, level int) (CardRow, error) {
	var id uuid.UUID
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO cards (user_id, player_id, rarity, level) VALUES ($1,$2,$3,$4) RETURNING id
	`, userID, playerID, rarity, level).Scan(&id)
	if err != nil {
		return CardRow{}, err
	}
	return s.CardByID(ctx, id)
}

func (s *Store) UpdateCardXP(ctx context.Context, id uuid.UUID, xp, level int) error {
	_, err := s.Pool.Exec(ctx, `UPDATE cards SET xp=$2, level=$3 WHERE id=$1`, id, xp, level)
	return err
}

func (s *Store) DeleteCards(ctx context.Context, ids []uuid.UUID) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM cards WHERE id = ANY($1)`, ids)
	return err
}

// Players returns the active catalog: only players still listed in seedcatalog.
// Rows for retired players stay in the table so existing cards keep their
// foreign key, but they are never offered to bots, starter packs or rewards.
func (s *Store) Players(ctx context.Context) ([]engine.Card, error) {
	all := seedcatalog.All()
	ids := make([]string, len(all))
	for i, c := range all {
		ids[i] = c.ID
	}
	rows, err := s.Pool.Query(ctx, `SELECT id, name, country, role, bat_hand, bowl_type, base_rarity, attrs, traits FROM players WHERE id = ANY($1)`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []engine.Card
	for rows.Next() {
		var c engine.Card
		var attrs []byte
		var rarity string
		if err := rows.Scan(&c.ID, &c.Name, &c.Country, &c.Role, &c.BatHand, &c.BowlType, &rarity, &attrs, &c.Traits); err != nil {
			return nil, err
		}
		c.PlayerID = c.ID
		c.Rarity = engine.Rarity(rarity)
		c.Level = 1
		_ = json.Unmarshal(attrs, &c.Attrs)
		seedcatalog.Enrich(&c)
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) PlayersByRarity(ctx context.Context, r engine.Rarity) ([]engine.Card, error) {
	all, err := s.Players(ctx)
	if err != nil {
		return nil, err
	}
	var out []engine.Card
	for _, p := range all {
		if p.Rarity == r {
			out = append(out, p)
		}
	}
	return out, nil
}

type MatchRow struct {
	ID              uuid.UUID
	HomeUserID      uuid.UUID
	AwayUserID      *uuid.UUID
	IsBot           bool
	BotProfile      []byte
	Status          string
	Seed            int64
	Toss            []byte
	Result          []byte
	BallLog         []byte
	WinnerUserID    *uuid.UUID
	TrophyDeltaHome *int
	TrophyDeltaAway *int
	CreatedAt       time.Time
	CompletedAt     *time.Time
	BreakState      []byte     // engine.FirstInnings while paused at the innings break
	BreakStartedAt  *time.Time
	SuperState      []byte     // engine.MatchResult of the tied match, while picking a Super Over
	SuperStartedAt  *time.Time
	Mode            string // "ranked", "friendly" or "tournament"
	RoomCode        *string
	TournamentID    *uuid.UUID
	Stage           *string // tournament stage: "league", "qualifier1", "eliminator", "qualifier2", "final"
}

const matchCols = `id, home_user_id, away_user_id, is_bot, bot_profile, status, seed, toss, result, ball_log,
	winner_user_id, trophy_delta_home, trophy_delta_away, created_at, completed_at,
	break_state, break_started_at, super_state, super_started_at, mode, room_code, tournament_id, stage`

func matchDest(m *MatchRow) []any {
	return []any{&m.ID, &m.HomeUserID, &m.AwayUserID, &m.IsBot, &m.BotProfile, &m.Status, &m.Seed, &m.Toss, &m.Result, &m.BallLog,
		&m.WinnerUserID, &m.TrophyDeltaHome, &m.TrophyDeltaAway, &m.CreatedAt, &m.CompletedAt,
		&m.BreakState, &m.BreakStartedAt, &m.SuperState, &m.SuperStartedAt, &m.Mode, &m.RoomCode, &m.TournamentID, &m.Stage}
}

func (s *Store) InsertMatch(ctx context.Context, m MatchRow) (MatchRow, error) {
	if m.Mode == "" {
		m.Mode = "ranked"
	}
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO matches (home_user_id, away_user_id, is_bot, bot_profile, status, seed, mode, room_code, tournament_id, stage)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		RETURNING id, created_at
	`, m.HomeUserID, m.AwayUserID, m.IsBot, m.BotProfile, m.Status, m.Seed, m.Mode, m.RoomCode, m.TournamentID, m.Stage).Scan(&m.ID, &m.CreatedAt)
	return m, err
}

func (s *Store) MatchByID(ctx context.Context, id uuid.UUID) (MatchRow, error) {
	var m MatchRow
	err := s.Pool.QueryRow(ctx, `
		SELECT `+matchCols+`
		FROM matches WHERE id=$1
	`, id).Scan(matchDest(&m)...)
	return m, err
}

func (s *Store) MatchesForUser(ctx context.Context, userID uuid.UUID, limit int) ([]MatchRow, error) {
	if limit <= 0 {
		limit = 20
	}
	rows, err := s.Pool.Query(ctx, `
		SELECT `+matchCols+`
		FROM matches
		WHERE (home_user_id=$1 OR away_user_id=$1) AND status <> 'CANCELLED'
		ORDER BY created_at DESC LIMIT $2
	`, userID, limit)
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

func (s *Store) UpdateMatch(ctx context.Context, m MatchRow) error {
	_, err := s.Pool.Exec(ctx, `
		UPDATE matches SET status=$2, toss=$3, result=$4, ball_log=$5, winner_user_id=$6,
			trophy_delta_home=$7, trophy_delta_away=$8, completed_at=$9, away_user_id=$10, is_bot=$11, bot_profile=$12,
			break_state=$13, break_started_at=$14, super_state=$15, super_started_at=$16
		WHERE id=$1
	`, m.ID, m.Status, m.Toss, m.Result, m.BallLog, m.WinnerUserID, m.TrophyDeltaHome, m.TrophyDeltaAway, m.CompletedAt, m.AwayUserID, m.IsBot, m.BotProfile,
		m.BreakState, m.BreakStartedAt, m.SuperState, m.SuperStartedAt)
	return err
}

type LineupRow struct {
	MatchID      uuid.UUID
	UserID       string
	CardIDs      []uuid.UUID
	BattingOrder []uuid.UUID
	BowlingPlan  []uuid.UUID
	TossPref     string
	LockedAt     *time.Time
	Snapshot     []byte
	Tactics      []byte // engine.Tactics as JSON; nil means the captain decides
	CaptainID    *uuid.UUID
	BreakCall    *string
	BreakOrder   []uuid.UUID // new batting order (chasing) or bowling plan (defending)
	BreakLocked  *time.Time
	SuperPicks   []byte // engine.SuperOverPicks
	SuperLocked  *time.Time
}

func (s *Store) UpsertLineup(ctx context.Context, l LineupRow) error {
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO match_lineups (match_id, user_id, card_ids, batting_order, bowling_plan, toss_pref, locked_at, cards_snapshot, tactics, captain_id)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		ON CONFLICT (match_id, user_id) DO UPDATE SET
			card_ids=EXCLUDED.card_ids, batting_order=EXCLUDED.batting_order, bowling_plan=EXCLUDED.bowling_plan,
			toss_pref=EXCLUDED.toss_pref, locked_at=EXCLUDED.locked_at, cards_snapshot=EXCLUDED.cards_snapshot,
			tactics=EXCLUDED.tactics, captain_id=EXCLUDED.captain_id
	`, l.MatchID, l.UserID, l.CardIDs, l.BattingOrder, l.BowlingPlan, l.TossPref, l.LockedAt, l.Snapshot, l.Tactics, l.CaptainID)
	return err
}

func (s *Store) Lineups(ctx context.Context, matchID uuid.UUID) ([]LineupRow, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT match_id, user_id, card_ids, batting_order, bowling_plan, toss_pref, locked_at, cards_snapshot, tactics,
			captain_id, break_call, break_order, break_locked_at, super_picks, super_locked_at
		FROM match_lineups WHERE match_id=$1
	`, matchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []LineupRow
	for rows.Next() {
		var l LineupRow
		if err := rows.Scan(&l.MatchID, &l.UserID, &l.CardIDs, &l.BattingOrder, &l.BowlingPlan, &l.TossPref, &l.LockedAt, &l.Snapshot, &l.Tactics,
			&l.CaptainID, &l.BreakCall, &l.BreakOrder, &l.BreakLocked, &l.SuperPicks, &l.SuperLocked); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func (s *Store) InsertReward(ctx context.Context, userID, matchID uuid.UUID, cardIDs []uuid.UUID) error {
	_, err := s.Pool.Exec(ctx, `INSERT INTO reward_grants (user_id, match_id, card_ids) VALUES ($1,$2,$3)`, userID, matchID, cardIDs)
	return err
}

func (s *Store) RewardsForMatch(ctx context.Context, userID, matchID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := s.Pool.QueryRow(ctx, `SELECT card_ids FROM reward_grants WHERE user_id=$1 AND match_id=$2`, userID, matchID).Scan(&ids)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return ids, err
}

func (s *Store) InsertTraining(ctx context.Context, userID, target uuid.UUID, sac []uuid.UUID, xp, level int) error {
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO training_log (user_id, target_card_id, sacrifice_ids, xp_gained, new_level)
		VALUES ($1,$2,$3,$4,$5)
	`, userID, target, sac, xp, level)
	return err
}

// SquadRow is a user's saved default team and strategy.
type SquadRow struct {
	CardIDs      []uuid.UUID
	BattingOrder []uuid.UUID
	BowlingPlan  []uuid.UUID
	TossPref     string
	Tactics      []byte // unused since captains decide tactics
	CaptainID    *uuid.UUID
}

func (s *Store) SaveSquad(ctx context.Context, userID uuid.UUID, sq SquadRow) error {
	if sq.TossPref == "" {
		sq.TossPref = "chase"
	}
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO user_squads (user_id, card_ids, batting_order, bowling_plan, toss_pref, tactics, captain_id)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
		ON CONFLICT (user_id) DO UPDATE SET card_ids=EXCLUDED.card_ids, batting_order=EXCLUDED.batting_order,
			bowling_plan=EXCLUDED.bowling_plan, toss_pref=EXCLUDED.toss_pref, tactics=EXCLUDED.tactics,
			captain_id=EXCLUDED.captain_id, updated_at=now()
	`, userID, sq.CardIDs, sq.BattingOrder, sq.BowlingPlan, sq.TossPref, sq.Tactics, sq.CaptainID)
	return err
}

// Squad returns the saved default, or a zero SquadRow if none is saved.
func (s *Store) Squad(ctx context.Context, userID uuid.UUID) (SquadRow, error) {
	var sq SquadRow
	err := s.Pool.QueryRow(ctx, `SELECT card_ids, batting_order, bowling_plan, toss_pref, tactics, captain_id FROM user_squads WHERE user_id=$1`, userID).
		Scan(&sq.CardIDs, &sq.BattingOrder, &sq.BowlingPlan, &sq.TossPref, &sq.Tactics, &sq.CaptainID)
	if err == pgx.ErrNoRows {
		return SquadRow{}, nil
	}
	return sq, err
}

func (s *Store) Leaderboard(ctx context.Context, arena string, limit int) ([]User, error) {
	q := `SELECT id, username, password_hash, trophies, arena, created_at FROM users`
	args := []any{}
	if arena != "" {
		q += ` WHERE arena=$1`
		args = append(args, arena)
	}
	q += ` ORDER BY trophies DESC, created_at ASC LIMIT ` + fmt.Sprintf("%d", limit)
	rows, err := s.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Trophies, &u.Arena, &u.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (s *Store) AllUsers(ctx context.Context) ([]User, error) {
	return s.Leaderboard(ctx, "", 10000)
}

// CompletedMatch is the slim view of a finished match used for career stats
// (it skips the ball log, which is the bulk of each row).
type CompletedMatch struct {
	ID              uuid.UUID
	HomeUserID      uuid.UUID
	AwayUserID      *uuid.UUID
	IsBot           bool
	BotProfile      []byte
	Result          []byte
	TrophyDeltaHome *int
	TrophyDeltaAway *int
	CreatedAt       time.Time
	Snapshot        []byte // the viewing user's lineup cards
}

// CompletedMatchesWithLineup returns every finished match the user played,
// joined with that user's own lineup snapshot.
func (s *Store) CompletedMatchesWithLineup(ctx context.Context, userID uuid.UUID) ([]CompletedMatch, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT m.id, m.home_user_id, m.away_user_id, m.is_bot, m.bot_profile, m.result,
			m.trophy_delta_home, m.trophy_delta_away, m.created_at, l.cards_snapshot
		FROM matches m
		JOIN match_lineups l ON l.match_id = m.id AND l.user_id = $2
		WHERE (m.home_user_id = $1 OR m.away_user_id = $1)
			AND m.status = 'COMPLETE' AND m.result IS NOT NULL AND m.mode = 'ranked'
		ORDER BY m.created_at
	`, userID, userID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []CompletedMatch
	for rows.Next() {
		var m CompletedMatch
		if err := rows.Scan(&m.ID, &m.HomeUserID, &m.AwayUserID, &m.IsBot, &m.BotProfile, &m.Result,
			&m.TrophyDeltaHome, &m.TrophyDeltaAway, &m.CreatedAt, &m.Snapshot); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// Rank is the user's 1-based position on the global trophy leaderboard.
func (s *Store) Rank(ctx context.Context, trophies int) (int, error) {
	var n int
	err := s.Pool.QueryRow(ctx, `SELECT count(*) + 1 FROM users WHERE trophies > $1`, trophies).Scan(&n)
	return n, err
}

// CountUsers returns how many accounts exist, for "rank X of Y".
func (s *Store) CountUsers(ctx context.Context) (int, error) {
	var n int
	err := s.Pool.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&n)
	return n, err
}
