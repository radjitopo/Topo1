import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements.mjs';

const MIGRATION_KEY = '20260908_deactivate_floripa_place_rankings';
const TARGET_RANKING_IDS = ['bairros-floripa', 'hoteis-floripa', 'praias'];
const sqlOutputMode = process.argv.includes('--sql');

if (!sqlOutputMode && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const migration = await readFile(
  new URL('../migrations/20260908_deactivate_floripa_place_rankings.sql', import.meta.url),
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
   )
   SELECT
     COUNT(*)::integer AS matched_rankings,
     COUNT(*) FILTER (WHERE ranking.is_active = false)::integer AS inactive_rankings,
     state.summary
   FROM targets target
   JOIN rankings ranking ON ranking.id = target.id
   CROSS JOIN ranking_status_migration_state state
   WHERE state.migration_key = $2
   GROUP BY state.summary`,
  [TARGET_RANKING_IDS, MIGRATION_KEY],
);

if (
  Number(validation?.matched_rankings) !== TARGET_RANKING_IDS.length ||
  Number(validation?.inactive_rankings) !== TARGET_RANKING_IDS.length ||
  validation?.summary?.reversible !== true
) {
  throw new Error(`Florianópolis place ranking validation failed: ${JSON.stringify(validation)}`);
}

console.log(
  `${TARGET_RANKING_IDS.length} rankings de Florianópolis removidos do TOPO com histórico preservado.`,
);
