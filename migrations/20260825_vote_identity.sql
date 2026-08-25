ALTER TABLE votes
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE;

-- Os votos feitos em aparelhos já ligados a uma conta passam a pertencer
-- diretamente à conta, independentemente do aparelho usado.
WITH account_devices AS (
  SELECT device_id, user_id FROM user_devices
  UNION
  SELECT device_id, user_id FROM clerk_device_links
)
UPDATE votes AS vote
SET user_id = device.user_id
FROM account_devices AS device
WHERE vote.device_id = device.device_id
  AND vote.user_id IS NULL;

-- Mantém somente o voto mais recente quando a mesma conta já acumulou votos
-- para a mesma opção em aparelhos diferentes.
WITH ranked_votes AS (
  SELECT
    vote.device_id,
    vote.option_id,
    ROW_NUMBER() OVER (
      PARTITION BY vote.user_id, vote.option_id
      ORDER BY vote.updated_at DESC, vote.device_id
    ) AS duplicate_rank
  FROM votes AS vote
  WHERE vote.user_id IS NOT NULL
)
DELETE FROM votes AS vote
USING ranked_votes AS ranked
WHERE vote.device_id = ranked.device_id
  AND vote.option_id = ranked.option_id
  AND ranked.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS votes_user_option_unique_idx
  ON votes (user_id, option_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS votes_user_updated_idx
  ON votes (user_id, updated_at DESC)
  WHERE user_id IS NOT NULL;

INSERT INTO user_vote_history (user_id, option_id, first_voted_at)
SELECT vote.user_id, vote.option_id, MIN(vote.updated_at)
FROM votes AS vote
WHERE vote.user_id IS NOT NULL
GROUP BY vote.user_id, vote.option_id
ON CONFLICT (user_id, option_id) DO NOTHING;

-- Um voto duplo só pode continuar ativo se o voto principal correspondente
-- ainda existir e apontar para a mesma direção.
DELETE FROM user_double_votes AS double_vote
WHERE NOT EXISTS (
  SELECT 1
  FROM votes AS vote
  WHERE vote.user_id = double_vote.user_id
    AND vote.option_id = double_vote.option_id
    AND vote.direction = double_vote.direction
);
