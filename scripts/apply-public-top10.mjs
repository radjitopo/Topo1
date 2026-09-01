import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements.mjs';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const sql = neon(process.env.DATABASE_URL);
const migration = await readFile(
  new URL('../migrations/20260901_public_top10.sql', import.meta.url),
  'utf8',
);

await sql.transaction(
  splitSqlStatements(migration).map((statement) => sql.query(statement)),
  { isolationLevel: 'Serializable' },
);

const [validation] = await sql.query(`
  WITH public_counts AS (
    SELECT ranking.id, COUNT(option.id)::int AS option_count
    FROM rankings ranking
    LEFT JOIN ranking_options option ON option.ranking_id = ranking.id
    WHERE ranking.is_active = true
      AND ranking.is_vip = false
    GROUP BY ranking.id
  )
  SELECT
    COUNT(*)::int AS active_rankings,
    COUNT(*) FILTER (WHERE option_count < 10)::int AS underfilled_rankings,
    MIN(option_count)::int AS minimum_options,
    EXISTS (
      SELECT 1
      FROM public_top10_migration_state
      WHERE migration_key = '20260901_public_top10'
    ) AS migration_recorded
  FROM public_counts
`);

if (
  !validation?.migration_recorded ||
  Number(validation?.underfilled_rankings) !== 0 ||
  Number(validation?.minimum_options || 0) < 10
) {
  throw new Error(`Public Top 10 validation failed: ${JSON.stringify(validation)}`);
}

console.log(
  `Public Top 10 applied: ${validation.active_rankings} active rankings, minimum ${validation.minimum_options} options.`,
);
