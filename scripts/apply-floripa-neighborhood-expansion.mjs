import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements.mjs';

const EXPECTED_RANKING_IDS = [
  'academias-floripa',
  'bairros-floripa',
  'barbearias-floripa',
  'bares-floripa',
  'botecos-floripa',
  'brechos-floripa',
  'cafes-floripa',
  'eventos-esportivos-floripa',
  'hamburguer-floripa',
  'hoteis-floripa',
  'padarias-floripa',
  'pet-shops-floripa',
  'pizzarias-floripa',
  'praias',
  'quilo-floripa',
  'restaurantes-floripa',
  'restaurantes-italianos-floripa',
  'restaurantes-veganos-floripa',
  'saloes-beleza-floripa',
  'sushi-floripa',
];
const EXPECTED_REGIONS = ['Central', 'Continental', 'Norte', 'Sul', 'Leste'];
const REVIEW_KEY = '20260904_floripa_neighborhood_expansion';

const [review, migration] = await Promise.all([
  readFile(
    new URL('../data/floripa-neighborhood-expansion-2026-09.json', import.meta.url),
    'utf8',
  ).then(JSON.parse),
  readFile(
    new URL('../migrations/20260904_floripa_neighborhood_expansion.sql', import.meta.url),
    'utf8',
  ),
]);

function normalized(value) {
  return String(value).trim().replaceAll(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

function sameMembers(left, right) {
  return (
    left.length === right.length &&
    [...left].sort().every((value, index) => value === [...right].sort()[index])
  );
}

function validateReview() {
  if (
    review.reviewKey !== REVIEW_KEY ||
    review.city !== 'Florianópolis' ||
    review.rules?.appendOnly !== true ||
    review.rules?.preserveExistingOptions !== true ||
    review.rules?.preserveVotes !== true ||
    !sameMembers(review.regions || [], EXPECTED_REGIONS) ||
    !Array.isArray(review.rankings) ||
    !sameMembers(
      review.rankings.map(({ rankingId }) => rankingId),
      EXPECTED_RANKING_IDS,
    )
  ) {
    throw new Error('Invalid Florianópolis neighborhood expansion metadata');
  }

  for (const ranking of review.rankings) {
    if (
      !Array.isArray(ranking.sources) ||
      ranking.sources.length === 0 ||
      ranking.sources.some((source) => !URL.canParse(source) || !source.startsWith('https://')) ||
      !Array.isArray(ranking.additions) ||
      ranking.additions.length === 0
    ) {
      throw new Error(`Invalid research evidence for ${ranking.rankingId}`);
    }

    const labels = new Set();
    for (const addition of ranking.additions) {
      const label = addition.label?.trim();
      const neighborhood = addition.neighborhood?.trim();
      if (
        !label ||
        label !== addition.label ||
        !neighborhood ||
        neighborhood !== addition.neighborhood ||
        !EXPECTED_REGIONS.includes(addition.region) ||
        labels.has(normalized(label))
      ) {
        throw new Error(`Invalid or duplicate option in ${ranking.rankingId}: ${addition.label}`);
      }
      labels.add(normalized(label));
    }
  }
}

validateReview();

const expansionRows = review.rankings.flatMap((ranking) =>
  ranking.additions.map((addition, index) => ({
    reviewKey: review.reviewKey,
    rankingId: ranking.rankingId,
    label: addition.label,
    neighborhood: addition.neighborhood,
    region: addition.region,
    sourceOrder: index + 1,
  })),
);
const escapedRows = JSON.stringify(expansionRows).replaceAll("'", "''");
const setupStatement = `CREATE TEMP TABLE floripa_neighborhood_expansion ON COMMIT DROP AS
  SELECT
    incoming."reviewKey" AS review_key,
    incoming."rankingId" AS ranking_id,
    incoming.label,
    incoming.neighborhood,
    incoming.region,
    incoming."sourceOrder" AS source_order
  FROM jsonb_to_recordset('${escapedRows}'::jsonb) AS incoming(
    "reviewKey" text,
    "rankingId" text,
    label text,
    neighborhood text,
    region text,
    "sourceOrder" integer
  )`;
const statements = [
  'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE',
  setupStatement,
  ...splitSqlStatements(migration),
];

if (process.argv.includes('--sql')) {
  process.stdout.write(JSON.stringify(statements));
  process.exit(0);
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const sql = neon(process.env.DATABASE_URL);
await sql.transaction(statements.map((statement) => sql.query(statement)));

const [validation] = await sql.query(
  `SELECT
     (SELECT COUNT(*)::integer
      FROM public_option_target_additions
      WHERE migration_key = $1) AS added_options,
     (SELECT summary
      FROM public_option_target_migration_state
      WHERE migration_key = $1) AS summary,
     (SELECT COUNT(*)::integer
      FROM (
        SELECT incoming."rankingId", incoming.label
        FROM jsonb_to_recordset($2::jsonb) AS incoming(
          "reviewKey" text,
          "rankingId" text,
          label text,
          neighborhood text,
          region text,
          "sourceOrder" integer
        )
        WHERE NOT EXISTS (
          SELECT 1
          FROM ranking_options option
          WHERE option.ranking_id = incoming."rankingId"
            AND lower(regexp_replace(btrim(option.label), '\\s+', ' ', 'g')) =
                lower(regexp_replace(btrim(incoming.label), '\\s+', ' ', 'g'))
        )
      ) missing) AS missing_options`,
  [review.reviewKey, JSON.stringify(expansionRows)],
);

if (
  !validation?.summary ||
  Number(validation.missing_options) !== 0 ||
  Number(validation.added_options) !== expansionRows.length
) {
  throw new Error(`Florianópolis expansion validation failed: ${JSON.stringify(validation)}`);
}

console.log(
  `Florianópolis expandida: ${validation.added_options} opções adicionadas em ${review.rankings.length} rankings; opções e votos anteriores preservados.`,
);
