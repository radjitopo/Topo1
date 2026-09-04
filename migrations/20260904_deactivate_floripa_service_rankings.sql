CREATE TABLE IF NOT EXISTS ranking_status_migration_state (
  migration_key text PRIMARY KEY,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TEMP TABLE floripa_service_ranking_targets (
  id text PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO floripa_service_ranking_targets (id)
VALUES
  ('barbearias-floripa'),
  ('pet-shops-floripa'),
  ('saloes-beleza-floripa');

SELECT ranking.id
FROM rankings ranking
JOIN floripa_service_ranking_targets target ON target.id = ranking.id
ORDER BY ranking.id
FOR UPDATE;

DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM rankings ranking
    JOIN floripa_service_ranking_targets target ON target.id = ranking.id
  ) <> 3 THEN
    RAISE EXCEPTION 'A desativação deve encontrar exatamente os três rankings solicitados.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM rankings ranking
    JOIN floripa_service_ranking_targets target ON target.id = ranking.id
    WHERE ranking.category <> 'Florianópolis'
       OR ranking.is_vip <> false
  ) THEN
    RAISE EXCEPTION 'A desativação encontrou ranking VIP ou fora de Florianópolis.';
  END IF;
END $$;

CREATE TEMP TABLE floripa_service_status_guard ON COMMIT DROP AS
SELECT COUNT(*) FILTER (WHERE ranking.is_active)::integer AS active_before
FROM rankings ranking
JOIN floripa_service_ranking_targets target ON target.id = ranking.id;

CREATE TEMP TABLE floripa_service_option_guard ON COMMIT DROP AS
SELECT to_jsonb(option) AS row_data
FROM ranking_options option
JOIN floripa_service_ranking_targets target ON target.id = option.ranking_id;

CREATE TEMP TABLE floripa_service_participation_guard ON COMMIT DROP AS
SELECT 'direct_votes'::text AS source, to_jsonb(vote) AS row_data
FROM votes vote
JOIN ranking_options option ON option.id = vote.option_id
JOIN floripa_service_ranking_targets target ON target.id = option.ranking_id
UNION ALL
SELECT 'double_votes', to_jsonb(vote)
FROM user_double_votes vote
JOIN ranking_options option ON option.id = vote.option_id
JOIN floripa_service_ranking_targets target ON target.id = option.ranking_id
UNION ALL
SELECT 'vote_history', to_jsonb(history)
FROM user_vote_history history
JOIN ranking_options option ON option.id = history.option_id
JOIN floripa_service_ranking_targets target ON target.id = option.ranking_id
UNION ALL
SELECT 'duel_entries', to_jsonb(entry)
FROM ranking_duel_entries entry
JOIN floripa_service_ranking_targets target ON target.id = entry.ranking_id
UNION ALL
SELECT 'duel_rounds', to_jsonb(round)
FROM ranking_duel_rounds round
JOIN floripa_service_ranking_targets target ON target.id = round.ranking_id
UNION ALL
SELECT 'duel_sessions', to_jsonb(session)
FROM ranking_duel_sessions session
JOIN floripa_service_ranking_targets target ON target.id = session.ranking_id
UNION ALL
SELECT 'top3_selections', to_jsonb(selection)
FROM ranking_top3_selections selection
JOIN floripa_service_ranking_targets target ON target.id = selection.ranking_id
UNION ALL
SELECT 'comments', to_jsonb(comment)
FROM ranking_comments comment
JOIN floripa_service_ranking_targets target ON target.id = comment.ranking_id;

UPDATE rankings ranking
SET
  is_active = false,
  content_updated_at = now()
FROM floripa_service_ranking_targets target
WHERE ranking.id = target.id
  AND ranking.is_active = true;

INSERT INTO ranking_status_migration_state (migration_key, summary)
SELECT
  '20260904_deactivate_floripa_service_rankings',
  jsonb_build_object(
    'city', 'Florianópolis',
    'ranking_ids', (
      SELECT jsonb_agg(target.id ORDER BY target.id)
      FROM floripa_service_ranking_targets target
    ),
    'active_before', (SELECT active_before FROM floripa_service_status_guard),
    'active_after', 0,
    'options_preserved', (SELECT COUNT(*) FROM floripa_service_option_guard),
    'participation_preserved', jsonb_build_object(
      'direct_votes', (SELECT COUNT(*) FROM floripa_service_participation_guard WHERE source = 'direct_votes'),
      'double_votes', (SELECT COUNT(*) FROM floripa_service_participation_guard WHERE source = 'double_votes'),
      'vote_history', (SELECT COUNT(*) FROM floripa_service_participation_guard WHERE source = 'vote_history'),
      'duel_entries', (SELECT COUNT(*) FROM floripa_service_participation_guard WHERE source = 'duel_entries'),
      'duel_rounds', (SELECT COUNT(*) FROM floripa_service_participation_guard WHERE source = 'duel_rounds'),
      'duel_sessions', (SELECT COUNT(*) FROM floripa_service_participation_guard WHERE source = 'duel_sessions'),
      'top3_selections', (SELECT COUNT(*) FROM floripa_service_participation_guard WHERE source = 'top3_selections'),
      'comments', (SELECT COUNT(*) FROM floripa_service_participation_guard WHERE source = 'comments')
    ),
    'reversible', true
  )
ON CONFLICT (migration_key) DO NOTHING;

DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM rankings ranking
    JOIN floripa_service_ranking_targets target ON target.id = ranking.id
    WHERE ranking.is_active = false
  ) <> 3 THEN
    RAISE EXCEPTION 'Nem todos os rankings solicitados foram desativados.';
  END IF;

  IF EXISTS (
    (SELECT guard.row_data FROM floripa_service_option_guard guard
     EXCEPT ALL
     SELECT to_jsonb(option)
     FROM ranking_options option
     JOIN floripa_service_ranking_targets target ON target.id = option.ranking_id)
    UNION ALL
    (SELECT to_jsonb(option)
     FROM ranking_options option
     JOIN floripa_service_ranking_targets target ON target.id = option.ranking_id
     EXCEPT ALL
     SELECT guard.row_data FROM floripa_service_option_guard guard)
  ) THEN
    RAISE EXCEPTION 'Uma opção foi removida ou alterada durante a desativação.';
  END IF;

  IF EXISTS (
    WITH current_participation AS (
      SELECT 'direct_votes'::text AS source, to_jsonb(vote) AS row_data
      FROM votes vote
      JOIN ranking_options option ON option.id = vote.option_id
      JOIN floripa_service_ranking_targets target ON target.id = option.ranking_id
      UNION ALL
      SELECT 'double_votes', to_jsonb(vote)
      FROM user_double_votes vote
      JOIN ranking_options option ON option.id = vote.option_id
      JOIN floripa_service_ranking_targets target ON target.id = option.ranking_id
      UNION ALL
      SELECT 'vote_history', to_jsonb(history)
      FROM user_vote_history history
      JOIN ranking_options option ON option.id = history.option_id
      JOIN floripa_service_ranking_targets target ON target.id = option.ranking_id
      UNION ALL
      SELECT 'duel_entries', to_jsonb(entry)
      FROM ranking_duel_entries entry
      JOIN floripa_service_ranking_targets target ON target.id = entry.ranking_id
      UNION ALL
      SELECT 'duel_rounds', to_jsonb(round)
      FROM ranking_duel_rounds round
      JOIN floripa_service_ranking_targets target ON target.id = round.ranking_id
      UNION ALL
      SELECT 'duel_sessions', to_jsonb(session)
      FROM ranking_duel_sessions session
      JOIN floripa_service_ranking_targets target ON target.id = session.ranking_id
      UNION ALL
      SELECT 'top3_selections', to_jsonb(selection)
      FROM ranking_top3_selections selection
      JOIN floripa_service_ranking_targets target ON target.id = selection.ranking_id
      UNION ALL
      SELECT 'comments', to_jsonb(comment)
      FROM ranking_comments comment
      JOIN floripa_service_ranking_targets target ON target.id = comment.ranking_id
    )
    (SELECT source, row_data FROM floripa_service_participation_guard
     EXCEPT ALL
     SELECT source, row_data FROM current_participation)
    UNION ALL
    (SELECT source, row_data FROM current_participation
     EXCEPT ALL
     SELECT source, row_data FROM floripa_service_participation_guard)
  ) THEN
    RAISE EXCEPTION 'A participação mudou durante a desativação.';
  END IF;
END $$;
