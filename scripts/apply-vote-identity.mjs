import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements.mjs';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const sql = neon(process.env.DATABASE_URL);
const migration = await readFile(
  new URL('../migrations/20260825_vote_identity.sql', import.meta.url),
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
        AND table_name = 'votes'
        AND column_name = 'user_id'
    ) AS user_id,
    to_regclass('public.votes_user_option_unique_idx') IS NOT NULL AS unique_vote_index
`);

if (!validation?.user_id || !validation?.unique_vote_index) {
  throw new Error(`Vote identity schema validation failed: ${JSON.stringify(validation)}`);
}

console.log('Vote identity schema applied and validated.');
