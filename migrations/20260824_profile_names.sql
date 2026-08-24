ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name_updated_at timestamptz;

CREATE TABLE IF NOT EXISTS user_name_reports (
  id uuid PRIMARY KEY,
  reporter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'removed', 'dismissed')),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  moderation_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CHECK (reporter_user_id <> reported_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS user_name_reports_pending_unique_idx
  ON user_name_reports (reporter_user_id, reported_user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS user_name_reports_status_created_idx
  ON user_name_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS user_name_reports_reported_user_idx
  ON user_name_reports (reported_user_id, created_at DESC);
