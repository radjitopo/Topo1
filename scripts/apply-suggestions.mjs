import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements.mjs';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const sql = neon(process.env.DATABASE_URL);
const migration = await readFile(
  new URL('../migrations/20260823_suggestions.sql', import.meta.url),
  'utf8',
);

const statements = splitSqlStatements(migration);
await sql.transaction(
  statements.map((statement) => sql.query(statement)),
  {
    isolationLevel: 'Serializable',
  },
);

const [validation] = await sql.query(`
  SELECT
    to_regclass('public.ranking_option_suggestions') IS NOT NULL AS option_table,
    to_regclass('public.ranking_topic_suggestions') IS NOT NULL AS topic_table,
    EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE indexname = 'ranking_option_suggestions_pending_unique'
    ) AS option_pending_unique,
    EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE indexname = 'ranking_topic_suggestions_pending_unique'
    ) AS topic_pending_unique
`);

if (
  !validation?.option_table ||
  !validation?.topic_table ||
  !validation?.option_pending_unique ||
  !validation?.topic_pending_unique
) {
  throw new Error(`Suggestion schema validation failed: ${JSON.stringify(validation)}`);
}

console.log('Suggestion schema applied and validated.');
