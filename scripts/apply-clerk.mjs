import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements.mjs';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const sql = neon(process.env.DATABASE_URL);
const migration = await readFile(
  new URL('../migrations/20260824_clerk_links.sql', import.meta.url),
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
    to_regclass('public.clerk_user_links') IS NOT NULL AS user_links,
    to_regclass('public.clerk_device_links') IS NOT NULL AS device_links
`);

if (!validation?.user_links || !validation?.device_links) {
  throw new Error(`Clerk schema validation failed: ${JSON.stringify(validation)}`);
}

console.log('Clerk schema applied and validated.');
