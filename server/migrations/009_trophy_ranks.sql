-- Personal best trophies. users.arena now holds the arena a player has earned:
-- it can sit above their trophy count by up to trophy.Buffer (100) after a loss.
ALTER TABLE users ADD COLUMN IF NOT EXISTS best_trophies INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS best_at TIMESTAMPTZ;
UPDATE users SET best_trophies = trophies, best_at = now() WHERE best_trophies < trophies;
