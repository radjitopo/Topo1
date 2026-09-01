import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { RANKING_COVER_REVIEW, RANKING_COVER_REVIEW_KEY } from '../ranking-cover-review.js';
import { imageAssetKey } from '../ranking-image-policy.js';
import { splitSqlStatements } from './sql-statements.mjs';

const sqlOutputMode = process.argv.includes('--sql');

if (!sqlOutputMode && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const migration = await readFile(
  new URL('../migrations/20260901_ranking_cover_review.sql', import.meta.url),
  'utf8',
);

const rankingIds = RANKING_COVER_REVIEW.map((change) => change.rankingId);
const replacements = RANKING_COVER_REVIEW.map((change) => imageAssetKey(change.replacement));
if (
  !RANKING_COVER_REVIEW_KEY ||
  RANKING_COVER_REVIEW.length !== 42 ||
  new Set(rankingIds).size !== rankingIds.length ||
  new Set(replacements).size !== replacements.length ||
  RANKING_COVER_REVIEW.some(
    (change) =>
      !change.rankingId ||
      !change.rejectedAsset ||
      !change.replacement.startsWith('https://') ||
      !change.license ||
      !change.reason ||
      (change.license === 'Unsplash License' &&
        !change.sourcePage?.startsWith('https://unsplash.com/')),
  )
) {
  throw new Error('Invalid ranking cover review data');
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
const changesJson = JSON.stringify(RANKING_COVER_REVIEW);

const setupQueries = splitSqlStatements(migration).map((statement) => sql.query(statement));
const reviewQueries = [
  sql.query(
    `CREATE TEMP TABLE ranking_cover_changes ON COMMIT DROP AS
     SELECT *
     FROM jsonb_to_recordset($1::jsonb) AS change(
       "rankingId" text,
       "rejectedAsset" text,
       replacement text,
       "sourcePage" text,
       license text,
       reason text
     )
     WHERE NOT EXISTS (
       SELECT 1 FROM ranking_cover_review_state state WHERE state.review_key = $2
     )`,
    [changesJson, RANKING_COVER_REVIEW_KEY],
  ),
  sql.query(`DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM ranking_cover_changes change
        LEFT JOIN rankings ranking ON ranking.id = change."rankingId"
        WHERE ranking.id IS NULL OR ranking.is_active = false OR ranking.is_vip = true
      ) THEN
        RAISE EXCEPTION 'A revisão de capas contém um ranking que não é público e ativo.';
      END IF;
    END $$`),
  sql.query(`CREATE TEMP TABLE ranking_cover_matches ON COMMIT DROP AS
    SELECT
      change."rankingId" AS ranking_id,
      ranking.image_url AS previous_image_url
    FROM ranking_cover_changes change
    JOIN rankings ranking ON ranking.id = change."rankingId"
    WHERE CASE
      WHEN LEFT(change."rejectedAsset", 9) = 'unsplash:' THEN
        POSITION(
          '/photo-' || SUBSTRING(change."rejectedAsset" FROM 10)
          IN COALESCE(ranking.image_url, '')
        ) > 0
      ELSE COALESCE(ranking.image_url, '') = change."rejectedAsset"
    END`),
  sql.query(
    `INSERT INTO ranking_cover_review_archive (
       review_key,
       ranking_id,
       previous_image_url,
       replacement_image_url,
       source_page,
       license,
       reason
     )
     SELECT
       $1,
       match.ranking_id,
       match.previous_image_url,
       change.replacement,
       change."sourcePage",
       change.license,
       change.reason
     FROM ranking_cover_matches match
     JOIN ranking_cover_changes change ON change."rankingId" = match.ranking_id
     ON CONFLICT (review_key, ranking_id) DO NOTHING`,
    [RANKING_COVER_REVIEW_KEY],
  ),
  sql.query(`UPDATE rankings ranking
    SET image_url = change.replacement,
        content_updated_at = now()
    FROM ranking_cover_matches match
    JOIN ranking_cover_changes change ON change."rankingId" = match.ranking_id
    WHERE ranking.id = match.ranking_id`),
  sql.query(
    `INSERT INTO ranking_cover_review_state (review_key, summary)
     SELECT
       $1,
       jsonb_build_object(
         'reviewed', (SELECT COUNT(*) FROM ranking_cover_changes),
         'changed', (SELECT COUNT(*) FROM ranking_cover_matches),
         'preservedModeratorChoices',
           (SELECT COUNT(*) FROM ranking_cover_changes) -
           (SELECT COUNT(*) FROM ranking_cover_matches)
       )
     WHERE EXISTS (SELECT 1 FROM ranking_cover_changes)
     ON CONFLICT (review_key) DO NOTHING`,
    [RANKING_COVER_REVIEW_KEY],
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
  `WITH expected AS (
     SELECT *
     FROM jsonb_to_recordset($2::jsonb) AS change("rankingId" text, replacement text)
   )
   SELECT
     state.summary,
     (SELECT COUNT(*)::int
        FROM ranking_cover_review_archive archive
       WHERE archive.review_key = $1) AS archived,
     (SELECT COUNT(*)::int
        FROM expected
        JOIN rankings ranking ON ranking.id = expected."rankingId"
       WHERE ranking.image_url = expected.replacement) AS replacements_live
   FROM ranking_cover_review_state state
   WHERE state.review_key = $1`,
  [RANKING_COVER_REVIEW_KEY, changesJson],
);

const changed = Number(validation?.summary?.changed);
if (
  Number(validation?.summary?.reviewed) !== RANKING_COVER_REVIEW.length ||
  Number(validation?.archived) !== changed ||
  Number(validation?.replacements_live) < changed
) {
  throw new Error(`Ranking cover review validation failed: ${JSON.stringify(validation)}`);
}

console.log(
  `Cover review applied: ${changed} replacements; ${validation.summary.preservedModeratorChoices} moderator choices preserved.`,
);
