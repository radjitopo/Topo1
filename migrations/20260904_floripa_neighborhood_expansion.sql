CREATE TABLE IF NOT EXISTS public_option_target_migration_state (
  migration_key text PRIMARY KEY,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public_option_target_additions (
  migration_key text NOT NULL,
  option_id bigint PRIMARY KEY,
  ranking_id text NOT NULL,
  label text NOT NULL,
  source text NOT NULL CHECK (source IN ('top10_archive', 'editorial_expansion')),
  added_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS public_option_target_additions_ranking_idx
  ON public_option_target_additions (ranking_id);

LOCK TABLE ranking_options IN SHARE ROW EXCLUSIVE MODE;

SELECT ranking.id
FROM rankings ranking
WHERE ranking.id IN (
  SELECT DISTINCT incoming.ranking_id
  FROM floripa_neighborhood_expansion incoming
)
ORDER BY ranking.id
FOR UPDATE;

DO $$
BEGIN
  IF (
    SELECT COUNT(DISTINCT incoming.ranking_id)
    FROM floripa_neighborhood_expansion incoming
  ) <> 20 THEN
    RAISE EXCEPTION 'A expansão de Florianópolis deve cobrir exatamente 20 rankings.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM floripa_neighborhood_expansion incoming
    LEFT JOIN rankings ranking ON ranking.id = incoming.ranking_id
    WHERE ranking.id IS NULL
       OR ranking.category <> 'Florianópolis'
       OR ranking.is_active <> true
       OR ranking.is_vip <> false
  ) THEN
    RAISE EXCEPTION 'A expansão encontrou ranking ausente, inativo, VIP ou fora de Florianópolis.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM floripa_neighborhood_expansion incoming
    WHERE btrim(incoming.label) = ''
       OR btrim(incoming.neighborhood) = ''
       OR incoming.region NOT IN ('Central', 'Continental', 'Norte', 'Sul', 'Leste')
  ) THEN
    RAISE EXCEPTION 'A expansão contém rótulo, bairro ou região inválida.';
  END IF;

  IF EXISTS (
    SELECT incoming.ranking_id
    FROM floripa_neighborhood_expansion incoming
    GROUP BY
      incoming.ranking_id,
      lower(regexp_replace(btrim(incoming.label), '\s+', ' ', 'g'))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'A expansão contém opção duplicada no mesmo ranking.';
  END IF;
END $$;

CREATE TEMP TABLE floripa_neighborhood_existing_options ON COMMIT DROP AS
SELECT
  option.id,
  option.ranking_id,
  option.label,
  option.position,
  option.baseline_score,
  option.vip_added_later
FROM ranking_options option
WHERE option.ranking_id IN (
  SELECT DISTINCT incoming.ranking_id
  FROM floripa_neighborhood_expansion incoming
);

CREATE TEMP TABLE floripa_neighborhood_participation ON COMMIT DROP AS
SELECT
  (
    SELECT COUNT(*)
    FROM votes vote
    JOIN floripa_neighborhood_existing_options option ON option.id = vote.option_id
  )::bigint AS direct_votes,
  (
    SELECT COUNT(*)
    FROM user_double_votes vote
    JOIN floripa_neighborhood_existing_options option ON option.id = vote.option_id
  )::bigint AS double_votes,
  (
    SELECT COUNT(*)
    FROM user_vote_history history
    JOIN floripa_neighborhood_existing_options option ON option.id = history.option_id
  )::bigint AS vote_history,
  (
    SELECT COUNT(*)
    FROM ranking_duel_entries entry
    JOIN floripa_neighborhood_existing_options option ON option.id = entry.option_id
  )::bigint AS duel_entries,
  (
    SELECT COUNT(*)
    FROM ranking_duel_rounds round
    WHERE round.ranking_id IN (
      SELECT DISTINCT incoming.ranking_id FROM floripa_neighborhood_expansion incoming
    )
  )::bigint AS duel_rounds,
  (
    SELECT COUNT(*)
    FROM ranking_duel_sessions session
    WHERE session.ranking_id IN (
      SELECT DISTINCT incoming.ranking_id FROM floripa_neighborhood_expansion incoming
    )
  )::bigint AS duel_sessions,
  (
    SELECT COUNT(*)
    FROM ranking_top3_selections selection
    WHERE selection.ranking_id IN (
      SELECT DISTINCT incoming.ranking_id FROM floripa_neighborhood_expansion incoming
    )
  )::bigint AS top3_selections,
  (
    SELECT COUNT(*)
    FROM ranking_comments comment
    WHERE comment.ranking_id IN (
      SELECT DISTINCT incoming.ranking_id FROM floripa_neighborhood_expansion incoming
    )
  )::bigint AS comments;

CREATE TEMP TABLE floripa_neighborhood_candidates ON COMMIT DROP AS
WITH current_positions AS (
  SELECT
    incoming.ranking_id,
    COALESCE(MAX(option.position), 0)::integer AS max_position
  FROM (
    SELECT DISTINCT ranking_id FROM floripa_neighborhood_expansion
  ) incoming
  LEFT JOIN ranking_options option ON option.ranking_id = incoming.ranking_id
  GROUP BY incoming.ranking_id
),
missing AS (
  SELECT
    incoming.ranking_id,
    incoming.label,
    incoming.neighborhood,
    incoming.region,
    incoming.source_order,
    positions.max_position
  FROM floripa_neighborhood_expansion incoming
  JOIN current_positions positions ON positions.ranking_id = incoming.ranking_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM ranking_options existing
    WHERE existing.ranking_id = incoming.ranking_id
      AND lower(regexp_replace(btrim(existing.label), '\s+', ' ', 'g')) =
          lower(regexp_replace(btrim(incoming.label), '\s+', ' ', 'g'))
  )
),
numbered AS (
  SELECT
    missing.*,
    ROW_NUMBER() OVER (
      PARTITION BY missing.ranking_id
      ORDER BY missing.source_order, lower(missing.label), missing.label
    )::integer AS addition_order
  FROM missing
)
SELECT
  numbered.ranking_id,
  numbered.label,
  numbered.neighborhood,
  numbered.region,
  numbered.source_order,
  numbered.max_position + numbered.addition_order AS position
FROM numbered;

INSERT INTO ranking_options (
  ranking_id,
  label,
  position,
  baseline_score,
  vip_added_later
)
SELECT
  candidate.ranking_id,
  candidate.label,
  candidate.position,
  0,
  false
FROM floripa_neighborhood_candidates candidate
ORDER BY candidate.ranking_id, candidate.position
ON CONFLICT DO NOTHING;

INSERT INTO public_option_target_additions (
  migration_key,
  option_id,
  ranking_id,
  label,
  source
)
SELECT
  '20260904_floripa_neighborhood_expansion',
  option.id,
  option.ranking_id,
  option.label,
  'editorial_expansion'
FROM floripa_neighborhood_candidates candidate
JOIN ranking_options option
  ON option.ranking_id = candidate.ranking_id
 AND option.position = candidate.position
 AND option.label = candidate.label
ON CONFLICT (option_id) DO NOTHING;

UPDATE rankings ranking
SET content_updated_at = now()
WHERE ranking.id IN (
  SELECT DISTINCT candidate.ranking_id
  FROM floripa_neighborhood_candidates candidate
);

INSERT INTO public_option_target_migration_state (migration_key, summary)
SELECT
  '20260904_floripa_neighborhood_expansion',
  jsonb_build_object(
    'city', 'Florianópolis',
    'rankings_reviewed', (
      SELECT COUNT(DISTINCT incoming.ranking_id)
      FROM floripa_neighborhood_expansion incoming
    ),
    'regions_reviewed', 5,
    'requested_options', (
      SELECT COUNT(*) FROM floripa_neighborhood_expansion
    ),
    'added_options', (
      SELECT COUNT(*)
      FROM public_option_target_additions addition
      WHERE addition.migration_key = '20260904_floripa_neighborhood_expansion'
    ),
    'append_only', true,
    'votes_preserved', true
  )
ON CONFLICT (migration_key) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM floripa_neighborhood_expansion incoming
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::integer AS matches
      FROM ranking_options option
      WHERE option.ranking_id = incoming.ranking_id
        AND lower(regexp_replace(btrim(option.label), '\s+', ' ', 'g')) =
            lower(regexp_replace(btrim(incoming.label), '\s+', ' ', 'g'))
    ) existing ON true
    WHERE existing.matches <> 1
  ) THEN
    RAISE EXCEPTION 'Nem todas as novas opções ficaram presentes uma única vez.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM floripa_neighborhood_existing_options snapshot
    LEFT JOIN ranking_options option ON option.id = snapshot.id
    WHERE option.id IS NULL
       OR option.ranking_id IS DISTINCT FROM snapshot.ranking_id
       OR option.label IS DISTINCT FROM snapshot.label
       OR option.position IS DISTINCT FROM snapshot.position
       OR option.baseline_score IS DISTINCT FROM snapshot.baseline_score
       OR option.vip_added_later IS DISTINCT FROM snapshot.vip_added_later
  ) THEN
    RAISE EXCEPTION 'Uma opção anterior foi removida ou alterada.';
  END IF;

  IF (
    SELECT direct_votes FROM floripa_neighborhood_participation
  ) <> (
    SELECT COUNT(*)
    FROM votes vote
    JOIN floripa_neighborhood_existing_options option ON option.id = vote.option_id
  ) OR (
    SELECT double_votes FROM floripa_neighborhood_participation
  ) <> (
    SELECT COUNT(*)
    FROM user_double_votes vote
    JOIN floripa_neighborhood_existing_options option ON option.id = vote.option_id
  ) OR (
    SELECT vote_history FROM floripa_neighborhood_participation
  ) <> (
    SELECT COUNT(*)
    FROM user_vote_history history
    JOIN floripa_neighborhood_existing_options option ON option.id = history.option_id
  ) OR (
    SELECT duel_entries FROM floripa_neighborhood_participation
  ) <> (
    SELECT COUNT(*)
    FROM ranking_duel_entries entry
    JOIN floripa_neighborhood_existing_options option ON option.id = entry.option_id
  ) OR (
    SELECT duel_rounds FROM floripa_neighborhood_participation
  ) <> (
    SELECT COUNT(*)
    FROM ranking_duel_rounds round
    WHERE round.ranking_id IN (
      SELECT DISTINCT incoming.ranking_id FROM floripa_neighborhood_expansion incoming
    )
  ) OR (
    SELECT duel_sessions FROM floripa_neighborhood_participation
  ) <> (
    SELECT COUNT(*)
    FROM ranking_duel_sessions session
    WHERE session.ranking_id IN (
      SELECT DISTINCT incoming.ranking_id FROM floripa_neighborhood_expansion incoming
    )
  ) OR (
    SELECT top3_selections FROM floripa_neighborhood_participation
  ) <> (
    SELECT COUNT(*)
    FROM ranking_top3_selections selection
    WHERE selection.ranking_id IN (
      SELECT DISTINCT incoming.ranking_id FROM floripa_neighborhood_expansion incoming
    )
  ) OR (
    SELECT comments FROM floripa_neighborhood_participation
  ) <> (
    SELECT COUNT(*)
    FROM ranking_comments comment
    WHERE comment.ranking_id IN (
      SELECT DISTINCT incoming.ranking_id FROM floripa_neighborhood_expansion incoming
    )
  ) THEN
    RAISE EXCEPTION 'A participação anterior mudou durante a expansão.';
  END IF;
END $$;
