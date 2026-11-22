-- A user's default match plan, used to pre-fill lineups and when a PvP lineup times out.
ALTER TABLE user_squads ADD COLUMN IF NOT EXISTS toss_pref TEXT NOT NULL DEFAULT 'chase';
ALTER TABLE user_squads ADD COLUMN IF NOT EXISTS tactics JSONB;
