package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/sudhanshushekhar/cricket-card-game/internal/httpapi"
	"github.com/sudhanshushekhar/cricket-card-game/internal/matchmaking"
	"github.com/sudhanshushekhar/cricket-card-game/internal/seedcatalog"
	"github.com/sudhanshushekhar/cricket-card-game/internal/store"
)

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	dbURL := env("DATABASE_URL", "postgres://cricket:cricket@localhost:5432/cricket?sslmode=disable")
	redisURL := env("REDIS_URL", "redis://localhost:6379")
	addr := env("HTTP_ADDR", ":8080")
	secret := env("JWT_SECRET", "dev-cricket-secret-change-me")

	st, err := waitStore(ctx, dbURL)
	if err != nil {
		log.Fatal(err)
	}
	defer st.Close()

	mig := filepath.Join(findRoot(), "migrations", "001_init.sql")
	if err := st.Migrate(ctx, mig); err != nil {
		log.Printf("migrate: %v", err)
	}
	if err := st.Seed(ctx); err != nil {
		log.Fatal("seed:", err)
	}
	writePlayersJSON()

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatal(err)
	}
	rdb := redis.NewClient(opt)
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Printf("redis not ready: %v (leaderboard/pvp degraded)", err)
	}
	q := matchmaking.New(rdb)
	if users, err := st.AllUsers(ctx); err == nil {
		scores := map[string]int{}
		for _, u := range users {
			scores[u.ID.String()] = u.Trophies
		}
		_ = q.RebuildLB(ctx, scores)
	}

	api := httpapi.New(st, q, rdb, secret)
	srv := &http.Server{Addr: addr, Handler: api.Router()}
	go func() {
		log.Printf("api listening on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()
	<-ctx.Done()
	shctx, c2 := context.WithTimeout(context.Background(), 5*time.Second)
	defer c2()
	_ = srv.Shutdown(shctx)
}

func waitStore(ctx context.Context, url string) (*store.Store, error) {
	var last error
	for i := 0; i < 30; i++ {
		st, err := store.Connect(ctx, url)
		if err == nil {
			return st, nil
		}
		last = err
		time.Sleep(time.Second)
	}
	return nil, last
}

func writePlayersJSON() {
	root := findRoot()
	path := filepath.Join(root, "seed", "players.json")
	_ = os.MkdirAll(filepath.Dir(path), 0755)
	all := seedcatalog.All()
	b, _ := json.MarshalIndent(all, "", "  ")
	_ = os.WriteFile(path, b, 0644)
}

func findRoot() string {
	if _, err := os.Stat("migrations/001_init.sql"); err == nil {
		return "."
	}
	if _, err := os.Stat("server/migrations/001_init.sql"); err == nil {
		return "server"
	}
	wd, _ := os.Getwd()
	return wd
}

func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
