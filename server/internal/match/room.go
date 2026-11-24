package match

import (
	"context"
	"crypto/rand"
	"errors"
	"math/big"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/sudhanshushekhar/cricket-card-game/internal/store"
)

// Friendly rooms: the host creates a room and shares its code; the first other
// player to enter the code joins, and the match runs like any player-vs-player
// match. Friendlies are recorded but award no trophies, cards, XP or captain
// reputation, and don't count towards win streaks or career stats.
const (
	ModeRanked   = "ranked"
	ModeFriendly = "friendly"

	StatusWaitingRoom = "WAITING_ROOM" // friendly room created, waiting for a guest to join
	StatusCancelled   = "CANCELLED"    // the host closed the room, or it expired unjoined

	RoomCodeLen = 6
	// RoomTTL is how long a room stays open for someone to join.
	RoomTTL = 30 * time.Minute
)

// No 0/O, 1/I/L: codes get read out loud and typed on phones.
const roomAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

var (
	ErrRoomNotFound = errors.New("no open room with that code")
	ErrOwnRoom      = errors.New("That's your own room. Share the code with a friend.")
	ErrRoomTaken    = errors.New("Someone else already joined that room.")
)

// NewRoomCode makes a 6-character join code (also used for tournaments).
func NewRoomCode() (string, error) {
	var b strings.Builder
	for i := 0; i < RoomCodeLen; i++ {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(roomAlphabet))))
		if err != nil {
			return "", err
		}
		b.WriteByte(roomAlphabet[n.Int64()])
	}
	return b.String(), nil
}

// NormalizeRoomCode upper-cases a typed code and drops spaces and dashes.
func NormalizeRoomCode(code string) string {
	code = strings.ToUpper(code)
	return strings.Map(func(r rune) rune {
		if r == ' ' || r == '-' {
			return -1
		}
		return r
	}, code)
}

// RoomExpired reports whether an unjoined room is past its time to live.
func RoomExpired(m store.MatchRow, now time.Time) bool {
	return m.Status == StatusWaitingRoom && now.Sub(m.CreatedAt) > RoomTTL
}

// CreateRoom opens a friendly room for the user, or returns the one they
// already have open so a double tap doesn't leave stray rooms behind.
func (s *Service) CreateRoom(ctx context.Context, user store.User) (store.MatchRow, error) {
	if m, err := s.Store.OpenRoomForHost(ctx, user.ID); err == nil {
		if !RoomExpired(m, time.Now()) {
			return m, nil
		}
		_, _ = s.Store.TransitionStatus(ctx, m.ID, StatusWaitingRoom, StatusCancelled)
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return store.MatchRow{}, err
	}
	var lastErr error
	for range 5 { // retry on the (unlikely) code collision with another open room
		code, err := NewRoomCode()
		if err != nil {
			return store.MatchRow{}, err
		}
		m, err := s.Store.InsertMatch(ctx, store.MatchRow{
			HomeUserID: user.ID,
			Status:     StatusWaitingRoom,
			Seed:       time.Now().UnixNano(),
			Mode:       ModeFriendly,
			RoomCode:   &code,
		})
		if err == nil {
			return m, nil
		}
		lastErr = err
	}
	return store.MatchRow{}, lastErr
}

// JoinRoom seats the user as the away side of the room with this code.
func (s *Service) JoinRoom(ctx context.Context, user store.User, code string) (store.MatchRow, error) {
	code = NormalizeRoomCode(code)
	if len(code) != RoomCodeLen {
		return store.MatchRow{}, ErrRoomNotFound
	}
	m, err := s.Store.OpenRoomByCode(ctx, code)
	if errors.Is(err, pgx.ErrNoRows) {
		// Opening an invite link again takes the guest back to their match.
		if prev, perr := s.Store.JoinedRoom(ctx, code, user.ID); perr == nil {
			return prev, nil
		}
		return m, ErrRoomNotFound
	}
	if err != nil {
		return m, err
	}
	if RoomExpired(m, time.Now()) {
		_, _ = s.Store.TransitionStatus(ctx, m.ID, StatusWaitingRoom, StatusCancelled)
		return m, ErrRoomNotFound
	}
	if m.HomeUserID == user.ID {
		return m, ErrOwnRoom
	}
	ok, err := s.Store.ClaimRoom(ctx, m.ID, user.ID, StatusLineup)
	if err != nil {
		return m, err
	}
	if !ok {
		if prev, perr := s.Store.JoinedRoom(ctx, code, user.ID); perr == nil {
			return prev, nil // a double tap: the first request seated them
		}
		return m, ErrRoomTaken
	}
	m, err = s.Store.MatchByID(ctx, m.ID)
	if err == nil {
		s.publish(ctx, m, "joined")
	}
	return m, err
}

// CancelRoom closes the host's room while nobody has joined yet.
func (s *Service) CancelRoom(ctx context.Context, user store.User, matchID uuid.UUID) error {
	m, err := s.Store.MatchByID(ctx, matchID)
	if err != nil {
		return ErrRoomNotFound
	}
	if m.HomeUserID != user.ID {
		return errors.New("Only the host can close the room.")
	}
	ok, err := s.Store.TransitionStatus(ctx, matchID, StatusWaitingRoom, StatusCancelled)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("A friend has already joined this room.")
	}
	return nil
}

// ExpireRoom cancels the room if it sat unjoined past RoomTTL. It reports
// whether it did.
func (s *Service) ExpireRoom(ctx context.Context, m store.MatchRow) bool {
	if !RoomExpired(m, time.Now()) {
		return false
	}
	ok, _ := s.Store.TransitionStatus(ctx, m.ID, StatusWaitingRoom, StatusCancelled)
	return ok
}
