package tournament

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/rand"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/sudhanshushekhar/cricket-card-game/internal/match"
	"github.com/sudhanshushekhar/cricket-card-game/internal/store"
)

var (
	ErrNotFound   = errors.New("no open tournament with that code")
	ErrNotHost    = errors.New("only the host can do that")
	ErrNotPlayer  = errors.New("you're not in this tournament")
	ErrNotInLobby = errors.New("the tournament has already started")
)

const MaxNameLen = 40

type Service struct {
	Store *store.Store
	Match *match.Service
}

// Create opens a tournament lobby with the user as host and first player.
func (s *Service) Create(ctx context.Context, user store.User, name string) (store.TournamentRow, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		name = user.Username + "'s Cup"
	}
	if utf8.RuneCountInString(name) > MaxNameLen {
		name = string([]rune(name)[:MaxNameLen])
	}
	var lastErr error
	for range 5 {
		code, err := match.NewRoomCode()
		if err != nil {
			return store.TournamentRow{}, err
		}
		if _, err := s.Store.OpenRoomByCode(ctx, code); err == nil {
			continue // keep codes unique across rooms and tournaments
		}
		t, err := s.Store.InsertTournament(ctx, store.TournamentRow{Code: code, Name: name, HostUserID: user.ID, Status: StatusLobby})
		if err == nil {
			return t, nil
		}
		lastErr = err
	}
	return store.TournamentRow{}, lastErr
}

// Join adds the user to the lobby with this code. Entering the code of a
// tournament they're already in just takes them back to it.
func (s *Service) Join(ctx context.Context, user store.User, code string) (store.TournamentRow, error) {
	code = match.NormalizeRoomCode(code)
	t, err := s.Store.OpenTournamentByCode(ctx, code)
	if store.IsNoRows(err) {
		if mine, err := s.Store.TournamentByCodeForPlayer(ctx, code, user.ID); err == nil {
			return mine, nil
		}
		return t, ErrNotFound
	}
	if err != nil {
		return t, err
	}
	if err := s.Store.AddTournamentPlayer(ctx, t.ID, user.ID, MaxPlayers); err != nil {
		if errors.Is(err, store.ErrTournamentFull) {
			return t, fmt.Errorf("this tournament is full (%d players)", MaxPlayers)
		}
		return t, err
	}
	return t, nil
}

// Leave takes a player out of the lobby. The host leaving cancels it.
func (s *Service) Leave(ctx context.Context, user store.User, id uuid.UUID) error {
	t, err := s.Store.TournamentByID(ctx, id)
	if err != nil {
		return ErrNotFound
	}
	if t.Status != StatusLobby {
		return ErrNotInLobby
	}
	if t.HostUserID == user.ID {
		_, err := s.Store.TransitionTournament(ctx, id, StatusLobby, StatusCancelled, nil)
		return err
	}
	ok, err := s.Store.RemoveTournamentPlayer(ctx, id, user.ID)
	if err == nil && !ok {
		return ErrNotPlayer
	}
	return err
}

// Start closes the lobby, fixes the format and schedules every league match.
func (s *Service) Start(ctx context.Context, user store.User, id uuid.UUID) error {
	t, err := s.Store.TournamentByID(ctx, id)
	if err != nil {
		return ErrNotFound
	}
	if t.HostUserID != user.ID {
		return ErrNotHost
	}
	players, err := s.Store.TournamentPlayers(ctx, id)
	if err != nil {
		return err
	}
	if len(players) < MinPlayers {
		return fmt.Errorf("you need at least %d players to start (you have %d)", MinPlayers, len(players))
	}
	format := FormatFor(len(players))
	won, err := s.Store.TransitionTournament(ctx, id, StatusLobby, StatusLeague, &format)
	if err != nil {
		return err
	}
	if !won {
		return ErrNotInLobby
	}
	ids := make([]uuid.UUID, len(players))
	for i, p := range players {
		ids[i] = p.UserID
	}
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	rng.Shuffle(len(ids), func(i, j int) { ids[i], ids[j] = ids[j], ids[i] })
	base := time.Now().UnixNano()
	for i, f := range RoundRobin(ids) {
		if _, err := s.Match.CreateFixture(ctx, id, StageLeague, f.Home, f.Away, base+int64(i)*7919); err != nil {
			return err
		}
	}
	return nil
}

func isDuplicate(err error) bool {
	var pg *pgconn.PgError
	return errors.As(err, &pg) && pg.Code == "23505"
}

// Advance moves the tournament on as results come in: schedules knockout
// matches once their teams are known, and settles the honours after the
// final. It is safe to call at any time and from several places at once.
func (s *Service) Advance(ctx context.Context, id uuid.UUID) error {
	t, err := s.Store.TournamentByID(ctx, id)
	if err != nil {
		return err
	}
	if t.Status != StatusLeague && t.Status != StatusPlayoffs && !(t.Status == StatusComplete && len(t.Awards) == 0) {
		return nil
	}
	format := FormatFinal
	if t.Format != nil {
		format = *t.Format
	}
	players, err := s.Store.TournamentPlayers(ctx, id)
	if err != nil {
		return err
	}
	matches, err := s.Store.MatchesForTournament(ctx, id)
	if err != nil {
		return err
	}
	if !LeagueDone(matches) {
		return nil
	}
	if t.Status == StatusLeague {
		if _, err := s.Store.TransitionTournament(ctx, id, StatusLeague, StatusPlayoffs, nil); err != nil {
			return err
		}
	}
	table := Standings(players, matches)
	for _, f := range NextFixtures(format, table, matches) {
		if _, err := s.Match.CreateFixture(ctx, id, f.Stage, f.Home, f.Away, 0); err != nil && !isDuplicate(err) {
			return err
		}
	}
	if !FinalDone(matches) {
		return nil
	}
	if t.Status != StatusComplete {
		won, err := s.Store.TransitionTournament(ctx, id, StatusPlayoffs, StatusComplete, nil)
		if err != nil || !won {
			return err
		}
	}
	lineups, err := s.Store.TournamentLineups(ctx, id)
	if err != nil {
		return err
	}
	h := ComputeHonours(format, players, matches, lineups)
	b, _ := json.Marshal(h)
	return s.Store.SetTournamentAwards(ctx, id, b)
}

// OnMatchComplete is the match service's hook: a finished tournament match may
// move the tournament on.
func (s *Service) OnMatchComplete(ctx context.Context, m store.MatchRow) {
	if m.TournamentID == nil {
		return
	}
	if err := s.Advance(ctx, *m.TournamentID); err != nil {
		log.Printf("tournament %s: advance: %v", *m.TournamentID, err)
	}
}

// AutoPlay lets the host finish every open match in the current stage: anyone
// who hasn't acted plays their default team and their captain makes the calls.
// It returns how many matches it moved on.
func (s *Service) AutoPlay(ctx context.Context, user store.User, id uuid.UUID) (int, error) {
	t, err := s.Store.TournamentByID(ctx, id)
	if err != nil {
		return 0, ErrNotFound
	}
	if t.HostUserID != user.ID {
		return 0, ErrNotHost
	}
	if t.Status != StatusLeague && t.Status != StatusPlayoffs {
		return 0, fmt.Errorf("there are no matches to play right now")
	}
	matches, err := s.Store.MatchesForTournament(ctx, id)
	if err != nil {
		return 0, err
	}
	n := 0
	for _, m := range matches {
		if m.Status == match.StatusComplete {
			continue
		}
		if err := s.Match.AutoPlay(ctx, m.ID); err != nil {
			return n, err
		}
		n++
	}
	return n, s.Advance(ctx, id)
}
