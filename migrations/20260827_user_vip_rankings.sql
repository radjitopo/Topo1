ALTER TABLE rankings
ADD COLUMN IF NOT EXISTS vip_owner_user_id uuid
CONSTRAINT rankings_vip_owner_user_id_fkey
REFERENCES users(id) ON DELETE CASCADE
CONSTRAINT rankings_vip_owner_requires_vip
CHECK (vip_owner_user_id IS NULL OR is_vip = true);

ALTER TABLE rankings
ADD COLUMN IF NOT EXISTS vip_source_ranking_id text
CONSTRAINT rankings_vip_source_ranking_id_fkey
REFERENCES rankings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS rankings_vip_owner_created_idx
ON rankings (vip_owner_user_id, created_at DESC)
WHERE is_active = true AND is_vip = true AND vip_owner_user_id IS NOT NULL;
