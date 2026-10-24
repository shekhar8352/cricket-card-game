CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    trophies INT NOT NULL DEFAULT 0,
    arena TEXT NOT NULL DEFAULT 'Bronze',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    role TEXT NOT NULL,
    bat_hand TEXT NOT NULL,
    bowl_type TEXT NOT NULL,
    base_rarity TEXT NOT NULL,
    attrs JSONB NOT NULL,
    traits TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS traits (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL REFERENCES players(id),
    rarity TEXT NOT NULL,
    level INT NOT NULL DEFAULT 1,
    xp INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cards_user_idx ON cards(user_id);

CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    home_user_id UUID NOT NULL REFERENCES users(id),
    away_user_id UUID REFERENCES users(id),
    is_bot BOOLEAN NOT NULL DEFAULT true,
    bot_profile JSONB,
    status TEXT NOT NULL,
    seed BIGINT NOT NULL,
    toss JSONB,
    result JSONB,
    ball_log JSONB,
    winner_user_id UUID,
    trophy_delta_home INT,
    trophy_delta_away INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS matches_home_idx ON matches(home_user_id);
CREATE INDEX IF NOT EXISTS matches_status_idx ON matches(status);

CREATE TABLE IF NOT EXISTS match_lineups (
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    card_ids UUID[] NOT NULL DEFAULT '{}',
    batting_order UUID[] NOT NULL DEFAULT '{}',
    bowling_plan UUID[] NOT NULL DEFAULT '{}',
    toss_pref TEXT NOT NULL DEFAULT 'chase',
    locked_at TIMESTAMPTZ,
    cards_snapshot JSONB,
    PRIMARY KEY (match_id, user_id)
);

CREATE TABLE IF NOT EXISTS reward_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    match_id UUID REFERENCES matches(id),
    card_ids UUID[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    target_card_id UUID NOT NULL,
    sacrifice_ids UUID[] NOT NULL,
    xp_gained INT NOT NULL,
    new_level INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_squads (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    card_ids UUID[] NOT NULL DEFAULT '{}',
    batting_order UUID[] NOT NULL DEFAULT '{}',
    bowling_plan UUID[] NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
