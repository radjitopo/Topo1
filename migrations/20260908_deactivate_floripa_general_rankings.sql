CREATE TABLE IF NOT EXISTS ranking_status_migration_state (
  migration_key text PRIMARY KEY,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TEMP TABLE floripa_general_ranking_targets (
  id text PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO floripa_general_ranking_targets (id)
VALUES
  ('bandas-ilha-da-magia'),
  ('bandas-rock-ilha-da-magia');

SELECT ranking.id
FROM rankings ranking
JOIN floripa_general_ranking_targets target ON target.id = ranking.id
ORDER BY ranking.id
FOR UPDATE;

DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM rankings ranking
    JOIN floripa_general_ranking_targets target ON target.id = ranking.id
  ) <> 2 THEN
    RAISE EXCEPTION 'A desativação deve encontrar exatamente os dois rankings locais da categoria Música.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM rankings ranking
    JOIN floripa_general_ranking_targets target ON target.id = ranking.id
    WHERE ranking.category <> 'Música'
       OR ranking.is_vip <> false
  ) THEN
    RAISE EXCEPTION 'A desativação encontrou ranking VIP ou fora da categoria Música.';
  END IF;
END $$;

CREATE TEMP TABLE floripa_general_status_guard ON COMMIT DROP AS
SELECT COUNT(*) FILTER (WHERE ranking.is_active)::integer AS active_before
FROM rankings ranking
JOIN floripa_general_ranking_targets target ON target.id = ranking.id;

CREATE TEMP TABLE floripa_general_content_guard ON COMMIT DROP AS
SELECT
  (SELECT COUNT(*)::integer
   FROM ranking_options option
   JOIN floripa_general_ranking_targets target ON target.id = option.ranking_id) AS options,
  (SELECT COUNT(*)::integer
   FROM votes vote
   JOIN ranking_options option ON option.id = vote.option_id
   JOIN floripa_general_ranking_targets target ON target.id = option.ranking_id) AS direct_votes,
  (SELECT COUNT(*)::integer
   FROM user_double_votes vote
   JOIN ranking_options option ON option.id = vote.option_id
   JOIN floripa_general_ranking_targets target ON target.id = option.ranking_id) AS double_votes,
  (SELECT COUNT(*)::integer
   FROM user_vote_history history
   JOIN ranking_options option ON option.id = history.option_id
   JOIN floripa_general_ranking_targets target ON target.id = option.ranking_id) AS vote_history,
  (SELECT COUNT(*)::integer
   FROM ranking_duel_entries entry
   JOIN floripa_general_ranking_targets target ON target.id = entry.ranking_id) AS duel_entries,
  (SELECT COUNT(*)::integer
   FROM ranking_duel_rounds round
   JOIN floripa_general_ranking_targets target ON target.id = round.ranking_id) AS duel_rounds,
  (SELECT COUNT(*)::integer
   FROM ranking_duel_sessions session
   JOIN floripa_general_ranking_targets target ON target.id = session.ranking_id) AS duel_sessions,
  (SELECT COUNT(*)::integer
   FROM ranking_top3_selections selection
   JOIN floripa_general_ranking_targets target ON target.id = selection.ranking_id) AS top3_selections,
  (SELECT COUNT(*)::integer
   FROM ranking_comments comment
   JOIN floripa_general_ranking_targets target ON target.id = comment.ranking_id) AS comments;

UPDATE rankings ranking
SET
  is_active = false,
  content_updated_at = now()
FROM floripa_general_ranking_targets target
WHERE ranking.id = target.id
  AND ranking.is_active = true;

DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM rankings ranking
    JOIN floripa_general_ranking_targets target ON target.id = ranking.id
    WHERE ranking.is_active = false
  ) <> 2 THEN
    RAISE EXCEPTION 'Nem todos os rankings locais da categoria Música foram desativados.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM floripa_general_content_guard guard
    WHERE guard.options <> (
      SELECT COUNT(*)
      FROM ranking_options option
      JOIN floripa_general_ranking_targets target ON target.id = option.ranking_id
    )
       OR guard.direct_votes <> (
         SELECT COUNT(*)
         FROM votes vote
         JOIN ranking_options option ON option.id = vote.option_id
         JOIN floripa_general_ranking_targets target ON target.id = option.ranking_id
       )
       OR guard.double_votes <> (
         SELECT COUNT(*)
         FROM user_double_votes vote
         JOIN ranking_options option ON option.id = vote.option_id
         JOIN floripa_general_ranking_targets target ON target.id = option.ranking_id
       )
       OR guard.vote_history <> (
         SELECT COUNT(*)
         FROM user_vote_history history
         JOIN ranking_options option ON option.id = history.option_id
         JOIN floripa_general_ranking_targets target ON target.id = option.ranking_id
       )
       OR guard.duel_entries <> (
         SELECT COUNT(*)
         FROM ranking_duel_entries entry
         JOIN floripa_general_ranking_targets target ON target.id = entry.ranking_id
       )
       OR guard.duel_rounds <> (
         SELECT COUNT(*)
         FROM ranking_duel_rounds round
         JOIN floripa_general_ranking_targets target ON target.id = round.ranking_id
       )
       OR guard.duel_sessions <> (
         SELECT COUNT(*)
         FROM ranking_duel_sessions session
         JOIN floripa_general_ranking_targets target ON target.id = session.ranking_id
       )
       OR guard.top3_selections <> (
         SELECT COUNT(*)
         FROM ranking_top3_selections selection
         JOIN floripa_general_ranking_targets target ON target.id = selection.ranking_id
       )
       OR guard.comments <> (
         SELECT COUNT(*)
         FROM ranking_comments comment
         JOIN floripa_general_ranking_targets target ON target.id = comment.ranking_id
       )
  ) THEN
    RAISE EXCEPTION 'Opções ou participação mudaram durante a desativação.';
  END IF;
END $$;

INSERT INTO ranking_status_migration_state (migration_key, summary)
SELECT
  '20260908_deactivate_floripa_general_rankings',
  jsonb_build_object(
    'scope', 'Topo',
    'reason', 'local_content',
    'ranking_ids', (
      SELECT jsonb_agg(target.id ORDER BY target.id)
      FROM floripa_general_ranking_targets target
    ),
    'active_before', (SELECT active_before FROM floripa_general_status_guard),
    'active_after', 0,
    'options_preserved', (SELECT options FROM floripa_general_content_guard),
    'participation_preserved', jsonb_build_object(
      'direct_votes', (SELECT direct_votes FROM floripa_general_content_guard),
      'double_votes', (SELECT double_votes FROM floripa_general_content_guard),
      'vote_history', (SELECT vote_history FROM floripa_general_content_guard),
      'duel_entries', (SELECT duel_entries FROM floripa_general_content_guard),
      'duel_rounds', (SELECT duel_rounds FROM floripa_general_content_guard),
      'duel_sessions', (SELECT duel_sessions FROM floripa_general_content_guard),
      'top3_selections', (SELECT top3_selections FROM floripa_general_content_guard),
      'comments', (SELECT comments FROM floripa_general_content_guard)
    ),
    'reversible', true
  )
ON CONFLICT (migration_key) DO NOTHING;
