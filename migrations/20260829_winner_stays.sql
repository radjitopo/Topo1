CREATE TABLE IF NOT EXISTS ranking_duel_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ranking_id text NOT NULL REFERENCES rankings(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  champion_option_id bigint,
  pot integer NOT NULL DEFAULT 0 CHECK (pot >= 0),
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ranking_duel_session_champion_fkey
    FOREIGN KEY (ranking_id, champion_option_id)
    REFERENCES ranking_options(ranking_id, id)
    ON DELETE SET NULL (champion_option_id),
  CONSTRAINT ranking_duel_session_device_length
    CHECK (char_length(device_id) BETWEEN 16 AND 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS ranking_duel_session_user_ranking_unique_idx
  ON ranking_duel_sessions (user_id, ranking_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ranking_duel_session_device_ranking_unique_idx
  ON ranking_duel_sessions (device_id, ranking_id)
  WHERE user_id IS NULL;

CREATE INDEX IF NOT EXISTS ranking_duel_session_ranking_points_idx
  ON ranking_duel_sessions (ranking_id, pot DESC, updated_at DESC);

ALTER TABLE ranking_duel_rounds
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES ranking_duel_sessions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS pot_before integer,
  ADD COLUMN IF NOT EXISTS pot_after integer,
  ADD COLUMN IF NOT EXISTS champion_before_option_id bigint,
  ADD COLUMN IF NOT EXISTS champion_after_option_id bigint;

DROP INDEX IF EXISTS ranking_duel_user_option_unique_idx;
DROP INDEX IF EXISTS ranking_duel_device_option_unique_idx;

CREATE INDEX IF NOT EXISTS ranking_duel_rounds_session_created_idx
  ON ranking_duel_rounds (session_id, created_at, id)
  WHERE session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ranking_duel_session_pot_unique_idx
  ON ranking_duel_rounds (session_id, pot_after)
  WHERE session_id IS NOT NULL AND skipped = false;

CREATE INDEX IF NOT EXISTS ranking_duel_entries_session_option_idx
  ON ranking_duel_entries (round_id, option_id);
