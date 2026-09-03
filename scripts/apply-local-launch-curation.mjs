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
  readFile(new URL('../data/local-launch-curation-2026-09.json', import.meta.url), 'utf8').then(
    JSON.parse,
  ),
  readFile(new URL('../migrations/20260901_option_relevance_review.sql', import.meta.url), 'utf8'),
]);

function fold(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const rankingIds = review.rankings.map((ranking) => ranking.rankingId);
const cityNames = [...new Set(review.rankings.map((ranking) => ranking.city))];
const optionCount = review.rankings.reduce((total, ranking) => total + ranking.options.length, 0);

if (
  review.reviewKey !== 'local-launch-curation-2026-09-v2' ||
  review.scope?.excludedCity !== 'Florianópolis' ||
  review.scope?.cityCount !== 20 ||
  review.scope?.rankingCount !== 320 ||
  review.scope?.resetParticipation !== true ||
  review.rankings.length !== 320 ||
  new Set(rankingIds).size !== 320 ||
  cityNames.length !== 20 ||
  cityNames.includes('Florianópolis') ||
  review.rankings.some(
    (ranking) =>
      !ranking.rankingId ||
      !ranking.question ||
      !Array.isArray(ranking.options) ||
      ranking.options.length < 5 ||
      ranking.options.length > 20 ||
      new Set(ranking.options.map(fold)).size !== ranking.options.length ||
      ranking.options.some((label) => !label || label !== label.trim()),
  )
) {
  throw new Error('Invalid local launch curation data');
}

for (const city of cityNames) {
  if (review.rankings.filter((ranking) => ranking.city === city).length !== 16) {
    throw new Error(`Invalid local launch matrix for ${city}`);
  }
}

const desiredPayload = JSON.stringify(
  review.rankings.map((ranking) => ({
    ranking_id: ranking.rankingId,
    city: ranking.city,
    question: ranking.question,
    options: ranking.options,
  })),
);

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const payload = `${quote(desiredPayload)}::jsonb`;
const reviewKey = quote(review.reviewKey);
const expectedOptionCount = optionCount;

const desiredRankingsCte = `desired_rankings AS (
  SELECT ranking_id, city, question, options
  FROM jsonb_to_recordset(${payload}) AS incoming(
    ranking_id text,
    city text,
    question text,
    options jsonb
  )
)`;

const preflightSql = `WITH ${desiredRankingsCte},
target_options AS (
  SELECT option.id, option.ranking_id
  FROM ranking_options option
  JOIN desired_rankings desired ON desired.ranking_id = option.ranking_id
)
SELECT
  (SELECT COUNT(*)::int FROM desired_rankings) AS desired_rankings,
  (SELECT COUNT(DISTINCT city)::int FROM desired_rankings) AS desired_cities,
  (SELECT SUM(jsonb_array_length(options))::int FROM desired_rankings) AS desired_options,
  (SELECT COUNT(*)::int FROM rankings ranking JOIN desired_rankings desired ON desired.ranking_id = ranking.id) AS matched_rankings,
  (SELECT COUNT(*)::int FROM rankings ranking JOIN desired_rankings desired ON desired.ranking_id = ranking.id WHERE ranking.is_vip) AS vip_rankings,
  (SELECT COUNT(*)::int FROM rankings ranking JOIN desired_rankings desired ON desired.ranking_id = ranking.id WHERE ranking.category = 'Florianópolis') AS floripa_matches,
  (SELECT COUNT(*)::int FROM target_options) AS current_options,
  (SELECT COUNT(*)::int FROM votes vote JOIN target_options option ON option.id = vote.option_id) AS direct_votes,
  (SELECT COUNT(*)::int FROM user_double_votes vote JOIN target_options option ON option.id = vote.option_id) AS double_votes,
  (SELECT COUNT(*)::int FROM user_vote_history history JOIN target_options option ON option.id = history.option_id) AS vote_history,
  (SELECT COUNT(*)::int FROM ranking_top3_selections selection JOIN desired_rankings desired ON desired.ranking_id = selection.ranking_id) AS top3_selections,
  (SELECT COUNT(*)::int FROM ranking_duel_rounds round JOIN desired_rankings desired ON desired.ranking_id = round.ranking_id) AS duel_rounds,
  (SELECT COUNT(*)::int FROM ranking_duel_entries entry JOIN desired_rankings desired ON desired.ranking_id = entry.ranking_id) AS duel_entries,
  (SELECT COUNT(*)::int FROM ranking_duel_sessions session JOIN desired_rankings desired ON desired.ranking_id = session.ranking_id) AS duel_sessions,
  (SELECT COUNT(*)::int FROM ranking_comments comment JOIN desired_rankings desired ON desired.ranking_id = comment.ranking_id) AS comments,
  (SELECT COUNT(*)::int FROM option_relevance_review_state WHERE review_key = ${reviewKey}) AS already_applied;`;

const setupStatements = splitSqlStatements(archiveMigration);
const refreshStatements = [
  `CREATE TEMP TABLE local_launch_desired_rankings ON COMMIT DROP AS
   SELECT
     ranking_id,
     city,
     question,
     options,
     jsonb_array_length(options)::integer AS expected_options
   FROM jsonb_to_recordset(${payload}) AS incoming(
     ranking_id text,
     city text,
     question text,
     options jsonb
   )`,
  `CREATE UNIQUE INDEX local_launch_desired_rankings_id_idx
   ON local_launch_desired_rankings (ranking_id)`,
  `CREATE TEMP TABLE local_launch_desired_options ON COMMIT DROP AS
   SELECT
     ranking.ranking_id,
     option.ordinality::integer AS position,
     option.label
   FROM local_launch_desired_rankings ranking
   CROSS JOIN LATERAL jsonb_array_elements_text(ranking.options)
     WITH ORDINALITY AS option(label, ordinality)`,
  `CREATE UNIQUE INDEX local_launch_desired_options_position_idx
   ON local_launch_desired_options (ranking_id, position)`,
  `CREATE UNIQUE INDEX local_launch_desired_options_label_idx
   ON local_launch_desired_options (ranking_id, lower(btrim(label)))`,
  `CREATE TEMP TABLE local_launch_floripa_guard ON COMMIT DROP AS
   SELECT jsonb_build_object(
     'rankings', (SELECT COUNT(*)::int FROM rankings WHERE category = 'Florianópolis'),
     'options', (
       SELECT COUNT(*)::int
       FROM ranking_options option
       JOIN rankings ranking ON ranking.id = option.ranking_id
       WHERE ranking.category = 'Florianópolis'
     ),
     'direct_votes', (
       SELECT COUNT(*)::int
       FROM votes vote
       JOIN ranking_options option ON option.id = vote.option_id
       JOIN rankings ranking ON ranking.id = option.ranking_id
       WHERE ranking.category = 'Florianópolis'
     ),
     'double_votes', (
       SELECT COUNT(*)::int
       FROM user_double_votes vote
       JOIN ranking_options option ON option.id = vote.option_id
       JOIN rankings ranking ON ranking.id = option.ranking_id
       WHERE ranking.category = 'Florianópolis'
     ),
     'vote_history', (
       SELECT COUNT(*)::int
       FROM user_vote_history history
       JOIN ranking_options option ON option.id = history.option_id
       JOIN rankings ranking ON ranking.id = option.ranking_id
       WHERE ranking.category = 'Florianópolis'
     ),
     'top3', (SELECT COUNT(*)::int FROM ranking_top3_selections selection JOIN rankings ranking ON ranking.id = selection.ranking_id WHERE ranking.category = 'Florianópolis'),
     'duel_rounds', (SELECT COUNT(*)::int FROM ranking_duel_rounds round JOIN rankings ranking ON ranking.id = round.ranking_id WHERE ranking.category = 'Florianópolis'),
     'duel_entries', (SELECT COUNT(*)::int FROM ranking_duel_entries entry JOIN rankings ranking ON ranking.id = entry.ranking_id WHERE ranking.category = 'Florianópolis'),
     'duel_sessions', (SELECT COUNT(*)::int FROM ranking_duel_sessions session JOIN rankings ranking ON ranking.id = session.ranking_id WHERE ranking.category = 'Florianópolis'),
     'comments', (SELECT COUNT(*)::int FROM ranking_comments comment JOIN rankings ranking ON ranking.id = comment.ranking_id WHERE ranking.category = 'Florianópolis'),
     'signature', (
       SELECT md5(COALESCE(string_agg(
         concat_ws('|', ranking.id, ranking.question, ranking.baseline_votes, option.id, option.label, option.position, option.baseline_score),
         E'\\n' ORDER BY ranking.id, option.position, option.id
       ), ''))
       FROM rankings ranking
       LEFT JOIN ranking_options option ON option.ranking_id = ranking.id
       WHERE ranking.category = 'Florianópolis'
     )
   ) AS snapshot`,
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
     ) THEN
       IF (SELECT COUNT(*) FROM local_launch_desired_rankings) <> 320 OR
          (SELECT COUNT(DISTINCT city) FROM local_launch_desired_rankings) <> 20 OR
          (SELECT COUNT(*) FROM local_launch_desired_options) <> ${expectedOptionCount} THEN
         RAISE EXCEPTION 'A carga local não corresponde ao escopo aprovado de 20 cidades e 320 rankings.';
       END IF;

       IF EXISTS (
         SELECT 1 FROM local_launch_desired_rankings
         WHERE city = 'Florianópolis' OR expected_options NOT BETWEEN 5 AND 20
       ) THEN
         RAISE EXCEPTION 'A carga inclui Florianópolis ou uma quantidade inválida de opções.';
       END IF;

       IF (SELECT COUNT(*) FROM rankings ranking JOIN local_launch_desired_rankings desired ON desired.ranking_id = ranking.id) <> 320 OR
          EXISTS (
            SELECT 1
            FROM rankings ranking
            JOIN local_launch_desired_rankings desired ON desired.ranking_id = ranking.id
            WHERE ranking.is_vip OR ranking.category = 'Florianópolis' OR ranking.category <> desired.city
          ) THEN
         RAISE EXCEPTION 'Os rankings de produção não correspondem ao escopo local revisado.';
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
     COALESCE(desired.label, '[removida da seleção]'),
     'replacement',
     option.position,
     option.baseline_score,
     (SELECT COUNT(*)::int FROM votes vote WHERE vote.option_id = option.id),
     (SELECT COUNT(*)::int FROM user_double_votes vote WHERE vote.option_id = option.id),
     (SELECT COUNT(*)::int FROM user_vote_history history WHERE history.option_id = option.id),
     (SELECT COUNT(*)::int FROM ranking_duel_entries entry WHERE entry.option_id = option.id),
     (SELECT COUNT(*)::int FROM ranking_top3_selections selection WHERE selection.option_id = option.id),
     (SELECT COUNT(*)::int FROM ranking_comments comment WHERE comment.option_id = option.id),
     NULL
   FROM ranking_options option
   JOIN local_launch_desired_rankings ranking ON ranking.ranking_id = option.ranking_id
   LEFT JOIN local_launch_desired_options desired
     ON desired.ranking_id = option.ranking_id
    AND desired.position = option.position
   WHERE NOT EXISTS (
     SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
   )
   ON CONFLICT (review_key, option_id) DO NOTHING`,
  `DELETE FROM ranking_duel_rounds round
   USING local_launch_desired_rankings desired
   WHERE round.ranking_id = desired.ranking_id
     AND NOT EXISTS (SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey})`,
  `DELETE FROM ranking_duel_sessions session
   USING local_launch_desired_rankings desired
   WHERE session.ranking_id = desired.ranking_id
     AND NOT EXISTS (SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey})`,
  `DELETE FROM ranking_comments comment
   USING local_launch_desired_rankings desired
   WHERE comment.ranking_id = desired.ranking_id
     AND NOT EXISTS (SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey})`,
  `DELETE FROM ranking_top3_selections selection
   USING local_launch_desired_rankings desired
   WHERE selection.ranking_id = desired.ranking_id
     AND NOT EXISTS (SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey})`,
  `DELETE FROM user_double_votes vote
   USING ranking_options option, local_launch_desired_rankings desired
   WHERE option.ranking_id = desired.ranking_id
     AND vote.option_id = option.id
     AND NOT EXISTS (SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey})`,
  `DELETE FROM user_vote_history history
   USING ranking_options option, local_launch_desired_rankings desired
   WHERE option.ranking_id = desired.ranking_id
     AND history.option_id = option.id
     AND NOT EXISTS (SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey})`,
  `DELETE FROM votes vote
   USING ranking_options option, local_launch_desired_rankings desired
   WHERE option.ranking_id = desired.ranking_id
     AND vote.option_id = option.id
     AND NOT EXISTS (SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey})`,
  `DELETE FROM public_option_target_additions addition
   USING local_launch_desired_rankings desired
   WHERE addition.ranking_id = desired.ranking_id
     AND NOT EXISTS (SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey})`,
  `DELETE FROM ranking_options option
   USING local_launch_desired_rankings desired
   WHERE option.ranking_id = desired.ranking_id
     AND NOT EXISTS (SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey})`,
  `INSERT INTO ranking_options (ranking_id, label, position, baseline_score)
   SELECT desired.ranking_id, desired.label, desired.position, 0
   FROM local_launch_desired_options desired
   WHERE NOT EXISTS (SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey})
   ORDER BY desired.ranking_id, desired.position`,
  `UPDATE rankings ranking
   SET question = desired.question,
       baseline_votes = 0,
       is_active = true,
       content_updated_at = now()
   FROM local_launch_desired_rankings desired
   WHERE ranking.id = desired.ranking_id
     AND NOT EXISTS (SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey})`,
  `INSERT INTO option_relevance_review_state (review_key, summary)
   SELECT
     ${reviewKey},
     jsonb_build_object(
       'cities', 20,
       'rankings', 320,
       'new_options', ${expectedOptionCount},
       'removed_direct_votes', COALESCE(SUM(archive.live_votes), 0),
       'removed_double_votes', COALESCE(SUM(archive.double_votes), 0),
       'removed_vote_history', COALESCE(SUM(archive.vote_history), 0),
       'removed_duel_entries', COALESCE(SUM(archive.duel_entries), 0),
       'removed_top3_selections', COALESCE(SUM(archive.top3_selections), 0),
       'removed_comments', COALESCE(SUM(archive.comments), 0),
       'excluded_city', 'Florianópolis'
     )
   FROM option_relevance_review_archive archive
   WHERE archive.review_key = ${reviewKey}
   ON CONFLICT (review_key) DO NOTHING`,
  `DO $$
   DECLARE
     floripa_after jsonb;
   BEGIN
     IF (SELECT COUNT(*) FROM ranking_options option JOIN local_launch_desired_rankings desired ON desired.ranking_id = option.ranking_id) <> ${expectedOptionCount} OR
        EXISTS (
          SELECT 1
          FROM local_launch_desired_options desired
          LEFT JOIN ranking_options option
            ON option.ranking_id = desired.ranking_id
           AND option.position = desired.position
           AND option.label = desired.label
           AND option.baseline_score = 0
          WHERE option.id IS NULL
        ) OR
        EXISTS (
          SELECT 1
          FROM rankings ranking
          JOIN local_launch_desired_rankings desired ON desired.ranking_id = ranking.id
          WHERE ranking.baseline_votes <> 0 OR ranking.is_active = false OR ranking.question <> desired.question
        ) THEN
       RAISE EXCEPTION 'A lista local final ficou incompleta, fora de ordem ou com metadados incorretos.';
     END IF;

     IF EXISTS (
       SELECT 1 FROM votes vote JOIN ranking_options option ON option.id = vote.option_id JOIN local_launch_desired_rankings desired ON desired.ranking_id = option.ranking_id
     ) OR EXISTS (
       SELECT 1 FROM user_double_votes vote JOIN ranking_options option ON option.id = vote.option_id JOIN local_launch_desired_rankings desired ON desired.ranking_id = option.ranking_id
     ) OR EXISTS (
       SELECT 1 FROM user_vote_history history JOIN ranking_options option ON option.id = history.option_id JOIN local_launch_desired_rankings desired ON desired.ranking_id = option.ranking_id
     ) OR EXISTS (
       SELECT 1 FROM ranking_top3_selections selection JOIN local_launch_desired_rankings desired ON desired.ranking_id = selection.ranking_id
     ) OR EXISTS (
       SELECT 1 FROM ranking_duel_rounds round JOIN local_launch_desired_rankings desired ON desired.ranking_id = round.ranking_id
     ) OR EXISTS (
       SELECT 1 FROM ranking_duel_entries entry JOIN local_launch_desired_rankings desired ON desired.ranking_id = entry.ranking_id
     ) OR EXISTS (
       SELECT 1 FROM ranking_duel_sessions session JOIN local_launch_desired_rankings desired ON desired.ranking_id = session.ranking_id
     ) OR EXISTS (
       SELECT 1 FROM ranking_comments comment JOIN local_launch_desired_rankings desired ON desired.ranking_id = comment.ranking_id
     ) THEN
       RAISE EXCEPTION 'Ainda existe participação antiga nos rankings locais renovados.';
     END IF;

     SELECT jsonb_build_object(
       'rankings', (SELECT COUNT(*)::int FROM rankings WHERE category = 'Florianópolis'),
       'options', (SELECT COUNT(*)::int FROM ranking_options option JOIN rankings ranking ON ranking.id = option.ranking_id WHERE ranking.category = 'Florianópolis'),
       'direct_votes', (SELECT COUNT(*)::int FROM votes vote JOIN ranking_options option ON option.id = vote.option_id JOIN rankings ranking ON ranking.id = option.ranking_id WHERE ranking.category = 'Florianópolis'),
       'double_votes', (SELECT COUNT(*)::int FROM user_double_votes vote JOIN ranking_options option ON option.id = vote.option_id JOIN rankings ranking ON ranking.id = option.ranking_id WHERE ranking.category = 'Florianópolis'),
       'vote_history', (SELECT COUNT(*)::int FROM user_vote_history history JOIN ranking_options option ON option.id = history.option_id JOIN rankings ranking ON ranking.id = option.ranking_id WHERE ranking.category = 'Florianópolis'),
       'top3', (SELECT COUNT(*)::int FROM ranking_top3_selections selection JOIN rankings ranking ON ranking.id = selection.ranking_id WHERE ranking.category = 'Florianópolis'),
       'duel_rounds', (SELECT COUNT(*)::int FROM ranking_duel_rounds round JOIN rankings ranking ON ranking.id = round.ranking_id WHERE ranking.category = 'Florianópolis'),
       'duel_entries', (SELECT COUNT(*)::int FROM ranking_duel_entries entry JOIN rankings ranking ON ranking.id = entry.ranking_id WHERE ranking.category = 'Florianópolis'),
       'duel_sessions', (SELECT COUNT(*)::int FROM ranking_duel_sessions session JOIN rankings ranking ON ranking.id = session.ranking_id WHERE ranking.category = 'Florianópolis'),
       'comments', (SELECT COUNT(*)::int FROM ranking_comments comment JOIN rankings ranking ON ranking.id = comment.ranking_id WHERE ranking.category = 'Florianópolis'),
       'signature', (
         SELECT md5(COALESCE(string_agg(
           concat_ws('|', ranking.id, ranking.question, ranking.baseline_votes, option.id, option.label, option.position, option.baseline_score),
           E'\\n' ORDER BY ranking.id, option.position, option.id
         ), ''))
         FROM rankings ranking
         LEFT JOIN ranking_options option ON option.ranking_id = ranking.id
         WHERE ranking.category = 'Florianópolis'
       )
     ) INTO floripa_after;

     IF floripa_after IS DISTINCT FROM (SELECT snapshot FROM local_launch_floripa_guard) THEN
       RAISE EXCEPTION 'A proteção de Florianópolis detectou uma alteração e cancelou a transação.';
     END IF;
   END $$`,
];

const validationSql = `WITH ${desiredRankingsCte},
desired_options AS (
  SELECT ranking.ranking_id, option.ordinality::integer AS position, option.label
  FROM desired_rankings ranking
  CROSS JOIN LATERAL jsonb_array_elements_text(ranking.options)
    WITH ORDINALITY AS option(label, ordinality)
),
target_options AS (
  SELECT option.id, option.ranking_id
  FROM ranking_options option
  JOIN desired_rankings desired ON desired.ranking_id = option.ranking_id
)
SELECT
  (SELECT COUNT(*)::int FROM rankings ranking JOIN desired_rankings desired ON desired.ranking_id = ranking.id WHERE ranking.is_active AND ranking.baseline_votes = 0 AND ranking.question = desired.question) AS valid_rankings,
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
  (SELECT summary FROM option_relevance_review_state WHERE review_key = ${reviewKey}) AS summary;`;

async function writeOutputAndExit(output) {
  await new Promise((resolve) => process.stdout.write(output, resolve));
  process.exit(0);
}

if (preflightOutputMode) await writeOutputAndExit(preflightSql);
if (validationOutputMode) await writeOutputAndExit(validationSql);
if (sqlOutputMode) {
  await writeOutputAndExit(JSON.stringify([...setupStatements, ...refreshStatements]));
}

const sql = neon(process.env.DATABASE_URL);
await sql.transaction(
  [...setupStatements, ...refreshStatements].map((statement) => sql.query(statement)),
  { isolationLevel: 'Serializable' },
);

const [validation] = await sql.query(validationSql);
if (
  Number(validation?.valid_rankings) !== 320 ||
  Number(validation?.option_count) !== expectedOptionCount ||
  Number(validation?.option_mismatches) !== 0 ||
  [
    'direct_votes',
    'double_votes',
    'vote_history',
    'top3_selections',
    'duel_rounds',
    'duel_entries',
    'duel_sessions',
    'comments',
  ].some((key) => Number(validation?.[key]) !== 0) ||
  !validation?.summary
) {
  throw new Error(`Local launch validation failed: ${JSON.stringify(validation)}`);
}

console.log(
  `Rankings locais atualizados: ${validation.valid_rankings} rankings, ${validation.option_count} opções e participação zerada fora de Florianópolis.`,
);
