-- Captains, innings-break decisions, Super Over, captain reputation, rivalries.
ALTER TABLE match_lineups ADD COLUMN IF NOT EXISTS captain_id UUID;
ALTER TABLE match_lineups ADD COLUMN IF NOT EXISTS break_call TEXT;
ALTER TABLE match_lineups ADD COLUMN IF NOT EXISTS break_order UUID[];
ALTER TABLE match_lineups ADD COLUMN IF NOT EXISTS break_locked_at TIMESTAMPTZ;
ALTER TABLE match_lineups ADD COLUMN IF NOT EXISTS super_picks JSONB;
ALTER TABLE match_lineups ADD COLUMN IF NOT EXISTS super_locked_at TIMESTAMPTZ;

ALTER TABLE matches ADD COLUMN IF NOT EXISTS break_state JSONB;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS break_started_at TIMESTAMPTZ;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS super_state JSONB;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS super_started_at TIMESTAMPTZ;

ALTER TABLE user_squads ADD COLUMN IF NOT EXISTS captain_id UUID;

ALTER TABLE cards ADD COLUMN IF NOT EXISTS captain_rep INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS rivalries (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bowler_player_id TEXT NOT NULL,
    batter_player_id TEXT NOT NULL,
    balls INT NOT NULL DEFAULT 0,
    runs INT NOT NULL DEFAULT 0,
    dismissals INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, bowler_player_id, batter_player_id)
);
