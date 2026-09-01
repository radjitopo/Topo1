import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements.mjs';

const MIGRATION_KEY = '20260901_public_option_targets';
const expansion = JSON.parse(
  await readFile(new URL('../data/public-option-expansion.json', import.meta.url), 'utf8'),
);
const migration = await readFile(
  new URL('../migrations/20260901_public_option_targets.sql', import.meta.url),
  'utf8',
);

const expansionRows = Object.entries(expansion).flatMap(([scope, rankings]) =>
  Object.entries(rankings).flatMap(([rankingId, labels]) =>
    labels.map((label, index) => ({
      scope,
      rankingId,
      label,
      sourceOrder: index + 1,
    })),
  ),
);
const expansionJson = JSON.stringify(expansionRows);
const escapedExpansionJson = expansionJson.replaceAll("'", "''");
const setupStatement = `CREATE TEMP TABLE public_option_target_expansion ON COMMIT DROP AS
  SELECT
    incoming.scope,
    incoming."rankingId" AS ranking_id,
    incoming.label,
    incoming."sourceOrder" AS source_order
  FROM jsonb_to_recordset('${escapedExpansionJson}'::jsonb) AS incoming(
    scope text,
    "rankingId" text,
    label text,
    "sourceOrder" integer
  )`;
const statements = [setupStatement, ...splitSqlStatements(migration)];

if (process.argv.includes('--sql')) {
  process.stdout.write(JSON.stringify(statements));
  process.exit(0);
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const sql = neon(process.env.DATABASE_URL);
await sql.transaction(
  statements.map((statement) => sql.query(statement)),
  { isolationLevel: 'Serializable' },
);

const [validation] = await sql.query(`
  WITH active_counts AS (
    SELECT
      ranking.id,
      ranking.category,
      COUNT(option.id)::integer AS option_count
    FROM rankings ranking
    LEFT JOIN ranking_options option ON option.ranking_id = ranking.id
    WHERE ranking.is_active = true
      AND ranking.is_vip = false
    GROUP BY ranking.id, ranking.category
  )
  SELECT
    COUNT(*) FILTER (
      WHERE category IN (
        'São Paulo', 'Rio de Janeiro', 'Brasília', 'Fortaleza', 'Salvador',
        'Belo Horizonte', 'Manaus', 'Curitiba', 'Recife', 'Goiânia', 'Belém',
        'Porto Alegre', 'Guarulhos', 'Campinas', 'São Luís', 'Maceió',
        'Campo Grande', 'São Gonçalo', 'Teresina', 'João Pessoa', 'Florianópolis'
      ) AND option_count < 20
    )::integer AS local_below_target,
    COUNT(*) FILTER (
      WHERE category NOT IN (
        'São Paulo', 'Rio de Janeiro', 'Brasília', 'Fortaleza', 'Salvador',
        'Belo Horizonte', 'Manaus', 'Curitiba', 'Recife', 'Goiânia', 'Belém',
        'Porto Alegre', 'Guarulhos', 'Campinas', 'São Luís', 'Maceió',
        'Campo Grande', 'São Gonçalo', 'Teresina', 'João Pessoa', 'Florianópolis'
      ) AND option_count < 14
    )::integer AS general_below_target,
    (SELECT COUNT(*)::integer
     FROM public_option_target_additions
     WHERE migration_key = '${MIGRATION_KEY}') AS added_options,
    EXISTS (
      SELECT 1 FROM public_option_target_migration_state WHERE migration_key = '${MIGRATION_KEY}'
    ) AS migration_recorded
  FROM active_counts
`);

if (
  !validation?.migration_recorded ||
  Number(validation.local_below_target) !== 0 ||
  Number(validation.general_below_target) !== 0
) {
  throw new Error(`Public option target validation failed: ${JSON.stringify(validation)}`);
}

console.log(
  `Public option targets applied: ${validation.added_options} options restored or added; Local 20 and general 14 validated.`,
);
