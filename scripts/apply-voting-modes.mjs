import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements.mjs';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const sql = neon(process.env.DATABASE_URL);
const migration = await readFile(
  new URL('../migrations/20260828_voting_modes.sql', import.meta.url),
  'utf8',
);

await sql.transaction(
  splitSqlStatements(migration).map((statement) => sql.query(statement)),
  { isolationLevel: 'Serializable' },
);

const [validation] = await sql.query(`
  SELECT
    to_regclass('public.ranking_top3_selections') IS NOT NULL AS top3_table,
    to_regclass('public.ranking_duel_rounds') IS NOT NULL AS duel_rounds_table,
    to_regclass('public.ranking_duel_entries') IS NOT NULL AS duel_entries_table,
    to_regclass('public.ranking_duel_user_option_unique_idx') IS NOT NULL
      AS duel_user_unique_index,
    to_regclass('public.ranking_duel_device_option_unique_idx') IS NOT NULL
      AS duel_device_unique_index
`);

if (
  !validation?.top3_table ||
  !validation?.duel_rounds_table ||
  !validation?.duel_entries_table ||
  !validation?.duel_user_unique_index ||
  !validation?.duel_device_unique_index
) {
  throw new Error(`Voting modes schema validation failed: ${JSON.stringify(validation)}`);
}

console.log('Voting modes schema applied and validated.');
