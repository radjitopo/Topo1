import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements.mjs';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const sql = neon(process.env.DATABASE_URL);
const migration = await readFile(
  new URL('../migrations/20260827_user_vip_custom_rankings.sql', import.meta.url),
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
      WHERE table_name = 'rankings' AND column_name = 'vip_description'
    ) AS description_column,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'rankings' AND column_name = 'vip_voting_open'
    ) AS voting_open_column,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'ranking_options' AND column_name = 'vip_added_later'
    ) AS added_later_column
`);

if (
  !validation?.description_column ||
  !validation?.voting_open_column ||
  !validation?.added_later_column
) {
  throw new Error(`Custom VIP ranking schema validation failed: ${JSON.stringify(validation)}`);
}

console.log('Custom VIP ranking schema applied and validated.');
