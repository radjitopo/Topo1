CREATE TABLE IF NOT EXISTS user_affinity_links (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  share_token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_affinity_share_token_length
    CHECK (char_length(share_token) BETWEEN 24 AND 64)
);

CREATE TABLE IF NOT EXISTS user_affinity_connections (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  compared_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, compared_user_id),
  CONSTRAINT user_affinity_connection_distinct_users
    CHECK (user_id <> compared_user_id)
);

CREATE INDEX IF NOT EXISTS user_affinity_connections_compared_idx
  ON user_affinity_connections (compared_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS user_affinity_connections_recent_idx
  ON user_affinity_connections (user_id, updated_at DESC);
