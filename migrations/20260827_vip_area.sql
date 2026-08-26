ALTER TABLE rankings
ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false;

ALTER TABLE rankings
ADD COLUMN IF NOT EXISTS vip_password_hash text;

ALTER TABLE rankings
ADD COLUMN IF NOT EXISTS vip_password_version integer NOT NULL DEFAULT 0;

ALTER TABLE rankings
ADD COLUMN IF NOT EXISTS vip_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS rankings_vip_created_idx
ON rankings (created_at DESC)
WHERE is_active = true AND is_vip = true;

CREATE TABLE IF NOT EXISTS ranking_vip_unlock_attempts (
  id bigserial PRIMARY KEY,
  ranking_id text NOT NULL REFERENCES rankings(id) ON DELETE CASCADE,
  client_key text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ranking_vip_unlock_attempts_lookup_idx
ON ranking_vip_unlock_attempts (ranking_id, client_key, attempted_at DESC);
