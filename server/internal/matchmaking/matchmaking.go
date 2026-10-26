package matchmaking

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type Queue struct {
	R *redis.Client
}

func New(r *redis.Client) *Queue { return &Queue{R: r} }

func key(band string) string { return "mm:queue:" + band }

func (q *Queue) Enqueue(ctx context.Context, band string, userID uuid.UUID) error {
	return q.R.ZAdd(ctx, key(band), redis.Z{Score: float64(time.Now().Unix()), Member: userID.String()}).Err()
}

func (q *Queue) Dequeue(ctx context.Context, band string, userID uuid.UUID) error {
	return q.R.ZRem(ctx, key(band), userID.String()).Err()
}

// PopOldestOther returns another user waiting in the same band, if any.
func (q *Queue) PopOldestOther(ctx context.Context, band string, self uuid.UUID) (uuid.UUID, bool, error) {
	vals, err := q.R.ZRange(ctx, key(band), 0, 20).Result()
	if err != nil {
		return uuid.Nil, false, err
	}
	for _, v := range vals {
		if v == self.String() {
			continue
		}
		n, err := q.R.ZRem(ctx, key(band), v).Result()
		if err != nil {
			return uuid.Nil, false, err
		}
		if n == 0 {
			continue
		}
		id, err := uuid.Parse(v)
		if err != nil {
			continue
		}
		_ = q.R.ZRem(ctx, key(band), self.String())
		return id, true, nil
	}
	return uuid.Nil, false, nil
}

func (q *Queue) WaitedSeconds(ctx context.Context, band string, userID uuid.UUID) (int, error) {
	sc, err := q.R.ZScore(ctx, key(band), userID.String()).Result()
	if err == redis.Nil {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return int(time.Now().Unix() - int64(sc)), nil
}

func EventChannel(matchID uuid.UUID) string { return fmt.Sprintf("match:%s:events", matchID) }

func (q *Queue) Publish(ctx context.Context, matchID uuid.UUID, payload string) error {
	return q.R.Publish(ctx, EventChannel(matchID), payload).Err()
}

func LBKey() string { return "lb:trophies" }

func (q *Queue) SetScore(ctx context.Context, userID uuid.UUID, trophies int) error {
	return q.R.ZAdd(ctx, LBKey(), redis.Z{Score: float64(trophies), Member: userID.String()}).Err()
}

func (q *Queue) RebuildLB(ctx context.Context, scores map[string]int) error {
	pipe := q.R.Pipeline()
	pipe.Del(ctx, LBKey())
	for id, t := range scores {
		pipe.ZAdd(ctx, LBKey(), redis.Z{Score: float64(t), Member: id})
	}
	_, err := pipe.Exec(ctx)
	return err
}
