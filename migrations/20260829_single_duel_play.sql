ALTER TABLE ranking_duel_sessions
  ADD COLUMN IF NOT EXISTS order_seed text NOT NULL DEFAULT gen_random_uuid()::text;

CREATE INDEX IF NOT EXISTS ranking_duel_rounds_scoring_idx
  ON ranking_duel_rounds (
    ranking_id,
    session_id,
    champion_after_option_id,
    pot_after DESC
  )
  WHERE
    session_id IS NOT NULL
    AND skipped = false
    AND champion_after_option_id IS NOT NULL;

CREATE OR REPLACE VIEW ranking_duel_option_bonuses AS
WITH session_scores AS (
  SELECT
    round.session_id,
    round.ranking_id,
    round.champion_after_option_id AS option_id,
    MAX(round.pot_after)::int AS points
  FROM ranking_duel_rounds round
  WHERE round.session_id IS NOT NULL
    AND round.skipped = false
    AND round.champion_after_option_id IS NOT NULL
  GROUP BY
    round.session_id,
    round.ranking_id,
    round.champion_after_option_id
)
SELECT
  ranking_id,
  option_id,
  SUM(points)::bigint AS duel_points,
  FLOOR(SUM(points)::numeric / 15)::int AS score_bonus
FROM session_scores
GROUP BY ranking_id, option_id;
