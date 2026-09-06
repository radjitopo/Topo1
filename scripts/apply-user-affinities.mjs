import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements.mjs';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const sql = neon(process.env.DATABASE_URL);
const migration = await readFile(
  new URL('../migrations/20260906_user_affinities.sql', import.meta.url),
  'utf8',
);

await sql.transaction(
  splitSqlStatements(migration).map((statement) => sql.query(statement)),
  { isolationLevel: 'Serializable' },
);

const [validation] = await sql.query(`
  SELECT
    to_regclass('public.user_affinity_links') IS NOT NULL AS links_table,
    to_regclass('public.user_affinity_connections') IS NOT NULL AS connections_table
`);

if (!validation?.links_table || !validation?.connections_table) {
  throw new Error(`User affinities schema validation failed: ${JSON.stringify(validation)}`);
}

console.log('User affinities schema applied and validated.');
