.PHONY: up down migrate seed server web test tunnel tunnel-stop

# .env.local (gitignored) points the API at the server's Postgres/Redis via the tunnel.
-include .env.local
export DATABASE_URL REDIS_URL

DEPLOY_HOST ?= root@45.74.156.59

up:
	docker compose up -d

down:
	docker compose down

# Forward server Postgres -> localhost:15432 and Redis -> localhost:16379 (runs in background).
tunnel:
	@nc -z 127.0.0.1 15432 2>/dev/null && echo "tunnel already up" || \
	  ssh -f -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 \
	    -L 15432:127.0.0.1:5432 -L 16379:127.0.0.1:6379 $(DEPLOY_HOST) && echo "tunnel up"

tunnel-stop:
	-pkill -f "15432:127.0.0.1:5432"

server:
	cd server && go run ./cmd/api

web:
	cd web && npm run dev

test:
	cd server && go test ./...
	cd web && npm test

seed:
	cd server && go run ./cmd/api --seed-only
