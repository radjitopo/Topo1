import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements.mjs';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const sql = neon(process.env.DATABASE_URL);
const migration = await readFile(
  new URL('../migrations/20260827_user_vip_rankings.sql', import.meta.url),
  'utf8',
);

await sql.transaction(
  splitSqlStatements(migration).map((statement) => sql.query(statement)),
  { isolationLevel: 'Serializable' },
);

const [validation] = await sql.query(`
  SELECT
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'rankings' AND column_name = 'vip_owner_user_id'
    ) AS owner_column,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'rankings' AND column_name = 'vip_source_ranking_id'
    ) AS source_column,
    EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'rankings'::regclass
        AND conname = 'rankings_vip_owner_user_id_fkey'
    ) AS owner_foreign_key,
    EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'rankings'::regclass
        AND conname = 'rankings_vip_source_ranking_id_fkey'
    ) AS source_foreign_key
`);

if (
  !validation?.owner_column ||
  !validation?.source_column ||
  !validation?.owner_foreign_key ||
  !validation?.source_foreign_key
) {
  throw new Error(`User VIP ranking schema validation failed: ${JSON.stringify(validation)}`);
}

console.log('User VIP ranking schema applied and validated.');
