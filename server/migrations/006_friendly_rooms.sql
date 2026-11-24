-- Friendly rooms: a host creates a room with a join code, a friend joins with it.
-- Friendlies are recorded like any match but award no trophies, cards, XP or reputation.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'ranked';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS room_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS matches_open_room_idx ON matches(room_code) WHERE status = 'WAITING_ROOM';
