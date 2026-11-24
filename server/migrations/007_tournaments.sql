-- Tournaments: a host opens a lobby with a join code, players join, then every
-- pair plays once (round robin) before a final (up to 5 players) or IPL-style
-- playoffs (6 or more). Tournament matches are friendlies: no trophies or cards.
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    host_user_id UUID NOT NULL REFERENCES users(id),
    status TEXT NOT NULL,          -- LOBBY, LEAGUE, PLAYOFFS, COMPLETE, CANCELLED
    format TEXT,                   -- "final" or "playoffs", fixed when it starts
    awards JSONB,                  -- computed once the final is played
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS tournaments_open_code_idx ON tournaments(code) WHERE status = 'LOBBY';

CREATE TABLE IF NOT EXISTS tournament_players (
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tournament_id, user_id)
);
CREATE INDEX IF NOT EXISTS tournament_players_user_idx ON tournament_players(user_id);

ALTER TABLE matches ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS stage TEXT;  -- "league", "qualifier1", "eliminator", "qualifier2", "final"
CREATE INDEX IF NOT EXISTS matches_tournament_idx ON matches(tournament_id);
-- Each knockout match exists once, even if two results land at the same moment.
CREATE UNIQUE INDEX IF NOT EXISTS matches_tournament_ko_idx ON matches(tournament_id, stage)
    WHERE tournament_id IS NOT NULL AND stage <> 'league';
