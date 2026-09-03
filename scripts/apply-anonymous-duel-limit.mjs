import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements.mjs';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const sql = neon(process.env.DATABASE_URL);
const migration = await readFile(
  new URL('../migrations/20260903_anonymous_duel_limit.sql', import.meta.url),
  'utf8',
);

await sql.transaction(
  splitSqlStatements(migration).map((statement) => sql.query(statement)),
  { isolationLevel: 'Serializable' },
);

const [validation] = await sql.query(`
  SELECT
    to_regclass('public.anonymous_vote_usage') IS NOT NULL AS vote_usage_table,
    to_regclass('public.anonymous_duel_usage') IS NOT NULL AS duel_usage_table,
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'anonymous_duel_usage'
        AND column_name = 'duels_completed'
    ) AS duel_completed_column
`);

if (
  !validation?.vote_usage_table ||
  !validation?.duel_usage_table ||
  !validation?.duel_completed_column
) {
  throw new Error(`Anonymous duel limit validation failed: ${JSON.stringify(validation)}`);
}

console.log('Anonymous vote and two-duel limits applied and validated.');
