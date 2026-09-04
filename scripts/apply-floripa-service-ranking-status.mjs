import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements.mjs';

const MIGRATION_KEY = '20260904_deactivate_floripa_service_rankings';
const TARGET_RANKING_IDS = ['barbearias-floripa', 'pet-shops-floripa', 'saloes-beleza-floripa'];
const sqlOutputMode = process.argv.includes('--sql');

if (!sqlOutputMode && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const migration = await readFile(
  new URL('../migrations/20260904_deactivate_floripa_service_rankings.sql', import.meta.url),
  'utf8',
);
const statements = [
  'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE',
  ...splitSqlStatements(migration),
];

if (sqlOutputMode) {
  process.stdout.write(JSON.stringify(statements));
  process.exit(0);
}

const sql = neon(process.env.DATABASE_URL);
await sql.transaction(statements.map((statement) => sql.query(statement)));

const [validation] = await sql.query(
  `WITH targets(id) AS (
     SELECT unnest($1::text[])
   ), target_options AS (
     SELECT option.id
     FROM ranking_options option
     JOIN targets target ON target.id = option.ranking_id
   )
   SELECT
     (SELECT COUNT(*)::integer
      FROM rankings ranking
      JOIN targets target ON target.id = ranking.id) AS matched_rankings,
     (SELECT COUNT(*)::integer
      FROM rankings ranking
      JOIN targets target ON target.id = ranking.id
      WHERE ranking.is_active = false) AS inactive_rankings,
     (SELECT COUNT(*)::integer FROM target_options) AS option_count,
     state.summary,
     (state.summary->>'options_preserved')::integer =
       (SELECT COUNT(*)::integer FROM target_options) AS options_preserved
   FROM ranking_status_migration_state state
   WHERE state.migration_key = $2`,
  [TARGET_RANKING_IDS, MIGRATION_KEY],
);

if (
  Number(validation?.matched_rankings) !== TARGET_RANKING_IDS.length ||
  Number(validation?.inactive_rankings) !== TARGET_RANKING_IDS.length ||
  validation?.options_preserved !== true ||
  validation?.summary?.reversible !== true
) {
  throw new Error(`Florianópolis ranking status validation failed: ${JSON.stringify(validation)}`);
}

console.log(
  `${TARGET_RANKING_IDS.length} rankings de Florianópolis desativados; ${validation.option_count} opções e toda a participação preservadas.`,
);
