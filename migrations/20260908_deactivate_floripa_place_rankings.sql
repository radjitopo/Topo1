CREATE TABLE IF NOT EXISTS ranking_status_migration_state (
  migration_key text PRIMARY KEY,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TEMP TABLE floripa_place_ranking_targets (
  id text PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO floripa_place_ranking_targets (id)
VALUES
  ('bairros-floripa'),
  ('hoteis-floripa'),
  ('praias');

SELECT ranking.id
FROM rankings ranking
JOIN floripa_place_ranking_targets target ON target.id = ranking.id
ORDER BY ranking.id
FOR UPDATE;

DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM rankings ranking
    JOIN floripa_place_ranking_targets target ON target.id = ranking.id
  ) <> 3 THEN
    RAISE EXCEPTION 'A desativação deve encontrar exatamente os três rankings de Florianópolis que ainda estavam no TOPO.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM rankings ranking
    JOIN floripa_place_ranking_targets target ON target.id = ranking.id
    WHERE ranking.category <> 'Florianópolis'
       OR ranking.is_vip <> false
  ) THEN
    RAISE EXCEPTION 'A desativação encontrou ranking VIP ou fora de Florianópolis.';
  END IF;
END $$;

CREATE TEMP TABLE floripa_place_content_guard ON COMMIT DROP AS
SELECT
  (SELECT COUNT(*)::integer
   FROM ranking_options option
   JOIN floripa_place_ranking_targets target ON target.id = option.ranking_id) AS options,
  (SELECT COUNT(*)::integer
   FROM votes vote
   JOIN ranking_options option ON option.id = vote.option_id
   JOIN floripa_place_ranking_targets target ON target.id = option.ranking_id) AS direct_votes,
  (SELECT COUNT(*)::integer
   FROM ranking_duel_sessions session
   JOIN floripa_place_ranking_targets target ON target.id = session.ranking_id) AS duel_sessions,
  (SELECT COUNT(*)::integer
   FROM ranking_comments comment
   JOIN floripa_place_ranking_targets target ON target.id = comment.ranking_id) AS comments;

UPDATE rankings ranking
SET
  is_active = false,
  content_updated_at = now()
FROM floripa_place_ranking_targets target
WHERE ranking.id = target.id
  AND ranking.is_active = true;

INSERT INTO ranking_status_migration_state (migration_key, summary)
SELECT
  '20260908_deactivate_floripa_place_rankings',
  jsonb_build_object(
    'city', 'Florianópolis',
    'ranking_ids', (
      SELECT jsonb_agg(target.id ORDER BY target.id)
      FROM floripa_place_ranking_targets target
    ),
    'active_after', 0,
    'options_preserved', (SELECT options FROM floripa_place_content_guard),
    'direct_votes_preserved', (SELECT direct_votes FROM floripa_place_content_guard),
    'duel_sessions_preserved', (SELECT duel_sessions FROM floripa_place_content_guard),
    'comments_preserved', (SELECT comments FROM floripa_place_content_guard),
    'reversible', true
  )
ON CONFLICT (migration_key) DO NOTHING;

DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM rankings ranking
    JOIN floripa_place_ranking_targets target ON target.id = ranking.id
    WHERE ranking.is_active = false
  ) <> 3 THEN
    RAISE EXCEPTION 'Nem todos os rankings de Florianópolis foram removidos do TOPO.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM floripa_place_content_guard guard
    WHERE guard.options <> (
      SELECT COUNT(*)
      FROM ranking_options option
      JOIN floripa_place_ranking_targets target ON target.id = option.ranking_id
    )
       OR guard.direct_votes <> (
         SELECT COUNT(*)
         FROM votes vote
         JOIN ranking_options option ON option.id = vote.option_id
         JOIN floripa_place_ranking_targets target ON target.id = option.ranking_id
       )
       OR guard.duel_sessions <> (
         SELECT COUNT(*)
         FROM ranking_duel_sessions session
         JOIN floripa_place_ranking_targets target ON target.id = session.ranking_id
       )
       OR guard.comments <> (
         SELECT COUNT(*)
         FROM ranking_comments comment
         JOIN floripa_place_ranking_targets target ON target.id = comment.ranking_id
       )
  ) THEN
    RAISE EXCEPTION 'Opções ou participação mudaram durante a desativação.';
  END IF;
END $$;
