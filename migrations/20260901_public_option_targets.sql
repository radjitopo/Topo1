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

CREATE TEMP TABLE public_option_targets ON COMMIT DROP AS
SELECT
  ranking.id AS ranking_id,
  CASE
    WHEN ranking.category IN (
      'São Paulo', 'Rio de Janeiro', 'Brasília', 'Fortaleza', 'Salvador',
      'Belo Horizonte', 'Manaus', 'Curitiba', 'Recife', 'Goiânia', 'Belém',
      'Porto Alegre', 'Guarulhos', 'Campinas', 'São Luís', 'Maceió',
      'Campo Grande', 'São Gonçalo', 'Teresina', 'João Pessoa', 'Florianópolis'
    ) THEN 20
    ELSE 14
  END::integer AS target_count
FROM rankings ranking
WHERE ranking.is_vip = false
  AND (
    ranking.is_active = true
    OR EXISTS (
      SELECT 1
      FROM public_top10_ranking_archive archive
      WHERE archive.ranking_id = ranking.id
        AND archive.action = 'deactivated_underfilled'
    )
  );

WITH restored AS (
  INSERT INTO ranking_options (id, ranking_id, label, position, baseline_score)
  SELECT
    archive.option_id,
    archive.ranking_id,
    archive.label,
    archive.selection_rank,
    archive.current_score
  FROM public_top10_option_archive archive
  JOIN public_option_targets target ON target.ranking_id = archive.ranking_id
  WHERE archive.selection_rank <= target.target_count
    AND NOT EXISTS (
      SELECT 1 FROM ranking_options existing WHERE existing.id = archive.option_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM ranking_options existing
      WHERE existing.ranking_id = archive.ranking_id
        AND (
          existing.position = archive.selection_rank
          OR lower(trim(existing.label)) = lower(trim(archive.label))
        )
    )
  ON CONFLICT DO NOTHING
  RETURNING id, ranking_id, label
)
INSERT INTO public_option_target_additions (
  migration_key,
  option_id,
  ranking_id,
  label,
  source
)
SELECT
  '20260901_public_option_targets',
  restored.id,
  restored.ranking_id,
  restored.label,
  'top10_archive'
FROM restored
ON CONFLICT (option_id) DO NOTHING;

WITH current_counts AS (
  SELECT
    target.ranking_id,
    target.target_count,
    COUNT(option.id)::integer AS option_count,
    COALESCE(MAX(option.position), 0)::integer AS max_position
  FROM public_option_targets target
  LEFT JOIN ranking_options option ON option.ranking_id = target.ranking_id
  GROUP BY target.ranking_id, target.target_count
),
candidates AS (
  SELECT
    expansion.ranking_id,
    expansion.label,
    counts.target_count,
    counts.option_count,
    counts.max_position,
    ROW_NUMBER() OVER (
      PARTITION BY expansion.ranking_id
      ORDER BY expansion.source_order, expansion.label
    )::integer AS candidate_rank
  FROM public_option_target_expansion expansion
  JOIN current_counts counts ON counts.ranking_id = expansion.ranking_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM ranking_options existing
    WHERE existing.ranking_id = expansion.ranking_id
      AND lower(trim(existing.label)) = lower(trim(expansion.label))
  )
),
inserted AS (
  INSERT INTO ranking_options (ranking_id, label, position, baseline_score)
  SELECT
    candidate.ranking_id,
    candidate.label,
    candidate.max_position + candidate.candidate_rank,
    0
  FROM candidates candidate
  WHERE candidate.candidate_rank <= candidate.target_count - candidate.option_count
  ON CONFLICT DO NOTHING
  RETURNING id, ranking_id, label
)
INSERT INTO public_option_target_additions (
  migration_key,
  option_id,
  ranking_id,
  label,
  source
)
SELECT
  '20260901_public_option_targets',
  inserted.id,
  inserted.ranking_id,
  inserted.label,
  'editorial_expansion'
FROM inserted
ON CONFLICT (option_id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('ranking_options', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 1) FROM ranking_options), 1),
  true
);

UPDATE rankings ranking
SET
  is_active = true,
  content_updated_at = now()
WHERE ranking.is_vip = false
  AND EXISTS (
    SELECT 1
    FROM public_top10_ranking_archive archive
    WHERE archive.ranking_id = ranking.id
      AND archive.action = 'deactivated_underfilled'
  )
  AND EXISTS (
    SELECT 1
    FROM public_option_targets target
    WHERE target.ranking_id = ranking.id
      AND target.target_count = 20
  )
  AND (
    SELECT COUNT(*)
    FROM ranking_options option
    WHERE option.ranking_id = ranking.id
  ) >= 20;

UPDATE rankings ranking
SET content_updated_at = now()
WHERE ranking.id IN (
  SELECT DISTINCT addition.ranking_id
  FROM public_option_target_additions addition
  WHERE addition.migration_key = '20260901_public_option_targets'
);

DO $$
BEGIN
  IF EXISTS (
    SELECT target.ranking_id
    FROM public_option_targets target
    JOIN rankings ranking ON ranking.id = target.ranking_id
    LEFT JOIN ranking_options option ON option.ranking_id = target.ranking_id
    WHERE ranking.is_active = true
    GROUP BY target.ranking_id, target.target_count
    HAVING COUNT(option.id) < target.target_count
  ) THEN
    RAISE EXCEPTION 'Há ranking público abaixo da meta de opções.';
  END IF;
END $$;

INSERT INTO public_option_target_migration_state (migration_key, summary)
SELECT
  '20260901_public_option_targets',
  jsonb_build_object(
    'local_target', 20,
    'general_target', 14,
    'added_options', (
      SELECT COUNT(*)
      FROM public_option_target_additions addition
      WHERE addition.migration_key = '20260901_public_option_targets'
    )
  )
ON CONFLICT (migration_key) DO UPDATE SET
  summary = EXCLUDED.summary,
  applied_at = now();
