CREATE TABLE IF NOT EXISTS anonymous_vote_usage (
  device_id text PRIMARY KEY,
  votes_used integer NOT NULL DEFAULT 0 CHECK (votes_used >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT anonymous_vote_usage_device_length
    CHECK (char_length(device_id) BETWEEN 16 AND 100)
);

CREATE TABLE IF NOT EXISTS anonymous_duel_usage (
  device_id text PRIMARY KEY,
  duels_completed integer NOT NULL DEFAULT 0 CHECK (duels_completed >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT anonymous_duel_usage_device_length
    CHECK (char_length(device_id) BETWEEN 16 AND 100)
);

INSERT INTO anonymous_vote_usage (device_id, votes_used, updated_at)
SELECT
  source.device_id,
  LEAST(10, SUM(source.uses)::int),
  now()
FROM (
  SELECT vote.device_id, COUNT(*)::int AS uses
  FROM votes vote
  JOIN ranking_options option ON option.id = vote.option_id
  JOIN rankings ranking ON ranking.id = option.ranking_id
  WHERE vote.user_id IS NULL
    AND ranking.is_vip = false
  GROUP BY vote.device_id

  UNION ALL

  SELECT selection.device_id, COUNT(DISTINCT selection.ranking_id)::int AS uses
  FROM ranking_top3_selections selection
  JOIN rankings ranking ON ranking.id = selection.ranking_id
  WHERE selection.user_id IS NULL
    AND ranking.is_vip = false
  GROUP BY selection.device_id
) source
GROUP BY source.device_id
ON CONFLICT (device_id)
DO UPDATE SET
  votes_used = GREATEST(anonymous_vote_usage.votes_used, EXCLUDED.votes_used),
  updated_at = now();

INSERT INTO anonymous_duel_usage (device_id, duels_completed, updated_at)
SELECT
  session.device_id,
  COUNT(*)::int,
  now()
FROM ranking_duel_sessions session
WHERE session.user_id IS NULL
  AND session.completed = true
GROUP BY session.device_id
ON CONFLICT (device_id)
DO UPDATE SET
  duels_completed = GREATEST(
    anonymous_duel_usage.duels_completed,
    EXCLUDED.duels_completed
  ),
  updated_at = now();
