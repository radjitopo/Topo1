CREATE TABLE IF NOT EXISTS clerk_user_links (
  clerk_user_id text PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clerk_device_links (
  device_id text PRIMARY KEY,
  clerk_user_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clerk_user_id, device_id)
);
