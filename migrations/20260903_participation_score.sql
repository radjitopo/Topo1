CREATE TABLE IF NOT EXISTS user_score_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_key text NOT NULL,
  ranking_id text REFERENCES rankings(id) ON DELETE SET NULL,
  points integer NOT NULL CHECK (points > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_score_event_type_check CHECK (
    event_type IN (
      'direct_vote',
      'completed_duel',
      'ranking_participation',
      'active_day',
      'qualified_share'
    )
  ),
  CONSTRAINT user_score_event_identity_unique UNIQUE (user_id, event_type, event_key)
);

CREATE INDEX IF NOT EXISTS user_score_events_user_created_idx
  ON user_score_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_score_events_leaderboard_idx
  ON user_score_events (user_id, points);

CREATE TABLE IF NOT EXISTS ranking_share_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  ranking_id text NOT NULL REFERENCES rankings(id) ON DELETE CASCADE,
  sharer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sharer_device_id text NOT NULL,
  channel text NOT NULL DEFAULT 'native',
  created_at timestamptz NOT NULL DEFAULT now(),
  converted_at timestamptz,
  converted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  converted_by_device_id text,
  CONSTRAINT ranking_share_token_length CHECK (char_length(token) BETWEEN 24 AND 64),
  CONSTRAINT ranking_share_device_length CHECK (char_length(sharer_device_id) BETWEEN 16 AND 100),
  CONSTRAINT ranking_share_conversion_device_length CHECK (
    converted_by_device_id IS NULL
    OR char_length(converted_by_device_id) BETWEEN 16 AND 100
  )
);

CREATE INDEX IF NOT EXISTS ranking_share_referrals_sharer_created_idx
  ON ranking_share_referrals (sharer_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ranking_share_referrals_pending_token_idx
  ON ranking_share_referrals (token, ranking_id)
  WHERE converted_at IS NULL;

INSERT INTO user_score_events (
  user_id, event_type, event_key, ranking_id, points, created_at
)
SELECT
  history.user_id,
  'direct_vote',
  history.option_id::text,
  option.ranking_id,
  1,
  history.first_voted_at
FROM user_vote_history history
JOIN ranking_options option ON option.id = history.option_id
JOIN rankings ranking ON ranking.id = option.ranking_id
WHERE ranking.is_vip = false
ON CONFLICT (user_id, event_type, event_key) DO NOTHING;

WITH participation AS (
  SELECT
    history.user_id,
    option.ranking_id,
    MIN(history.first_voted_at) AS occurred_at
  FROM user_vote_history history
  JOIN ranking_options option ON option.id = history.option_id
  JOIN rankings ranking ON ranking.id = option.ranking_id
  WHERE ranking.is_vip = false
  GROUP BY history.user_id, option.ranking_id

  UNION ALL

  SELECT
    round.user_id,
    round.ranking_id,
    MIN(round.created_at) AS occurred_at
  FROM ranking_duel_rounds round
  JOIN rankings ranking ON ranking.id = round.ranking_id
  WHERE round.user_id IS NOT NULL
    AND round.skipped = false
    AND ranking.is_vip = false
  GROUP BY round.user_id, round.ranking_id
), first_participation AS (
  SELECT user_id, ranking_id, MIN(occurred_at) AS occurred_at
  FROM participation
  GROUP BY user_id, ranking_id
)
INSERT INTO user_score_events (
  user_id, event_type, event_key, ranking_id, points, created_at
)
SELECT
  user_id,
  'ranking_participation',
  ranking_id,
  ranking_id,
  5,
  occurred_at
FROM first_participation
ON CONFLICT (user_id, event_type, event_key) DO NOTHING;

INSERT INTO user_score_events (
  user_id, event_type, event_key, ranking_id, points, created_at
)
SELECT
  session.user_id,
  'completed_duel',
  session.ranking_id,
  session.ranking_id,
  10,
  session.updated_at
FROM ranking_duel_sessions session
JOIN rankings ranking ON ranking.id = session.ranking_id
WHERE session.user_id IS NOT NULL
  AND session.completed = true
  AND ranking.is_vip = false
ON CONFLICT (user_id, event_type, event_key) DO NOTHING;

WITH activity AS (
  SELECT history.user_id, history.first_voted_at AS occurred_at
  FROM user_vote_history history
  JOIN ranking_options option ON option.id = history.option_id
  JOIN rankings ranking ON ranking.id = option.ranking_id
  WHERE ranking.is_vip = false

  UNION ALL

  SELECT round.user_id, round.created_at AS occurred_at
  FROM ranking_duel_rounds round
  JOIN rankings ranking ON ranking.id = round.ranking_id
  WHERE round.user_id IS NOT NULL
    AND round.skipped = false
    AND ranking.is_vip = false
), active_days AS (
  SELECT
    user_id,
    (occurred_at AT TIME ZONE 'America/Sao_Paulo')::date AS active_day,
    MIN(occurred_at) AS occurred_at
  FROM activity
  GROUP BY user_id, (occurred_at AT TIME ZONE 'America/Sao_Paulo')::date
)
INSERT INTO user_score_events (
  user_id, event_type, event_key, ranking_id, points, created_at
)
SELECT
  user_id,
  'active_day',
  active_day::text,
  NULL,
  10,
  occurred_at
FROM active_days
ON CONFLICT (user_id, event_type, event_key) DO NOTHING;
