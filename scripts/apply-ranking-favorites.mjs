import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements.mjs';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const sql = neon(process.env.DATABASE_URL);
const migration = await readFile(
  new URL('../migrations/20260827_ranking_favorites.sql', import.meta.url),
  'utf8',
);

await sql.transaction(
  splitSqlStatements(migration).map((statement) => sql.query(statement)),
  { isolationLevel: 'Serializable' },
);

const [validation] = await sql.query(`
  SELECT
    to_regclass('public.user_ranking_favorites') IS NOT NULL AS favorites_table,
    to_regclass('public.user_favorite_collections') IS NOT NULL AS collections_table,
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'user_favorite_collections'
        AND column_name = 'share_token'
    ) AS share_token_column
`);

if (
  !validation?.favorites_table ||
  !validation?.collections_table ||
  !validation?.share_token_column
) {
  throw new Error(`Ranking favorites schema validation failed: ${JSON.stringify(validation)}`);
}

console.log('Ranking favorites schema applied and validated.');
