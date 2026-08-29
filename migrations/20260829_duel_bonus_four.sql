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
  FLOOR(SUM(points)::numeric / 4)::int AS score_bonus
FROM session_scores
GROUP BY ranking_id, option_id;
