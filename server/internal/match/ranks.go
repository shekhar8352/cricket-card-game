package match

import (
	"context"
	"time"

	"github.com/sudhanshushekhar/cricket-card-game/internal/store"
	"github.com/sudhanshushekhar/cricket-card-game/internal/trophy"
)

// HistoryPeak replays a player's ranked trophy changes from zero (with the
// floor at 0) and returns the highest count reached and when.
func HistoryPeak(hist []store.TrophyPoint) (peak int, at *time.Time) {
	t := 0
	for i := range hist {
		t = trophy.Apply(t, hist[i].Delta)
		if t > peak {
			peak, at = t, &hist[i].At
		}
	}
	return peak, at
}

// NormalizeRanks brings every player in line with the current arena rules: it
// re-resolves their held arena (new arenas, renamed ones) and raises their
// personal best to the highest count their ranked history reached. Two
// queries plus one update per changed player; safe to run on every start.
func (s *Service) NormalizeRanks(ctx context.Context) (changed int, err error) {
	users, err := s.Store.EveryUser(ctx)
	if err != nil {
		return 0, err
	}
	history, err := s.Store.AllTrophyHistory(ctx)
	if err != nil {
		return 0, err
	}
	for _, u := range users {
		best, bestAt := u.BestTrophies, u.BestAt
		if peak, at := HistoryPeak(history[u.ID]); peak > best {
			best, bestAt = peak, at
		}
		if u.Trophies > best {
			best, bestAt = u.Trophies, nil
		}
		arena := trophy.Resolve(u.Arena, u.Trophies).Name
		if arena == u.Arena && best == u.BestTrophies && (u.BestAt != nil || best == 0) {
			continue
		}
		if err := s.Store.SetArenaAndBest(ctx, u.ID, arena, best, bestAt); err != nil {
			return changed, err
		}
		changed++
	}
	return changed, nil
}
