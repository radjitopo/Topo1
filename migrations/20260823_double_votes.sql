CREATE TABLE IF NOT EXISTS user_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  avatar_data text,
  show_avatar_on_leaderboard boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_vote_history (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_id bigint NOT NULL REFERENCES ranking_options(id) ON DELETE CASCADE,
  first_voted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, option_id)
);

CREATE INDEX IF NOT EXISTS user_vote_history_user_first_idx
  ON user_vote_history (user_id, first_voted_at DESC);

CREATE TABLE IF NOT EXISTS user_double_votes (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 3),
  option_id bigint NOT NULL REFERENCES ranking_options(id) ON DELETE CASCADE,
  direction smallint NOT NULL CHECK (direction IN (-1, 1)),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, slot),
  UNIQUE (user_id, option_id)
);

CREATE INDEX IF NOT EXISTS user_double_votes_option_idx
  ON user_double_votes (option_id);

-- Votos que já pertencem a uma conta contam para as conquistas iniciais.
INSERT INTO user_vote_history (user_id, option_id, first_voted_at)
SELECT ud.user_id, v.option_id, MIN(v.updated_at)
FROM user_devices ud
JOIN votes v ON v.device_id = ud.device_id
GROUP BY ud.user_id, v.option_id
ON CONFLICT (user_id, option_id) DO NOTHING;
