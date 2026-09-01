import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements.mjs';

const sqlOutputMode = process.argv.includes('--sql');

if (!sqlOutputMode && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const [review, archiveMigration] = await Promise.all([
  readFile(new URL('../data/cafes-floripa-refresh.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../migrations/20260901_option_relevance_review.sql', import.meta.url), 'utf8'),
]);

if (
  !review.reviewKey ||
  review.rankingId !== 'cafes-floripa' ||
  !review.question ||
  review.options.length !== 20 ||
  new Set(review.options).size !== 20 ||
  review.options.some((label) => !label || label.trim() !== label)
) {
  throw new Error('Invalid cafés de Florianópolis refresh data');
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const desiredValues = review.options
  .map((label, index) => `(${index + 1}, ${quote(label)})`)
  .join(',\n');
const rankingId = quote(review.rankingId);
const reviewKey = quote(review.reviewKey);
const question = quote(review.question);

const setupStatements = splitSqlStatements(archiveMigration);
const refreshStatements = [
  `CREATE TEMP TABLE cafes_floripa_desired (
     position integer PRIMARY KEY,
     label text NOT NULL UNIQUE
   ) ON COMMIT DROP`,
  `INSERT INTO cafes_floripa_desired (position, label) VALUES\n${desiredValues}`,
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
     ) THEN
       IF NOT EXISTS (
         SELECT 1 FROM rankings
         WHERE id = ${rankingId} AND is_active = true AND is_vip = false
       ) THEN
         RAISE EXCEPTION 'O ranking público cafes-floripa não está ativo.';
       END IF;

       IF (SELECT COUNT(*) FROM ranking_options WHERE ranking_id = ${rankingId}) <> 20 THEN
         RAISE EXCEPTION 'O reset esperava exatamente 20 opções antigas.';
       END IF;
     END IF;
   END $$`,
  `WITH old_options AS (
     SELECT option.*, ROW_NUMBER() OVER (ORDER BY option.position, option.id)::integer AS old_order
     FROM ranking_options option
     WHERE option.ranking_id = ${rankingId}
       AND NOT EXISTS (
         SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
       )
   )
   INSERT INTO option_relevance_review_archive (
     review_key, option_id, ranking_id, old_label, new_label, change_kind,
     previous_position, baseline_score, live_votes, double_votes, vote_history,
     duel_entries, top3_selections, comments, source_url
   )
   SELECT
     ${reviewKey}, old.id, old.ranking_id, old.label, desired.label, 'replacement',
     old.position, old.baseline_score,
     (SELECT COUNT(*)::int FROM votes vote WHERE vote.option_id = old.id),
     (SELECT COUNT(*)::int FROM user_double_votes vote WHERE vote.option_id = old.id),
     (SELECT COUNT(*)::int FROM user_vote_history history WHERE history.option_id = old.id),
     (SELECT COUNT(*)::int FROM ranking_duel_entries entry WHERE entry.option_id = old.id),
     (SELECT COUNT(*)::int FROM ranking_top3_selections selection WHERE selection.option_id = old.id),
     (SELECT COUNT(*)::int FROM ranking_comments comment WHERE comment.option_id = old.id),
     NULL
   FROM old_options old
   JOIN cafes_floripa_desired desired ON desired.position = old.old_order
   ON CONFLICT (review_key, option_id) DO NOTHING`,
  `DELETE FROM ranking_duel_rounds
   WHERE ranking_id = ${rankingId}
     AND NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
     )`,
  `DELETE FROM ranking_duel_sessions
   WHERE ranking_id = ${rankingId}
     AND NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
     )`,
  `DELETE FROM ranking_comments
   WHERE ranking_id = ${rankingId}
     AND NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
     )`,
  `DELETE FROM ranking_top3_selections
   WHERE ranking_id = ${rankingId}
     AND NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
     )`,
  `DELETE FROM user_double_votes vote
   USING ranking_options option
   WHERE option.ranking_id = ${rankingId}
     AND vote.option_id = option.id
     AND NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
     )`,
  `DELETE FROM user_vote_history history
   USING ranking_options option
   WHERE option.ranking_id = ${rankingId}
     AND history.option_id = option.id
     AND NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
     )`,
  `DELETE FROM votes vote
   USING ranking_options option
   WHERE option.ranking_id = ${rankingId}
     AND vote.option_id = option.id
     AND NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
     )`,
  `DELETE FROM public_option_target_additions
   WHERE ranking_id = ${rankingId}
     AND NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
     )`,
  `DELETE FROM ranking_options
   WHERE ranking_id = ${rankingId}
     AND NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
     )`,
  `INSERT INTO ranking_options (ranking_id, label, position, baseline_score)
   SELECT ${rankingId}, desired.label, desired.position, 0
   FROM cafes_floripa_desired desired
   WHERE NOT EXISTS (
     SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
   )
   ORDER BY desired.position`,
  `UPDATE rankings
   SET question = ${question},
       baseline_votes = 0,
       is_active = true,
       content_updated_at = now()
   WHERE id = ${rankingId}
     AND NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
     )`,
  `INSERT INTO option_relevance_review_state (review_key, summary)
   SELECT
     ${reviewKey},
     jsonb_build_object(
       'ranking_id', ${rankingId},
       'new_options', 20,
       'removed_direct_votes', COALESCE(SUM(archive.live_votes), 0),
       'removed_double_votes', COALESCE(SUM(archive.double_votes), 0),
       'removed_vote_history', COALESCE(SUM(archive.vote_history), 0),
       'removed_duel_entries', COALESCE(SUM(archive.duel_entries), 0),
       'removed_top3_selections', COALESCE(SUM(archive.top3_selections), 0),
       'removed_comments', COALESCE(SUM(archive.comments), 0)
     )
   FROM option_relevance_review_archive archive
   WHERE archive.review_key = ${reviewKey}
   ON CONFLICT (review_key) DO NOTHING`,
  `DO $$
   BEGIN
     IF (SELECT COUNT(*) FROM ranking_options WHERE ranking_id = ${rankingId}) <> 20 OR
        EXISTS (
          SELECT 1
          FROM cafes_floripa_desired desired
          LEFT JOIN ranking_options option
            ON option.ranking_id = ${rankingId}
           AND option.position = desired.position
           AND option.label = desired.label
           AND option.baseline_score = 0
          WHERE option.id IS NULL
        ) THEN
       RAISE EXCEPTION 'A lista final de cafés ficou incompleta ou fora de ordem.';
     END IF;

     IF EXISTS (
       SELECT 1 FROM ranking_options option
       WHERE option.ranking_id = ${rankingId}
         AND (
           EXISTS (SELECT 1 FROM votes vote WHERE vote.option_id = option.id) OR
           EXISTS (SELECT 1 FROM user_double_votes vote WHERE vote.option_id = option.id) OR
           EXISTS (SELECT 1 FROM user_vote_history history WHERE history.option_id = option.id) OR
           EXISTS (SELECT 1 FROM ranking_duel_entries entry WHERE entry.option_id = option.id) OR
           EXISTS (SELECT 1 FROM ranking_top3_selections selection WHERE selection.option_id = option.id) OR
           EXISTS (SELECT 1 FROM ranking_comments comment WHERE comment.option_id = option.id)
         )
     ) THEN
       RAISE EXCEPTION 'O ranking renovado ainda contém participação antiga.';
     END IF;
   END $$`,
];

if (sqlOutputMode) {
  process.stdout.write(JSON.stringify([...setupStatements, ...refreshStatements]));
  process.exit(0);
}

const sql = neon(process.env.DATABASE_URL);
await sql.transaction(
  [...setupStatements, ...refreshStatements].map((statement) => sql.query(statement)),
  { isolationLevel: 'Serializable' },
);

const [validation] = await sql.query(
  `SELECT
     (SELECT COUNT(*)::int FROM ranking_options WHERE ranking_id = $1) AS option_count,
     (SELECT summary FROM option_relevance_review_state WHERE review_key = $2) AS summary`,
  [review.rankingId, review.reviewKey],
);

if (Number(validation?.option_count) !== 20 || !validation?.summary) {
  throw new Error(
    `Cafés de Florianópolis refresh validation failed: ${JSON.stringify(validation)}`,
  );
}

console.log(
  `Cafés de Florianópolis atualizados: ${validation.option_count} opções, votos zerados.`,
);
