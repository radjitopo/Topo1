CREATE TABLE IF NOT EXISTS ranking_top3_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ranking_id text NOT NULL REFERENCES rankings(id) ON DELETE CASCADE,
  option_id bigint NOT NULL,
  device_id text NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ranking_top3_selection_option_fkey
    FOREIGN KEY (ranking_id, option_id)
    REFERENCES ranking_options(ranking_id, id)
    ON DELETE CASCADE,
  CONSTRAINT ranking_top3_selection_device_length
    CHECK (char_length(device_id) BETWEEN 16 AND 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS ranking_top3_user_option_unique_idx
  ON ranking_top3_selections (user_id, ranking_id, option_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ranking_top3_device_option_unique_idx
  ON ranking_top3_selections (device_id, ranking_id, option_id)
  WHERE user_id IS NULL;

CREATE INDEX IF NOT EXISTS ranking_top3_ranking_option_idx
  ON ranking_top3_selections (ranking_id, option_id);

CREATE TABLE IF NOT EXISTS ranking_duel_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ranking_id text NOT NULL REFERENCES rankings(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  skipped boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ranking_duel_round_device_length
    CHECK (char_length(device_id) BETWEEN 16 AND 100),
  CONSTRAINT ranking_duel_round_identity_unique
    UNIQUE (id, ranking_id)
);

CREATE INDEX IF NOT EXISTS ranking_duel_rounds_ranking_created_idx
  ON ranking_duel_rounds (ranking_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ranking_duel_rounds_user_ranking_idx
  ON ranking_duel_rounds (user_id, ranking_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ranking_duel_rounds_device_ranking_idx
  ON ranking_duel_rounds (device_id, ranking_id, created_at DESC)
  WHERE user_id IS NULL;

CREATE TABLE IF NOT EXISTS ranking_duel_entries (
  round_id uuid NOT NULL,
  ranking_id text NOT NULL,
  option_id bigint NOT NULL,
  device_id text NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  won boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (round_id, option_id),
  CONSTRAINT ranking_duel_entry_round_fkey
    FOREIGN KEY (round_id, ranking_id)
    REFERENCES ranking_duel_rounds(id, ranking_id)
    ON DELETE CASCADE,
  CONSTRAINT ranking_duel_entry_option_fkey
    FOREIGN KEY (ranking_id, option_id)
    REFERENCES ranking_options(ranking_id, id)
    ON DELETE CASCADE,
  CONSTRAINT ranking_duel_entry_device_length
    CHECK (char_length(device_id) BETWEEN 16 AND 100)
);

CREATE INDEX IF NOT EXISTS ranking_duel_ranking_result_idx
  ON ranking_duel_entries (ranking_id, option_id, won);
