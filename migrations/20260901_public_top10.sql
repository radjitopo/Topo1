CREATE TABLE IF NOT EXISTS public_top10_migration_state (
  migration_key text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public_top10_ranking_archive (
  ranking_id text NOT NULL,
  question text NOT NULL,
  previous_option_count integer NOT NULL,
  action text NOT NULL CHECK (action IN ('trimmed', 'deactivated_underfilled')),
  archived_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ranking_id, action)
);

CREATE TABLE IF NOT EXISTS public_top10_option_archive (
  option_id bigint PRIMARY KEY,
  ranking_id text NOT NULL,
  label text NOT NULL,
  previous_position integer NOT NULL,
  baseline_score integer NOT NULL,
  live_votes integer NOT NULL,
  double_votes integer NOT NULL,
  duel_entries integer NOT NULL,
  top3_selections integer NOT NULL,
  current_score integer NOT NULL,
  selection_rank integer NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS public_top10_option_archive_ranking_idx
  ON public_top10_option_archive (ranking_id, selection_rank);

CREATE TEMP TABLE public_top10_ranked_options ON COMMIT DROP AS
WITH eligible_rankings AS (
  SELECT option.ranking_id
  FROM ranking_options option
  JOIN rankings ranking ON ranking.id = option.ranking_id
  WHERE ranking.is_active = true
    AND ranking.is_vip = false
    AND NOT EXISTS (
      SELECT 1
      FROM public_top10_migration_state state
      WHERE state.migration_key = '20260901_public_top10'
    )
  GROUP BY option.ranking_id
  HAVING COUNT(*) > 10
),
live_vote_stats AS (
  SELECT
    vote.option_id,
    COUNT(*)::int AS live_votes,
    COALESCE(SUM(vote.direction), 0)::int AS vote_delta
  FROM votes vote
  GROUP BY vote.option_id
),
double_vote_stats AS (
  SELECT
    vote.option_id,
    COUNT(*)::int AS double_votes,
    COALESCE(SUM(vote.direction), 0)::int AS double_vote_delta
  FROM user_double_votes vote
  GROUP BY vote.option_id
),
duel_stats AS (
  SELECT entry.option_id, COUNT(*)::int AS duel_entries
  FROM ranking_duel_entries entry
  GROUP BY entry.option_id
),
top3_stats AS (
  SELECT selection.option_id, COUNT(*)::int AS top3_selections
  FROM ranking_top3_selections selection
  GROUP BY selection.option_id
),
option_stats AS (
  SELECT
    option.id AS option_id,
    option.ranking_id,
    option.label,
    option.position AS previous_position,
    option.baseline_score,
    COALESCE(live.live_votes, 0)::int AS live_votes,
    COALESCE(double_vote.double_votes, 0)::int AS double_votes,
    COALESCE(duel.duel_entries, 0)::int AS duel_entries,
    COALESCE(top3.top3_selections, 0)::int AS top3_selections,
    (
      option.baseline_score
      + COALESCE(live.vote_delta, 0)
      + COALESCE(double_vote.double_vote_delta, 0)
      + COALESCE(duel_bonus.score_bonus, 0)
    )::int AS current_score
  FROM eligible_rankings eligible
  JOIN ranking_options option ON option.ranking_id = eligible.ranking_id
  LEFT JOIN live_vote_stats live ON live.option_id = option.id
  LEFT JOIN double_vote_stats double_vote ON double_vote.option_id = option.id
  LEFT JOIN duel_stats duel ON duel.option_id = option.id
  LEFT JOIN top3_stats top3 ON top3.option_id = option.id
  LEFT JOIN ranking_duel_option_bonuses duel_bonus ON duel_bonus.option_id = option.id
)
SELECT
  stats.*,
  ROW_NUMBER() OVER (
    PARTITION BY stats.ranking_id
    ORDER BY
      ((stats.live_votes + stats.double_votes) > 0) DESC,
      stats.double_votes DESC,
      stats.live_votes DESC,
      ((stats.duel_entries + stats.top3_selections) > 0) DESC,
      (stats.duel_entries + stats.top3_selections) DESC,
      stats.current_score DESC,
      stats.previous_position,
      stats.option_id
  )::int AS selection_rank
FROM option_stats stats;

INSERT INTO public_top10_ranking_archive (
  ranking_id,
  question,
  previous_option_count,
  action
)
SELECT
  ranking.id,
  ranking.question,
  COUNT(ranked.option_id)::int,
  'trimmed'
FROM public_top10_ranked_options ranked
JOIN rankings ranking ON ranking.id = ranked.ranking_id
GROUP BY ranking.id, ranking.question
ON CONFLICT (ranking_id, action) DO NOTHING;

INSERT INTO public_top10_option_archive (
  option_id,
  ranking_id,
  label,
  previous_position,
  baseline_score,
  live_votes,
  double_votes,
  duel_entries,
  top3_selections,
  current_score,
  selection_rank
)
SELECT
  option_id,
  ranking_id,
  label,
  previous_position,
  baseline_score,
  live_votes,
  double_votes,
  duel_entries,
  top3_selections,
  current_score,
  selection_rank
FROM public_top10_ranked_options
WHERE selection_rank > 10
ON CONFLICT (option_id) DO NOTHING;

UPDATE ranking_duel_rounds round
SET
  champion_before_option_id = CASE
    WHEN EXISTS (
      SELECT 1
      FROM public_top10_ranked_options removed
      WHERE removed.option_id = round.champion_before_option_id
        AND removed.selection_rank > 10
    ) THEN NULL
    ELSE round.champion_before_option_id
  END,
  champion_after_option_id = CASE
    WHEN EXISTS (
      SELECT 1
      FROM public_top10_ranked_options removed
      WHERE removed.option_id = round.champion_after_option_id
        AND removed.selection_rank > 10
    ) THEN NULL
    ELSE round.champion_after_option_id
  END
WHERE EXISTS (
  SELECT 1
  FROM public_top10_ranked_options removed
  WHERE removed.selection_rank > 10
    AND removed.option_id IN (
      round.champion_before_option_id,
      round.champion_after_option_id
    )
);

DELETE FROM ranking_options option
USING public_top10_ranked_options ranked
WHERE option.id = ranked.option_id
  AND ranked.selection_rank > 10;

CREATE TEMP TABLE public_top10_kept_positions ON COMMIT DROP AS
SELECT
  ranked.option_id,
  ranked.ranking_id,
  ROW_NUMBER() OVER (
    PARTITION BY ranked.ranking_id
    ORDER BY ranked.current_score DESC, ranked.previous_position, ranked.option_id
  )::int AS next_position
FROM public_top10_ranked_options ranked
WHERE ranked.selection_rank <= 10;

UPDATE ranking_options option
SET position = option.position + 1000000
FROM public_top10_kept_positions kept
WHERE option.id = kept.option_id;

UPDATE ranking_options option
SET position = kept.next_position
FROM public_top10_kept_positions kept
WHERE option.id = kept.option_id;

UPDATE rankings ranking
SET content_updated_at = now()
WHERE ranking.id IN (
  SELECT DISTINCT kept.ranking_id
  FROM public_top10_kept_positions kept
);

WITH underfilled AS (
  SELECT ranking.id, ranking.question, COUNT(option.id)::int AS option_count
  FROM rankings ranking
  LEFT JOIN ranking_options option ON option.ranking_id = ranking.id
  WHERE ranking.is_active = true
    AND ranking.is_vip = false
    AND NOT EXISTS (
      SELECT 1
      FROM public_top10_migration_state state
      WHERE state.migration_key = '20260901_public_top10'
    )
  GROUP BY ranking.id, ranking.question
  HAVING COUNT(option.id) < 10
)
INSERT INTO public_top10_ranking_archive (
  ranking_id,
  question,
  previous_option_count,
  action
)
SELECT id, question, option_count, 'deactivated_underfilled'
FROM underfilled
ON CONFLICT (ranking_id, action) DO NOTHING;

UPDATE rankings ranking
SET is_active = false,
    content_updated_at = now()
WHERE ranking.is_active = true
  AND ranking.is_vip = false
  AND NOT EXISTS (
    SELECT 1
    FROM public_top10_migration_state state
    WHERE state.migration_key = '20260901_public_top10'
  )
  AND (
    SELECT COUNT(*)
    FROM ranking_options option
    WHERE option.ranking_id = ranking.id
  ) < 10;

INSERT INTO public_top10_migration_state (migration_key)
VALUES ('20260901_public_top10')
ON CONFLICT (migration_key) DO NOTHING;
