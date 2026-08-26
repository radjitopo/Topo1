import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements.mjs';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const sql = neon(process.env.DATABASE_URL);
const migration = await readFile(
  new URL('../migrations/20260827_vip_area.sql', import.meta.url),
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
      WHERE table_name = 'rankings' AND column_name = 'is_vip'
    ) AS vip_flag,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'rankings' AND column_name = 'vip_password_hash'
    ) AS password_hash,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'rankings' AND column_name = 'vip_password_version'
    ) AS password_version,
    to_regclass('public.ranking_vip_unlock_attempts') IS NOT NULL AS attempts_table
`);

if (
  !validation?.vip_flag ||
  !validation?.password_hash ||
  !validation?.password_version ||
  !validation?.attempts_table
) {
  throw new Error(`VIP area schema validation failed: ${JSON.stringify(validation)}`);
}

console.log('VIP area schema applied and validated.');
