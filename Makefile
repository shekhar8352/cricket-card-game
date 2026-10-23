.PHONY: up down migrate seed server web test

up:
	docker compose up -d

down:
	docker compose down

server:
	cd server && go run ./cmd/api

web:
	cd web && npm run dev

test:
	cd server && go test ./...
	cd web && npm test

seed:
	cd server && go run ./cmd/api --seed-only
