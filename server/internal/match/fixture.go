package match

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/sudhanshushekhar/cricket-card-game/internal/engine"
	"github.com/sudhanshushekhar/cricket-card-game/internal/store"
)

// ModeTournament matches are fixtures in a tournament: played like a friendly
// (no trophies, cards, XP or reputation), and the result feeds the tournament.
const ModeTournament = "tournament"

// CreateFixture schedules a tournament match between two players, ready for lineups.
func (s *Service) CreateFixture(ctx context.Context, tournamentID uuid.UUID, stage string, home, away uuid.UUID, seed int64) (store.MatchRow, error) {
	if seed == 0 {
		seed = time.Now().UnixNano()
	}
	return s.Store.InsertMatch(ctx, store.MatchRow{
		HomeUserID:   home,
		AwayUserID:   &away,
		Status:       StatusLineup,
		Seed:         seed,
		Mode:         ModeTournament,
		TournamentID: &tournamentID,
		Stage:        &stage,
	})
}

// AutoPlay plays a player-vs-player match through for whoever hasn't acted:
// idle sides lock their default team, and their captain makes the calls at the
// innings break and any Super Over. Sides that already acted keep their choices.
func (s *Service) AutoPlay(ctx context.Context, matchID uuid.UUID) error {
	for range 6 { // lineup -> break -> super over -> complete, with room to spare
		m, err := s.Store.MatchByID(ctx, matchID)
		if err != nil {
			return err
		}
		if m.Status == StatusComplete || m.AwayUserID == nil {
			return nil
		}
		lus, err := s.Store.Lineups(ctx, m.ID)
		if err != nil {
			return err
		}
		row := map[string]*store.LineupRow{}
		for i := range lus {
			row[lus[i].UserID] = &lus[i]
		}
		acted := false
	sides:
		for _, uid := range []uuid.UUID{m.HomeUserID, *m.AwayUserID} {
			l := row[uid.String()]
			u, err := s.Store.UserByID(ctx, uid)
			if err != nil {
				return err
			}
			switch m.Status {
			case StatusLineup:
				if l != nil && l.LockedAt != nil {
					continue
				}
				req, err := s.DefaultLineup(ctx, u)
				if err != nil {
					return fmt.Errorf("%s can't field a team: %w", u.Username, err)
				}
				if err := s.LockLineup(ctx, u, m.ID, req); err != nil {
					return err
				}
			case StatusBreak:
				if l != nil && l.BreakLocked != nil {
					continue
				}
				if err := s.SubmitBreak(ctx, u, m.ID, BreakReq{Call: string(engine.CallCaptain)}); err != nil {
					return err
				}
			case StatusSuperOver:
				if l != nil && l.SuperLocked != nil {
					continue
				}
				if err := s.SubmitSuperOver(ctx, u, m.ID, engine.SuperOverPicks{}); err != nil {
					return err
				}
			default:
				return nil // simulating right now: nothing to do
			}
			acted = true
			break sides // the status may have moved on; reload before the next side
		}
		if !acted {
			return nil
		}
	}
	return nil
}
