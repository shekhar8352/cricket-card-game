-- Game plans: a batting and a bowling plan picked before the match for the
-- first innings (whichever the side ends up doing), saved with the default squad too.
ALTER TABLE match_lineups ADD COLUMN IF NOT EXISTS bat_plan TEXT NOT NULL DEFAULT '';
ALTER TABLE match_lineups ADD COLUMN IF NOT EXISTS bowl_plan TEXT NOT NULL DEFAULT '';
ALTER TABLE user_squads ADD COLUMN IF NOT EXISTS bat_plan TEXT NOT NULL DEFAULT '';
ALTER TABLE user_squads ADD COLUMN IF NOT EXISTS bowl_plan TEXT NOT NULL DEFAULT '';
