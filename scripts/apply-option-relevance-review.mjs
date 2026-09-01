import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements.mjs';

const sqlOutputMode = process.argv.includes('--sql');

if (!sqlOutputMode && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const [review, migration] = await Promise.all([
  readFile(new URL('../data/option-relevance-review.json', import.meta.url), 'utf8').then(
    JSON.parse,
  ),
  readFile(new URL('../migrations/20260901_option_relevance_review.sql', import.meta.url), 'utf8'),
]);

const semanticChanges = review.replacements.map((change) => ({
  rankingId: change.rankingId,
  oldLabel: change.oldLabel,
  newLabel: change.newLabel,
  changeKind: 'replacement',
  sourceUrl: review.sources[change.source] || null,
  sourceKey: change.source,
}));
const labelRenames = review.renames.map((change) => ({
  rankingId: change.rankingId,
  oldLabel: change.oldLabel,
  newLabel: change.newLabel,
  changeKind: 'rename',
  sourceUrl: null,
}));
const changes = [...semanticChanges, ...labelRenames];
const positions = Object.entries(review.top10).flatMap(([rankingId, labels]) =>
  labels.map((label, index) => ({ rankingId, label, position: index + 1 })),
);

const changeKeys = changes.map((change) => `${change.rankingId}\u0000${change.oldLabel}`);
if (
  !review.reviewKey ||
  !changes.length ||
  new Set(changeKeys).size !== changeKeys.length ||
  changes.some(
    (change) =>
      !change.rankingId ||
      !change.oldLabel ||
      !change.newLabel ||
      change.oldLabel === change.newLabel,
  ) ||
  semanticChanges.some((change) => !change.sourceUrl && change.sourceKey !== 'editorial') ||
  Object.values(review.top10).some((labels) => labels.length !== 10 || new Set(labels).size !== 10)
) {
  throw new Error('Invalid option relevance review data');
}

function renderSql(text, params = []) {
  return text.replace(/\$(\d+)/g, (_, index) => {
    const value = params[Number(index) - 1];
    if (value === null || value === undefined) return 'NULL';
    return `'${String(value).replaceAll("'", "''")}'`;
  });
}

const sql = sqlOutputMode
  ? { query: (text, params) => renderSql(text, params) }
  : neon(process.env.DATABASE_URL);
const changesJson = JSON.stringify(changes);
const questionsJson = JSON.stringify(review.questions);
const positionsJson = JSON.stringify(positions);
const summaryJson = JSON.stringify({
  replacements: semanticChanges.length,
  renames: labelRenames.length,
  questions: review.questions.length,
  reviewedRankings: Object.keys(review.top10).length,
});

const setupQueries = splitSqlStatements(migration).map((statement) => sql.query(statement));
const reviewQueries = [
  sql.query(
    `CREATE TEMP TABLE option_relevance_changes ON COMMIT DROP AS
     SELECT *
     FROM jsonb_to_recordset($1::jsonb) AS change(
       "rankingId" text,
       "oldLabel" text,
       "newLabel" text,
       "changeKind" text,
       "sourceUrl" text
     )
     WHERE NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state state WHERE state.review_key = $2
     )`,
    [changesJson, review.reviewKey],
  ),
  sql.query(
    `CREATE TEMP TABLE option_relevance_questions ON COMMIT DROP AS
     SELECT *
     FROM jsonb_to_recordset($1::jsonb) AS question("rankingId" text, question text)
     WHERE NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state state WHERE state.review_key = $2
     )`,
    [questionsJson, review.reviewKey],
  ),
  sql.query(
    `CREATE TEMP TABLE option_relevance_positions ON COMMIT DROP AS
     SELECT *
     FROM jsonb_to_recordset($1::jsonb) AS desired(
       "rankingId" text,
       label text,
       position integer
     )
     WHERE NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state state WHERE state.review_key = $2
     )`,
    [positionsJson, review.reviewKey],
  ),
  sql.query(`DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM option_relevance_changes change
        LEFT JOIN ranking_options option
          ON option.ranking_id = change."rankingId"
         AND option.label = change."oldLabel"
        LEFT JOIN rankings ranking ON ranking.id = change."rankingId"
        GROUP BY change."rankingId", change."oldLabel"
        HAVING COUNT(option.id) <> 1
          OR BOOL_OR(ranking.id IS NULL OR ranking.is_active = false OR ranking.is_vip = true)
      ) THEN
        RAISE EXCEPTION 'A revisão não encontrou exatamente uma opção pública ativa para cada troca.';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM option_relevance_changes change
        JOIN ranking_options option
          ON option.ranking_id = change."rankingId"
         AND option.label = change."newLabel"
         AND option.label <> change."oldLabel"
      ) THEN
        RAISE EXCEPTION 'A revisão criaria uma opção duplicada.';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM option_relevance_questions question
        LEFT JOIN rankings ranking ON ranking.id = question."rankingId"
        WHERE ranking.id IS NULL OR ranking.is_active = false OR ranking.is_vip = true
      ) THEN
        RAISE EXCEPTION 'A revisão contém uma pergunta sem ranking público ativo.';
      END IF;
    END $$`),
  sql.query(
    `INSERT INTO option_relevance_review_archive (
       review_key, option_id, ranking_id, old_label, new_label, change_kind,
       previous_position, baseline_score, live_votes, double_votes, vote_history,
       duel_entries, top3_selections, comments, source_url
     )
     SELECT
       $1,
       option.id,
       option.ranking_id,
       option.label,
       change."newLabel",
       change."changeKind",
       option.position,
       option.baseline_score,
       (SELECT COUNT(*)::int FROM votes vote WHERE vote.option_id = option.id),
       (SELECT COUNT(*)::int FROM user_double_votes vote WHERE vote.option_id = option.id),
       (SELECT COUNT(*)::int FROM user_vote_history history WHERE history.option_id = option.id),
       (SELECT COUNT(*)::int FROM ranking_duel_entries entry WHERE entry.option_id = option.id),
       (SELECT COUNT(*)::int FROM ranking_top3_selections selection WHERE selection.option_id = option.id),
       (SELECT COUNT(*)::int FROM ranking_comments comment WHERE comment.option_id = option.id),
       change."sourceUrl"
     FROM option_relevance_changes change
     JOIN ranking_options option
       ON option.ranking_id = change."rankingId"
      AND option.label = change."oldLabel"
     ON CONFLICT (review_key, option_id) DO NOTHING`,
    [review.reviewKey],
  ),
  sql.query(`CREATE TEMP TABLE option_relevance_semantic_rankings ON COMMIT DROP AS
    SELECT DISTINCT "rankingId" AS ranking_id
    FROM option_relevance_changes
    WHERE "changeKind" = 'replacement'`),
  sql.query(`DELETE FROM ranking_duel_rounds round
    USING option_relevance_semantic_rankings changed
    WHERE round.ranking_id = changed.ranking_id`),
  sql.query(`DELETE FROM ranking_duel_sessions session
    USING option_relevance_semantic_rankings changed
    WHERE session.ranking_id = changed.ranking_id`),
  sql.query(`DELETE FROM ranking_comments comment
    USING option_relevance_changes change, ranking_options option
    WHERE change."changeKind" = 'replacement'
      AND option.ranking_id = change."rankingId"
      AND option.label = change."oldLabel"
      AND comment.option_id = option.id`),
  sql.query(`DELETE FROM ranking_top3_selections selection
    USING option_relevance_changes change, ranking_options option
    WHERE change."changeKind" = 'replacement'
      AND option.ranking_id = change."rankingId"
      AND option.label = change."oldLabel"
      AND selection.option_id = option.id`),
  sql.query(`DELETE FROM user_double_votes vote
    USING option_relevance_changes change, ranking_options option
    WHERE change."changeKind" = 'replacement'
      AND option.ranking_id = change."rankingId"
      AND option.label = change."oldLabel"
      AND vote.option_id = option.id`),
  sql.query(`DELETE FROM user_vote_history history
    USING option_relevance_changes change, ranking_options option
    WHERE change."changeKind" = 'replacement'
      AND option.ranking_id = change."rankingId"
      AND option.label = change."oldLabel"
      AND history.option_id = option.id`),
  sql.query(`DELETE FROM votes vote
    USING option_relevance_changes change, ranking_options option
    WHERE change."changeKind" = 'replacement'
      AND option.ranking_id = change."rankingId"
      AND option.label = change."oldLabel"
      AND vote.option_id = option.id`),
  sql.query(`UPDATE ranking_options option
    SET label = change."newLabel",
        baseline_score = CASE
          WHEN change."changeKind" = 'replacement' THEN 0
          ELSE option.baseline_score
        END
    FROM option_relevance_changes change
    WHERE option.ranking_id = change."rankingId"
      AND option.label = change."oldLabel"`),
  sql.query(`UPDATE ranking_options option
    SET position = option.position + 1000000
    WHERE option.ranking_id IN (
      SELECT DISTINCT desired."rankingId" FROM option_relevance_positions desired
    )`),
  sql.query(`UPDATE ranking_options option
    SET position = desired.position
    FROM option_relevance_positions desired
    WHERE option.ranking_id = desired."rankingId"
      AND option.label = desired.label`),
  sql.query(`UPDATE rankings ranking
    SET question = question.question,
        content_updated_at = now()
    FROM option_relevance_questions question
    WHERE ranking.id = question."rankingId"`),
  sql.query(`UPDATE rankings ranking
    SET content_updated_at = now()
    WHERE ranking.id IN (
      SELECT "rankingId" FROM option_relevance_changes
      UNION
      SELECT "rankingId" FROM option_relevance_positions
    )`),
  sql.query(`DO $$
    BEGIN
      IF EXISTS (
        SELECT desired."rankingId"
        FROM option_relevance_positions desired
        LEFT JOIN ranking_options option
          ON option.ranking_id = desired."rankingId"
         AND option.label = desired.label
         AND option.position = desired.position
        GROUP BY desired."rankingId"
        HAVING COUNT(option.id) <> 10
      ) THEN
        RAISE EXCEPTION 'A ordem final de uma revisão Top 10 ficou incompleta.';
      END IF;

      IF EXISTS (
        SELECT ranking.id
        FROM rankings ranking
        LEFT JOIN ranking_options option ON option.ranking_id = ranking.id
        WHERE ranking.is_active = true AND ranking.is_vip = false
        GROUP BY ranking.id
        HAVING COUNT(option.id) <> 10
      ) THEN
        RAISE EXCEPTION 'A revisão deixou ranking público fora do padrão Top 10.';
      END IF;
    END $$`),
  sql.query(
    `INSERT INTO option_relevance_review_state (review_key, summary)
     SELECT $1, $2::jsonb
     WHERE EXISTS (SELECT 1 FROM option_relevance_changes)
     ON CONFLICT (review_key) DO NOTHING`,
    [review.reviewKey, summaryJson],
  ),
];

if (sqlOutputMode) {
  process.stdout.write(JSON.stringify([...setupQueries, ...reviewQueries]));
  process.exit(0);
}

await sql.transaction([...setupQueries, ...reviewQueries], {
  isolationLevel: 'Serializable',
});

const [validation] = await sql.query(
  `WITH reviewed_rankings AS (
     SELECT DISTINCT "rankingId" AS ranking_id
     FROM jsonb_to_recordset($2::jsonb) AS desired(
       "rankingId" text,
       label text,
       position integer
     )
   ),
   exact_top10 AS (
     SELECT desired."rankingId" AS ranking_id
     FROM jsonb_to_recordset($2::jsonb) AS desired(
       "rankingId" text,
       label text,
       position integer
     )
     JOIN ranking_options option
       ON option.ranking_id = desired."rankingId"
      AND option.label = desired.label
      AND option.position = desired.position
     GROUP BY desired."rankingId"
     HAVING COUNT(*) = 10
   )
   SELECT
     EXISTS (
       SELECT 1 FROM option_relevance_review_state state WHERE state.review_key = $1
     ) AS review_recorded,
     (SELECT COUNT(*)::int FROM option_relevance_review_archive archive WHERE archive.review_key = $1) AS archived_changes,
     (SELECT COALESCE(SUM(live_votes), 0)::int FROM option_relevance_review_archive archive
       WHERE archive.review_key = $1 AND archive.change_kind = 'replacement') AS removed_live_votes,
     (SELECT COUNT(*)::int FROM exact_top10) AS exact_top10_rankings,
     (SELECT COUNT(*)::int FROM reviewed_rankings) AS expected_top10_rankings`,
  [review.reviewKey, positionsJson],
);

if (
  !validation?.review_recorded ||
  Number(validation?.archived_changes) !== changes.length ||
  Number(validation?.exact_top10_rankings) !== Number(validation?.expected_top10_rankings)
) {
  throw new Error(`Option relevance review validation failed: ${JSON.stringify(validation)}`);
}

console.log(
  `Option review applied: ${semanticChanges.length} replacements, ${labelRenames.length} renames, ${validation.removed_live_votes} direct votes archived.`,
);
