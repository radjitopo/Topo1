import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements.mjs';

const sqlOutputMode = process.argv.includes('--sql');
const preflightOutputMode = process.argv.includes('--preflight-sql');
const validationOutputMode = process.argv.includes('--validation-sql');

if (!sqlOutputMode && !preflightOutputMode && !validationOutputMode && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const [review, archiveMigration] = await Promise.all([
  readFile(new URL('../data/local-bars-botecos-2026-09.json', import.meta.url), 'utf8').then(
    JSON.parse,
  ),
  readFile(new URL('../migrations/20260901_option_relevance_review.sql', import.meta.url), 'utf8'),
]);

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const desiredRankings = review.cities.flatMap((city) => [
  {
    ranking_id: `bares-${city.slug}`,
    city: city.city,
    kind: 'bar',
    question: `Qual é o melhor bar em ${city.city}?`,
    options: city.bars,
    source_url: city.sources[0],
  },
  {
    ranking_id: `botecos-${city.slug}`,
    city: city.city,
    kind: 'boteco',
    question: `Qual é o melhor boteco em ${city.city}?`,
    options: city.botecos,
    source_url: city.sources[0],
  },
]);

if (
  review.reviewKey !== 'local-bars-botecos-2026-09-v1' ||
  review.scope?.cityCount !== 21 ||
  review.scope?.rankingCount !== 42 ||
  review.scope?.optionsPerRanking !== 20 ||
  review.scope?.municipalityStrict !== true ||
  review.cities.length !== 21 ||
  desiredRankings.length !== 42 ||
  new Set(desiredRankings.map((ranking) => ranking.ranking_id)).size !== 42
) {
  throw new Error('Invalid bars and botecos review scope');
}

for (const city of review.cities) {
  const bars = city.bars.map(fold);
  const botecos = city.botecos.map(fold);
  if (
    !city.city ||
    !city.slug ||
    !Array.isArray(city.sources) ||
    city.sources.length === 0 ||
    city.bars.length !== 20 ||
    city.botecos.length !== 20 ||
    new Set(bars).size !== 20 ||
    new Set(botecos).size !== 20 ||
    bars.some((label) => botecos.includes(label)) ||
    [...city.bars, ...city.botecos].some((label) => !label || label.trim() !== label)
  ) {
    throw new Error(`Invalid bars and botecos review for ${city.city || city.slug}`);
  }
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const payload = `${quote(JSON.stringify(desiredRankings))}::jsonb`;
const reviewKey = quote(review.reviewKey);
const imageUrl = quote(
  'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=82',
);

const desiredRankingsCte = `desired_rankings AS (
  SELECT ranking_id, city, kind, question, options, source_url
  FROM jsonb_to_recordset(${payload}) AS incoming(
    ranking_id text,
    city text,
    kind text,
    question text,
    options jsonb,
    source_url text
  )
)`;

const targetOptionsCte = `target_options AS (
  SELECT option.id, option.ranking_id
  FROM ranking_options option
  JOIN desired_rankings desired ON desired.ranking_id = option.ranking_id
)`;

const preflightSql = `WITH ${desiredRankingsCte}, ${targetOptionsCte}
SELECT
  (SELECT COUNT(*)::int FROM desired_rankings) AS desired_rankings,
  (SELECT COUNT(DISTINCT city)::int FROM desired_rankings) AS desired_cities,
  (SELECT SUM(jsonb_array_length(options))::int FROM desired_rankings) AS desired_options,
  (SELECT COUNT(*)::int FROM rankings ranking JOIN desired_rankings desired ON desired.ranking_id = ranking.id WHERE desired.kind = 'bar') AS existing_bars,
  (SELECT COUNT(*)::int FROM rankings ranking JOIN desired_rankings desired ON desired.ranking_id = ranking.id WHERE desired.kind = 'boteco') AS existing_botecos,
  (SELECT COUNT(*)::int FROM target_options) AS current_options,
  (SELECT COUNT(*)::int FROM votes vote JOIN target_options option ON option.id = vote.option_id) AS direct_votes,
  (SELECT COUNT(*)::int FROM user_double_votes vote JOIN target_options option ON option.id = vote.option_id) AS double_votes,
  (SELECT COUNT(*)::int FROM user_vote_history history JOIN target_options option ON option.id = history.option_id) AS vote_history,
  (SELECT COUNT(*)::int FROM ranking_top3_selections selection JOIN desired_rankings desired ON desired.ranking_id = selection.ranking_id) AS top3_selections,
  (SELECT COUNT(*)::int FROM ranking_duel_rounds round JOIN desired_rankings desired ON desired.ranking_id = round.ranking_id) AS duel_rounds,
  (SELECT COUNT(*)::int FROM ranking_duel_entries entry JOIN desired_rankings desired ON desired.ranking_id = entry.ranking_id) AS duel_entries,
  (SELECT COUNT(*)::int FROM ranking_duel_sessions session JOIN desired_rankings desired ON desired.ranking_id = session.ranking_id) AS duel_sessions,
  (SELECT COUNT(*)::int FROM ranking_comments comment JOIN desired_rankings desired ON desired.ranking_id = comment.ranking_id) AS comments,
  (SELECT COUNT(*)::int FROM user_score_events event JOIN desired_rankings desired ON desired.ranking_id = event.ranking_id) AS preserved_score_events,
  (SELECT COALESCE(SUM(event.points), 0)::int FROM user_score_events event JOIN desired_rankings desired ON desired.ranking_id = event.ranking_id) AS preserved_score_points,
  (SELECT COUNT(*)::int FROM option_relevance_review_state WHERE review_key = ${reviewKey}) AS already_applied;`;

const setupStatements = splitSqlStatements(archiveMigration);
const migrationStatements = [
  `CREATE TEMP TABLE bars_botecos_desired_rankings ON COMMIT DROP AS
   SELECT ranking_id, city, kind, question, options, source_url
   FROM jsonb_to_recordset(${payload}) AS incoming(
     ranking_id text,
     city text,
     kind text,
     question text,
     options jsonb,
     source_url text
   )`,
  `CREATE UNIQUE INDEX bars_botecos_desired_rankings_id_idx
   ON bars_botecos_desired_rankings (ranking_id)`,
  `CREATE TEMP TABLE bars_botecos_desired_options ON COMMIT DROP AS
   SELECT
     ranking.ranking_id,
     option.ordinality::integer AS position,
     option.label
   FROM bars_botecos_desired_rankings ranking
   CROSS JOIN LATERAL jsonb_array_elements_text(ranking.options)
     WITH ORDINALITY AS option(label, ordinality)`,
  `CREATE UNIQUE INDEX bars_botecos_desired_options_position_idx
   ON bars_botecos_desired_options (ranking_id, position)`,
  `CREATE UNIQUE INDEX bars_botecos_desired_options_label_idx
   ON bars_botecos_desired_options (ranking_id, lower(btrim(label)))`,
  `CREATE TEMP TABLE bars_botecos_run_guard ON COMMIT DROP AS
   SELECT NOT EXISTS (
     SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
   ) AS should_apply`,
  `CREATE TEMP TABLE bars_botecos_score_guard ON COMMIT DROP AS
   SELECT
     COUNT(event.id)::integer AS event_count,
     COALESCE(SUM(event.points), 0)::integer AS point_count,
     md5(COALESCE(string_agg(
       concat_ws('|', event.id, event.user_id, event.event_type, event.event_key, event.ranking_id, event.points, event.created_at),
       E'\\n' ORDER BY event.id
     ), '')) AS signature
   FROM user_score_events event
   JOIN bars_botecos_desired_rankings desired ON desired.ranking_id = event.ranking_id`,
  `CREATE TEMP TABLE bars_botecos_duel_guard ON COMMIT DROP AS
   SELECT
     (SELECT COUNT(*)::int FROM ranking_duel_rounds round JOIN bars_botecos_desired_rankings desired ON desired.ranking_id = round.ranking_id WHERE desired.kind = 'bar') AS rounds,
     (SELECT COUNT(*)::int FROM ranking_duel_entries entry JOIN bars_botecos_desired_rankings desired ON desired.ranking_id = entry.ranking_id WHERE desired.kind = 'bar') AS entries,
     (SELECT COUNT(*)::int FROM ranking_duel_sessions session JOIN bars_botecos_desired_rankings desired ON desired.ranking_id = session.ranking_id WHERE desired.kind = 'bar') AS sessions`,
  `DO $$
   BEGIN
     IF (SELECT should_apply FROM bars_botecos_run_guard) THEN
       IF (SELECT COUNT(*) FROM bars_botecos_desired_rankings) <> 42 OR
          (SELECT COUNT(DISTINCT city) FROM bars_botecos_desired_rankings) <> 21 OR
          (SELECT COUNT(*) FROM bars_botecos_desired_rankings WHERE kind = 'bar') <> 21 OR
          (SELECT COUNT(*) FROM bars_botecos_desired_rankings WHERE kind = 'boteco') <> 21 OR
          (SELECT COUNT(*) FROM bars_botecos_desired_options) <> 840 OR
          EXISTS (
            SELECT 1 FROM bars_botecos_desired_rankings
            WHERE kind NOT IN ('bar', 'boteco') OR jsonb_array_length(options) <> 20
          ) THEN
         RAISE EXCEPTION 'A carga não corresponde a 21 cidades, 42 rankings e 840 opções.';
       END IF;

       IF (SELECT COUNT(*) FROM rankings ranking JOIN bars_botecos_desired_rankings desired ON desired.ranking_id = ranking.id WHERE desired.kind = 'bar') <> 21 OR
          EXISTS (
            SELECT 1
            FROM rankings ranking
            JOIN bars_botecos_desired_rankings desired ON desired.ranking_id = ranking.id
            WHERE desired.kind = 'bar' AND (ranking.is_vip OR ranking.category <> desired.city)
          ) OR
          EXISTS (
            SELECT 1
            FROM rankings ranking
            JOIN bars_botecos_desired_rankings desired ON desired.ranking_id = ranking.id
            WHERE desired.kind = 'boteco'
          ) THEN
         RAISE EXCEPTION 'Os rankings atuais não correspondem ao escopo seguro da divisão.';
       END IF;

       IF (SELECT COUNT(*) FROM ranking_options option JOIN bars_botecos_desired_rankings desired ON desired.ranking_id = option.ranking_id WHERE desired.kind = 'bar') <> 420 THEN
         RAISE EXCEPTION 'A divisão esperava exatamente 420 opções antigas de bares.';
       END IF;

       IF EXISTS (
         SELECT 1
         FROM ranking_options option
         JOIN bars_botecos_desired_rankings desired ON desired.ranking_id = option.ranking_id
         WHERE desired.kind = 'bar' AND (
           EXISTS (SELECT 1 FROM votes vote WHERE vote.option_id = option.id) OR
           EXISTS (SELECT 1 FROM user_double_votes vote WHERE vote.option_id = option.id) OR
           EXISTS (SELECT 1 FROM user_vote_history history WHERE history.option_id = option.id) OR
           EXISTS (SELECT 1 FROM ranking_top3_selections selection WHERE selection.option_id = option.id) OR
           EXISTS (SELECT 1 FROM ranking_comments comment WHERE comment.option_id = option.id)
         )
       ) THEN
         RAISE EXCEPTION 'Há votos, seleções ou comentários novos; a migração não removerá participação.';
       END IF;
     END IF;
   END $$`,
  `INSERT INTO option_relevance_review_archive (
     review_key, option_id, ranking_id, old_label, new_label, change_kind,
     previous_position, baseline_score, live_votes, double_votes, vote_history,
     duel_entries, top3_selections, comments, source_url
   )
   SELECT
     ${reviewKey},
     option.id,
     option.ranking_id,
     option.label,
     COALESCE(desired_option.label, '[movida ou removida na divisão]'),
     'replacement',
     option.position,
     option.baseline_score,
     0,
     0,
     0,
     (SELECT COUNT(*)::int FROM ranking_duel_entries entry WHERE entry.option_id = option.id),
     0,
     0,
     desired.source_url
   FROM ranking_options option
   JOIN bars_botecos_desired_rankings desired
     ON desired.ranking_id = option.ranking_id AND desired.kind = 'bar'
   LEFT JOIN bars_botecos_desired_options desired_option
     ON desired_option.ranking_id = option.ranking_id
    AND desired_option.position = option.position
   WHERE NOT EXISTS (
     SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
   )
   ON CONFLICT (review_key, option_id) DO NOTHING`,
  `DELETE FROM ranking_duel_rounds round
   USING bars_botecos_desired_rankings desired
   WHERE round.ranking_id = desired.ranking_id
     AND desired.kind = 'bar'
     AND NOT EXISTS (SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey})`,
  `DELETE FROM ranking_duel_sessions session
   USING bars_botecos_desired_rankings desired
   WHERE session.ranking_id = desired.ranking_id
     AND desired.kind = 'bar'
     AND NOT EXISTS (SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey})`,
  `DELETE FROM public_option_target_additions addition
   USING bars_botecos_desired_rankings desired
   WHERE addition.ranking_id = desired.ranking_id
     AND desired.kind = 'bar'
     AND NOT EXISTS (SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey})`,
  `DELETE FROM ranking_options option
   USING bars_botecos_desired_rankings desired
   WHERE option.ranking_id = desired.ranking_id
     AND desired.kind = 'bar'
     AND NOT EXISTS (SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey})`,
  `INSERT INTO rankings (
     id, category, question, image_url, baseline_votes, is_active, created_at
   )
   SELECT
     desired.ranking_id,
     desired.city,
     desired.question,
     ${imageUrl},
     0,
     true,
     now()
   FROM bars_botecos_desired_rankings desired
   WHERE NOT EXISTS (SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey})
   ON CONFLICT (id) DO UPDATE SET
     category = EXCLUDED.category,
     question = EXCLUDED.question,
     image_url = EXCLUDED.image_url,
     baseline_votes = 0,
     is_active = true,
     content_updated_at = now()`,
  `INSERT INTO ranking_options (ranking_id, label, position, baseline_score)
   SELECT desired.ranking_id, desired.label, desired.position, 0
   FROM bars_botecos_desired_options desired
   WHERE NOT EXISTS (SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey})
   ORDER BY desired.ranking_id, desired.position`,
  `INSERT INTO option_relevance_review_state (review_key, summary)
   SELECT
     ${reviewKey},
     jsonb_build_object(
       'cities', 21,
       'rankings', 42,
       'options', 840,
       'bars_refreshed', 21,
       'botecos_created', 21,
       'cleared_duel_rounds', duel.rounds,
       'cleared_duel_entries', duel.entries,
       'cleared_duel_sessions', duel.sessions,
       'preserved_score_events', score.event_count,
       'preserved_score_points', score.point_count
     )
   FROM bars_botecos_duel_guard duel
   CROSS JOIN bars_botecos_score_guard score
   WHERE NOT EXISTS (SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey})
   ON CONFLICT (review_key) DO NOTHING`,
  `DO $$
   DECLARE
     score_after record;
   BEGIN
     IF (SELECT COUNT(*) FROM rankings ranking JOIN bars_botecos_desired_rankings desired ON desired.ranking_id = ranking.id WHERE ranking.is_active AND ranking.is_vip = false AND ranking.category = desired.city AND ranking.question = desired.question AND ranking.baseline_votes = 0) <> 42 OR
        (SELECT COUNT(*) FROM ranking_options option JOIN bars_botecos_desired_rankings desired ON desired.ranking_id = option.ranking_id) <> 840 OR
        EXISTS (
          SELECT 1
          FROM bars_botecos_desired_options desired
          LEFT JOIN ranking_options option
            ON option.ranking_id = desired.ranking_id
           AND option.position = desired.position
           AND option.label = desired.label
           AND option.baseline_score = 0
          WHERE option.id IS NULL
        ) THEN
       RAISE EXCEPTION 'A divisão final ficou incompleta, fora de ordem ou com metadados incorretos.';
     END IF;

     IF (SELECT should_apply FROM bars_botecos_run_guard) AND (
       EXISTS (
         SELECT 1 FROM ranking_duel_rounds round JOIN bars_botecos_desired_rankings desired ON desired.ranking_id = round.ranking_id
       ) OR EXISTS (
         SELECT 1 FROM ranking_duel_entries entry JOIN bars_botecos_desired_rankings desired ON desired.ranking_id = entry.ranking_id
       ) OR EXISTS (
         SELECT 1 FROM ranking_duel_sessions session JOIN bars_botecos_desired_rankings desired ON desired.ranking_id = session.ranking_id
       )
     ) THEN
       RAISE EXCEPTION 'Ainda existem duelos associados às opções substituídas.';
     END IF;

     SELECT
       COUNT(event.id)::integer AS event_count,
       COALESCE(SUM(event.points), 0)::integer AS point_count,
       md5(COALESCE(string_agg(
         concat_ws('|', event.id, event.user_id, event.event_type, event.event_key, event.ranking_id, event.points, event.created_at),
         E'\\n' ORDER BY event.id
       ), '')) AS signature
     INTO score_after
     FROM user_score_events event
     JOIN bars_botecos_desired_rankings desired ON desired.ranking_id = event.ranking_id;

     IF EXISTS (
       SELECT 1
       FROM bars_botecos_score_guard before
       WHERE before.event_count IS DISTINCT FROM score_after.event_count
          OR before.point_count IS DISTINCT FROM score_after.point_count
          OR before.signature IS DISTINCT FROM score_after.signature
     ) THEN
       RAISE EXCEPTION 'A proteção da pontuação das pessoas detectou uma alteração.';
     END IF;
   END $$`,
];

const validationSql = `WITH ${desiredRankingsCte},
desired_options AS (
  SELECT ranking.ranking_id, option.ordinality::integer AS position, option.label
  FROM desired_rankings ranking
  CROSS JOIN LATERAL jsonb_array_elements_text(ranking.options)
    WITH ORDINALITY AS option(label, ordinality)
), ${targetOptionsCte}
SELECT
  (SELECT COUNT(*)::int FROM rankings ranking JOIN desired_rankings desired ON desired.ranking_id = ranking.id WHERE ranking.is_active AND ranking.is_vip = false AND ranking.category = desired.city AND ranking.question = desired.question AND ranking.baseline_votes = 0) AS valid_rankings,
  (SELECT COUNT(*)::int FROM target_options) AS option_count,
  (SELECT COUNT(*)::int FROM desired_options desired LEFT JOIN ranking_options option ON option.ranking_id = desired.ranking_id AND option.position = desired.position AND option.label = desired.label AND option.baseline_score = 0 WHERE option.id IS NULL) AS option_mismatches,
  (SELECT COUNT(*)::int FROM votes vote JOIN target_options option ON option.id = vote.option_id) AS direct_votes,
  (SELECT COUNT(*)::int FROM user_double_votes vote JOIN target_options option ON option.id = vote.option_id) AS double_votes,
  (SELECT COUNT(*)::int FROM user_vote_history history JOIN target_options option ON option.id = history.option_id) AS vote_history,
  (SELECT COUNT(*)::int FROM ranking_top3_selections selection JOIN desired_rankings desired ON desired.ranking_id = selection.ranking_id) AS top3_selections,
  (SELECT COUNT(*)::int FROM ranking_duel_rounds round JOIN desired_rankings desired ON desired.ranking_id = round.ranking_id) AS duel_rounds,
  (SELECT COUNT(*)::int FROM ranking_duel_entries entry JOIN desired_rankings desired ON desired.ranking_id = entry.ranking_id) AS duel_entries,
  (SELECT COUNT(*)::int FROM ranking_duel_sessions session JOIN desired_rankings desired ON desired.ranking_id = session.ranking_id) AS duel_sessions,
  (SELECT COUNT(*)::int FROM ranking_comments comment JOIN desired_rankings desired ON desired.ranking_id = comment.ranking_id) AS comments,
  (SELECT COUNT(*)::int FROM user_score_events event JOIN desired_rankings desired ON desired.ranking_id = event.ranking_id) AS preserved_score_events,
  (SELECT COALESCE(SUM(event.points), 0)::int FROM user_score_events event JOIN desired_rankings desired ON desired.ranking_id = event.ranking_id) AS preserved_score_points,
  (SELECT summary FROM option_relevance_review_state WHERE review_key = ${reviewKey}) AS summary;`;

async function writeOutputAndExit(output) {
  await new Promise((resolve) => process.stdout.write(output, resolve));
  process.exit(0);
}

if (preflightOutputMode) await writeOutputAndExit(preflightSql);
if (validationOutputMode) await writeOutputAndExit(validationSql);
if (sqlOutputMode) {
  await writeOutputAndExit(JSON.stringify([...setupStatements, ...migrationStatements]));
}

const sql = neon(process.env.DATABASE_URL);
await sql.transaction(
  [...setupStatements, ...migrationStatements].map((statement) => sql.query(statement)),
  { isolationLevel: 'Serializable' },
);

const [validation] = await sql.query(validationSql);
if (
  Number(validation?.valid_rankings) !== 42 ||
  Number(validation?.option_count) !== 840 ||
  Number(validation?.option_mismatches) !== 0 ||
  !validation?.summary
) {
  throw new Error(`Bars and botecos validation failed: ${JSON.stringify(validation)}`);
}

console.log(
  `Bares e botecos atualizados: ${validation.valid_rankings} rankings, ${validation.option_count} opções e pontuação pessoal preservada.`,
);
