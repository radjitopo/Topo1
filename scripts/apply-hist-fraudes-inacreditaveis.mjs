import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

const sqlOutputMode = process.argv.includes('--sql');
const definition = JSON.parse(
  await readFile(new URL('../data/hist-fraudes-inacreditaveis.json', import.meta.url), 'utf8'),
);

const rankingId = String(definition.rankingId || '').trim();
const question = String(definition.question || '').trim();
const previousQuestion = String(definition.previousQuestion || '').trim();
const options = Array.isArray(definition.options)
  ? definition.options.map((label) => String(label || '').trim())
  : [];
const previousOptions = Array.isArray(definition.previousOptions)
  ? definition.previousOptions.map((label) => String(label || '').trim())
  : [];

if (
  !/^[a-z0-9][a-z0-9-]{0,99}$/.test(rankingId) ||
  question.length < 8 ||
  question.length > 160 ||
  previousQuestion.length < 8 ||
  previousQuestion.length > 160 ||
  options.length !== 14 ||
  new Set(options).size !== options.length ||
  options.some((label) => label.length < 2 || label.length > 80) ||
  previousOptions.length !== 14 ||
  new Set(previousOptions).size !== previousOptions.length ||
  previousOptions.some((label) => label.length < 2 || label.length > 80)
) {
  throw new Error('Invalid fraud ranking definition');
}

const quoteLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`;
const desired = options.map((label, index) => ({ label, position: index + 1 }));
const previous = previousOptions.map((label, index) => ({ label, position: index + 1 }));
const desiredJson = quoteLiteral(JSON.stringify(desired));
const previousJson = quoteLiteral(JSON.stringify(previous));
const rankingLiteral = quoteLiteral(rankingId);
const questionLiteral = quoteLiteral(question);
const previousQuestionLiteral = quoteLiteral(previousQuestion);

const statements = [
  `CREATE TEMP TABLE hist_fraudes_desired ON COMMIT DROP AS
   SELECT *
   FROM jsonb_to_recordset(${desiredJson}::jsonb)
     AS desired(label text, position integer)`,
  `CREATE TEMP TABLE hist_fraudes_previous ON COMMIT DROP AS
   SELECT *
   FROM jsonb_to_recordset(${previousJson}::jsonb)
     AS previous(label text, position integer)`,
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1
       FROM rankings
       WHERE id = ${rankingLiteral}
         AND is_active = true
         AND is_vip = false
     ) THEN
       RAISE EXCEPTION 'O ranking público de golpes não foi encontrado.';
     END IF;

     IF (SELECT COUNT(*) FROM hist_fraudes_desired) <> 14
        OR (SELECT COUNT(DISTINCT label) FROM hist_fraudes_desired) <> 14
        OR (SELECT COUNT(DISTINCT position) FROM hist_fraudes_desired) <> 14
        OR EXISTS (
          SELECT 1
          FROM hist_fraudes_desired
          WHERE position NOT BETWEEN 1 AND 14
        ) THEN
       RAISE EXCEPTION 'A nova lista de golpes precisa ter 14 opções únicas.';
     END IF;

     IF NOT EXISTS (
       SELECT 1
       FROM rankings ranking
       WHERE ranking.id = ${rankingLiteral}
         AND (
           (
             ranking.question = ${questionLiteral}
             AND NOT EXISTS (
               SELECT option.label, option.position, option.baseline_score
               FROM ranking_options option
               WHERE option.ranking_id = ranking.id
               EXCEPT
               SELECT desired.label, desired.position, 0
               FROM hist_fraudes_desired desired
             )
             AND NOT EXISTS (
               SELECT desired.label, desired.position, 0
               FROM hist_fraudes_desired desired
               EXCEPT
               SELECT option.label, option.position, option.baseline_score
               FROM ranking_options option
               WHERE option.ranking_id = ranking.id
             )
           )
           OR
           (
             ranking.question = ${previousQuestionLiteral}
             AND NOT EXISTS (
               SELECT option.label, option.position, option.baseline_score
               FROM ranking_options option
               WHERE option.ranking_id = ranking.id
               EXCEPT
               SELECT previous.label, previous.position, 0
               FROM hist_fraudes_previous previous
             )
             AND NOT EXISTS (
               SELECT previous.label, previous.position, 0
               FROM hist_fraudes_previous previous
               EXCEPT
               SELECT option.label, option.position, option.baseline_score
               FROM ranking_options option
               WHERE option.ranking_id = ranking.id
             )
           )
         )
     ) THEN
       RAISE EXCEPTION 'O ranking de golpes mudou desde a revisão; atualização interrompida.';
     END IF;
   END $$`,
  `CREATE TEMP TABLE hist_fraudes_refresh_needed ON COMMIT DROP AS
   SELECT
     ranking.question IS DISTINCT FROM ${questionLiteral}
     OR EXISTS (
       SELECT option.label, option.position, option.baseline_score
       FROM ranking_options option
       WHERE option.ranking_id = ranking.id
       EXCEPT
       SELECT desired.label, desired.position, 0
       FROM hist_fraudes_desired desired
     )
     OR EXISTS (
       SELECT desired.label, desired.position, 0
       FROM hist_fraudes_desired desired
       EXCEPT
       SELECT option.label, option.position, option.baseline_score
       FROM ranking_options option
       WHERE option.ranking_id = ranking.id
     ) AS value
   FROM rankings ranking
   WHERE ranking.id = ${rankingLiteral}`,
  `DELETE FROM ranking_duel_rounds
   WHERE ranking_id = ${rankingLiteral}
     AND (SELECT value FROM hist_fraudes_refresh_needed)`,
  `DELETE FROM ranking_duel_sessions
   WHERE ranking_id = ${rankingLiteral}
     AND (SELECT value FROM hist_fraudes_refresh_needed)`,
  `DELETE FROM ranking_options
   WHERE ranking_id = ${rankingLiteral}
     AND (SELECT value FROM hist_fraudes_refresh_needed)`,
  `INSERT INTO ranking_options (
     ranking_id, label, position, baseline_score, vip_added_later
   )
   SELECT
     ${rankingLiteral}, desired.label, desired.position, 0, false
   FROM hist_fraudes_desired desired
   WHERE (SELECT value FROM hist_fraudes_refresh_needed)
   ORDER BY desired.position`,
  `UPDATE rankings
   SET question = ${questionLiteral},
       baseline_votes = 0,
       content_updated_at = now()
   WHERE id = ${rankingLiteral}
     AND (SELECT value FROM hist_fraudes_refresh_needed)`,
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1
       FROM rankings
       WHERE id = ${rankingLiteral}
         AND question = ${questionLiteral}
         AND is_active = true
         AND is_vip = false
     ) OR EXISTS (
       SELECT option.label, option.position, option.baseline_score
       FROM ranking_options option
       WHERE option.ranking_id = ${rankingLiteral}
       EXCEPT
       SELECT desired.label, desired.position, 0
       FROM hist_fraudes_desired desired
     ) OR EXISTS (
       SELECT desired.label, desired.position, 0
       FROM hist_fraudes_desired desired
       EXCEPT
       SELECT option.label, option.position, option.baseline_score
       FROM ranking_options option
       WHERE option.ranking_id = ${rankingLiteral}
     ) THEN
       RAISE EXCEPTION 'A atualização do ranking de golpes ficou incompleta.';
     END IF;
   END $$`,
];

if (sqlOutputMode) {
  console.log(`${statements.join(';\n\n')};`);
} else {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const sql = neon(process.env.DATABASE_URL);
  await sql.transaction(
    statements.map((statement) => sql.query(statement)),
    { isolationLevel: 'Serializable' },
  );
  console.log(`Ranking atualizado: ${rankingId} (${options.length} opções).`);
}
