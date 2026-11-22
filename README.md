# Cricket Card Game

Collect real-player cards, build a 7-card squad, and play 5-over matches against bots (and later, other players).

## Stack

- **Frontend:** React + Vite + TypeScript + Tailwind
- **Game engine + API:** Go
- **Postgres 16** for persistence
- **Redis 7** for matchmaking, live events, and the leaderboard

## Quick start

```bash
docker compose up -d
cd server && go run ./cmd/api
# in another terminal
cd web && npm install && npm run dev
```

API listens on `http://localhost:8000`. The web app is on `http://localhost:5173` and calls the API there directly. To point it somewhere else, set `VITE_API_URL` (see `web/.env.example`).

Register an account to receive a 10-card starter pack, then Play vs Bot. PvP matchmaking is live: if no opponent is found in 20 seconds the server falls back to a bot.

## Squad rules

3 batsmen, 1 wicketkeeper-batsman, 1 all-rounder, 2 bowlers. Each bowler bowls 2 overs, the all-rounder bowls 1, and no bowler may bowl consecutive overs.

Before a match you pick the seven, a **captain**, and the batting and bowling orders. The captain makes every tactical call (batting approach and field each over, the toss, their once-per-match masterstroke). The match pauses at the **innings break** for a plan card and an optional order change, and a tie goes to a **Super Over**. Overs 1-2 are a powerplay with fielding restrictions. The full rules, with live numbers from the engine, are on the in-game "How it works" page (`/how-it-works`).
