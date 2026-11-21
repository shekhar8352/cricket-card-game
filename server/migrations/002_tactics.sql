-- Match plan (batting approach per phase, field setting per over) for each lineup.
ALTER TABLE match_lineups ADD COLUMN IF NOT EXISTS tactics JSONB;
