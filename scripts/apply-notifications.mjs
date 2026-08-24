import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements.mjs';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const sql = neon(process.env.DATABASE_URL);
const migration = await readFile(
  new URL('../migrations/20260824_notifications.sql', import.meta.url),
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
        AND column_name = 'notification_last_seen_at'
    ) AS notification_last_seen_at,
    to_regclass('public.user_notifications') IS NOT NULL AS notifications
`);

if (!validation?.notification_last_seen_at || !validation?.notifications) {
  throw new Error(`Notification schema validation failed: ${JSON.stringify(validation)}`);
}

console.log('Notification schema applied and validated.');
