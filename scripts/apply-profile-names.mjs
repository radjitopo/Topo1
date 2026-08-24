import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements.mjs';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const sql = neon(process.env.DATABASE_URL);
const migration = await readFile(
  new URL('../migrations/20260824_profile_names.sql', import.meta.url),
  'utf8',
);
const statements = splitSqlStatements(migration);

await sql.transaction(
  statements.map((statement) => sql.query(statement)),
  { isolationLevel: 'Serializable' },
);

const [validation] = await sql.query(`
  SELECT
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'display_name_updated_at'
    ) AS display_name_updated_at,
    to_regclass('public.user_name_reports') IS NOT NULL AS name_reports
`);

if (!validation?.display_name_updated_at || !validation?.name_reports) {
  throw new Error(`Profile name schema validation failed: ${JSON.stringify(validation)}`);
}

console.log('Profile name schema applied and validated.');
