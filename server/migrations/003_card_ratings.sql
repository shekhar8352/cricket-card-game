-- Match rating (3.0-10.0) and performance XP earned by each card per match.
CREATE TABLE IF NOT EXISTS card_ratings (
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating NUMERIC(3,1) NOT NULL,
    xp INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (card_id, match_id)
);
CREATE INDEX IF NOT EXISTS card_ratings_card_idx ON card_ratings (card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS card_ratings_user_idx ON card_ratings (user_id);
