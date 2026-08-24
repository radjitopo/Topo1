ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_last_seen_at timestamptz;

UPDATE users
SET notification_last_seen_at = now()
WHERE notification_last_seen_at IS NULL;

ALTER TABLE users
  ALTER COLUMN notification_last_seen_at SET DEFAULT now();

CREATE TABLE IF NOT EXISTS user_notifications (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL
    CHECK (kind IN ('ranking_changed', 'double_vote', 'level', 'return')),
  title text NOT NULL,
  body text NOT NULL,
  href text NOT NULL DEFAULT '/perfil',
  dedupe_key text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_notifications_dedupe_idx
  ON user_notifications (user_id, dedupe_key);

CREATE INDEX IF NOT EXISTS user_notifications_user_created_idx
  ON user_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_notifications_unread_idx
  ON user_notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;
