import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements.mjs';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const sql = neon(process.env.DATABASE_URL);
const migration = await readFile(
  new URL('../migrations/20260826_ranking_editor.sql', import.meta.url),
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
      WHERE table_name = 'rankings' AND column_name = 'content_updated_at'
    ) AS content_timestamp,
    to_regclass('public.ranking_images') IS NOT NULL AS image_table,
    to_regclass('public.ranking_content_edits') IS NOT NULL AS history_table
`);

if (!validation?.content_timestamp || !validation?.image_table || !validation?.history_table) {
  throw new Error(`Ranking editor schema validation failed: ${JSON.stringify(validation)}`);
}

console.log('Ranking editor schema applied and validated.');
