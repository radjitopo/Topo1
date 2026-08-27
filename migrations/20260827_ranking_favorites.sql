CREATE TABLE IF NOT EXISTS user_ranking_favorites (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ranking_id text NOT NULL REFERENCES rankings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ranking_id)
);

CREATE INDEX IF NOT EXISTS user_ranking_favorites_recent_idx
ON user_ranking_favorites (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_ranking_favorites_ranking_idx
ON user_ranking_favorites (ranking_id);

CREATE TABLE IF NOT EXISTS user_favorite_collections (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  share_token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_favorite_collections_share_token_idx
ON user_favorite_collections (share_token);
