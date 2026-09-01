import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { resolveRankingCover } from '../ranking-image-policy.js';
import { rankingTitleOverrides } from '../ranking-titles.js';
import { auditRankingImages } from './audit-ranking-images.mjs';

const GENERAL_PUBLIC_OPTION_COUNT = 14;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const [
  recoveredRankings,
  batchRankings,
  thirdBatchRankings,
  fourthBatchRankings,
  fifthBatchRankings,
  sixthBatchRankings,
  seventhBatchRankings,
  eighthBatchRankings,
  ninthBatchRankings,
  tenthBatchRankings,
  eleventhBatchRankings,
  twelfthBatchRankings,
  thirteenthBatchRankings,
  titles,
  optionRelevanceReview,
  publicOptionExpansion,
] = await Promise.all([
  readFile(new URL('../data/new-rankings.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../data/rankings-batch-2.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../data/rankings-batch-3.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../data/rankings-batch-4.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../data/rankings-batch-5.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../data/rankings-batch-6.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../data/rankings-batch-7.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../data/rankings-batch-8.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../data/rankings-batch-9.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../data/rankings-batch-10.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../data/rankings-batch-11.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../data/rankings-batch-12.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../data/rankings-batch-13.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../data/titles.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../data/option-relevance-review.json', import.meta.url), 'utf8').then(
    JSON.parse,
  ),
  readFile(new URL('../data/public-option-expansion.json', import.meta.url), 'utf8').then(
    JSON.parse,
  ),
]);

const sourceRankings = [
  ...recoveredRankings,
  ...batchRankings,
  ...thirdBatchRankings,
  ...fourthBatchRankings,
  ...fifthBatchRankings,
  ...sixthBatchRankings,
  ...seventhBatchRankings,
  ...eighthBatchRankings,
  ...ninthBatchRankings,
  ...tenthBatchRankings,
  ...eleventhBatchRankings,
  ...twelfthBatchRankings,
  ...thirteenthBatchRankings,
];
const renameByRanking = new Map();
for (const rename of optionRelevanceReview.renames) {
  const rankingRenames = renameByRanking.get(rename.rankingId) || new Map();
  rankingRenames.set(rename.oldLabel, rename.newLabel);
  renameByRanking.set(rename.rankingId, rankingRenames);
}

const newRankings = sourceRankings.map((ranking) => {
  const rankingRenames = renameByRanking.get(ranking.id) || new Map();
  const normalizedOptions = [
    ...ranking.opts,
    ...(publicOptionExpansion.general[ranking.id] || []).map((label) => ({
      label,
      baseline_score: 0,
    })),
  ].map((option) => ({
    ...option,
    label: rankingRenames.get(option.label) || option.label,
  }));
  const reviewedLabels = optionRelevanceReview.top10[ranking.id];
  const reviewedOptions = reviewedLabels
    ? [
        ...reviewedLabels.map(
          (label) =>
            normalizedOptions.find((option) => option.label === label) || {
              label,
              baseline_score: 0,
            },
        ),
        ...normalizedOptions.filter((option) => !reviewedLabels.includes(option.label)),
      ].slice(0, GENERAL_PUBLIC_OPTION_COUNT)
    : normalizedOptions.slice(0, GENERAL_PUBLIC_OPTION_COUNT);

  return {
    ...ranking,
    image_url: resolveRankingCover(ranking.id, ranking.image_url),
    opts: reviewedOptions.map((option, index) => ({
      ...option,
      position: index + 1,
    })),
  };
});
const catalogTitles = {
  ...titles,
  ...Object.fromEntries(batchRankings.map((ranking) => [ranking.id, ranking.question])),
  ...Object.fromEntries(thirdBatchRankings.map((ranking) => [ranking.id, ranking.question])),
  ...Object.fromEntries(fourthBatchRankings.map((ranking) => [ranking.id, ranking.question])),
  ...Object.fromEntries(fifthBatchRankings.map((ranking) => [ranking.id, ranking.question])),
  ...Object.fromEntries(sixthBatchRankings.map((ranking) => [ranking.id, ranking.question])),
  ...Object.fromEntries(seventhBatchRankings.map((ranking) => [ranking.id, ranking.question])),
  ...Object.fromEntries(eighthBatchRankings.map((ranking) => [ranking.id, ranking.question])),
  ...Object.fromEntries(ninthBatchRankings.map((ranking) => [ranking.id, ranking.question])),
  ...Object.fromEntries(tenthBatchRankings.map((ranking) => [ranking.id, ranking.question])),
  ...Object.fromEntries(eleventhBatchRankings.map((ranking) => [ranking.id, ranking.question])),
  ...Object.fromEntries(twelfthBatchRankings.map((ranking) => [ranking.id, ranking.question])),
  ...Object.fromEntries(thirteenthBatchRankings.map((ranking) => [ranking.id, ranking.question])),
};
const allTitles = {
  ...catalogTitles,
  ...Object.fromEntries(
    Object.entries(rankingTitleOverrides).filter(([id]) => Object.hasOwn(catalogTitles, id)),
  ),
  ...Object.fromEntries(
    optionRelevanceReview.questions.map(({ rankingId, question }) => [rankingId, question]),
  ),
};

if (
  recoveredRankings.length !== 17 ||
  batchRankings.length !== 31 ||
  thirdBatchRankings.length !== 3 ||
  fourthBatchRankings.length !== 9 ||
  fifthBatchRankings.length !== 20 ||
  sixthBatchRankings.length !== 20 ||
  seventhBatchRankings.length !== 61 ||
  eighthBatchRankings.length !== 1 ||
  ninthBatchRankings.length !== 11 ||
  tenthBatchRankings.length !== 2 ||
  eleventhBatchRankings.length !== 12 ||
  twelfthBatchRankings.length !== 8 ||
  thirteenthBatchRankings.length !== 50 ||
  newRankings.length !== 245 ||
  Object.keys(allTitles).length !== 285 ||
  new Set(newRankings.map((ranking) => ranking.id)).size !== newRankings.length
) {
  throw new Error('Unexpected catalog data');
}

for (const ranking of newRankings) {
  if (!Array.isArray(ranking.opts) || ranking.opts.length !== GENERAL_PUBLIC_OPTION_COUNT) {
    throw new Error(
      `Ranking ${ranking.id} must start with exactly ${GENERAL_PUBLIC_OPTION_COUNT} options`,
    );
  }
}

for (const [rankingId, labels] of Object.entries(optionRelevanceReview.top10)) {
  if (
    labels.length !== 10 ||
    new Set(labels).size !== 10 ||
    !newRankings.some((ranking) => ranking.id === rankingId)
  ) {
    throw new Error(`Invalid relevance review for ${rankingId}`);
  }
}

const imageAudit = await auditRankingImages(newRankings);
if (imageAudit.broken.length || imageAudit.quality.length) {
  const problems = [
    ...imageAudit.broken.map((item) => `${item.id}: ${item.error}`),
    ...imageAudit.quality.map((item) => `${item.id}: ${item.qualityIssues.join(', ')}`),
  ];
  throw new Error(`Catalog image audit failed:\n${problems.join('\n')}`);
}
if (imageAudit.duplicates.length) {
  console.warn(
    `Catalog image audit warning: repeated covers in ${imageAudit.duplicates.map((group) => group.ids.join(' + ')).join('; ')}.`,
  );
}
console.log(`Catalog image audit passed: ${imageAudit.checked} covers checked.`);

const sql = neon(process.env.DATABASE_URL);
const rankingsJson = JSON.stringify(newRankings);
const titlesJson = JSON.stringify(allTitles);
const taxonomyMigrationJson = JSON.stringify({
  football: [
    'futebol',
    'times-mundo',
    'jogadoras-futebol',
    'maiores-times-brasil',
    'melhores-jogadores-flamengo',
    'melhores-jogadores-corinthians',
    'melhores-jogadores-palmeiras',
    'melhores-jogadores-sao-paulo',
    'melhores-jogadores-santos',
    'melhores-jogadores-vasco',
    'melhores-jogadores-botafogo',
    'melhores-jogadores-gremio',
    'melhores-jogadores-internacional',
    'melhores-jogadores-atletico-mg',
    'melhores-jogadores-cruzeiro',
    'melhores-jogadores-bahia',
    'melhores-jogadores-sport',
    'melhores-jogadores-athletico-pr',
    'melhores-jogadores-coritiba',
    'melhores-jogadores-fortaleza',
    'melhores-jogadores-ceara',
    'melhores-jogadores-goias',
    'melhores-jogadores-vitoria',
    'melhores-jogadores-fluminense',
    'melhor-jogador-futebol-todos-tempos',
    'melhores-goleiros-historia',
    'melhores-zagueiros-historia',
    'melhores-laterais-historia',
    'melhores-meio-campistas-historia',
    'melhores-camisas-10-historia',
    'melhores-atacantes-historia',
    'melhores-tecnicos-futebol-historia',
  ],
  animals: ['dinossauros-irados', 'animais-superpoderes', 'animais-extintos'],
});
const expectedOptionsJson = JSON.stringify(
  newRankings.map((ranking) => ({ id: ranking.id, options: ranking.opts.length })),
);

await sql.transaction(
  [
    sql.query(
      `
    WITH football_ids AS (
      SELECT jsonb_array_elements_text(($1::jsonb)->'football') AS id
    ),
    animal_ids AS (
      SELECT jsonb_array_elements_text(($1::jsonb)->'animals') AS id
    )
    UPDATE rankings ranking
    SET category = CASE
      WHEN EXISTS (SELECT 1 FROM football_ids item WHERE item.id = ranking.id) THEN 'Futebol'
      WHEN EXISTS (SELECT 1 FROM animal_ids item WHERE item.id = ranking.id) THEN 'Animais'
      WHEN ranking.category = 'Produtos' THEN 'Compras'
      WHEN ranking.category IN ('Viagem', 'Brasil') THEN 'Viagens'
      ELSE ranking.category
    END
    WHERE ranking.category IN ('Produtos', 'Viagem', 'Brasil')
      OR EXISTS (SELECT 1 FROM football_ids item WHERE item.id = ranking.id)
      OR EXISTS (SELECT 1 FROM animal_ids item WHERE item.id = ranking.id)
  `,
      [taxonomyMigrationJson],
    ),
    sql.query(
      `
    WITH incoming AS (
      SELECT *
      FROM jsonb_to_recordset($1::jsonb) AS ranking(
        id text,
        category text,
        question text,
        image_url text,
        baseline_votes integer,
        is_active boolean,
        created_at timestamptz
      )
    )
    INSERT INTO rankings (
      id,
      category,
      question,
      image_url,
      baseline_votes,
      is_active,
      created_at
    )
    SELECT
      id,
      category,
      question,
      image_url,
      baseline_votes,
      true,
      created_at
    FROM incoming
    ON CONFLICT (id)
    DO UPDATE SET
      category = EXCLUDED.category,
      question = EXCLUDED.question,
      image_url = EXCLUDED.image_url,
      baseline_votes = EXCLUDED.baseline_votes,
      is_active = true
  `,
      [rankingsJson],
    ),
    sql.query(
      `
    WITH ranking_rows AS (
      SELECT *
      FROM jsonb_to_recordset($1::jsonb) AS ranking(id text, opts jsonb)
    ),
    incoming AS (
      SELECT
        ranking.id AS ranking_id,
        option.label,
        option.position,
        option.baseline_score
      FROM ranking_rows ranking
      CROSS JOIN LATERAL jsonb_to_recordset(ranking.opts) AS option(
        label text,
        position integer,
        baseline_score integer
      )
    )
    INSERT INTO ranking_options (ranking_id, label, position, baseline_score)
    SELECT ranking_id, label, position, baseline_score
    FROM incoming
    WHERE NOT EXISTS (
      SELECT 1
      FROM ranking_options existing
      WHERE existing.ranking_id = incoming.ranking_id
        AND (
          existing.position = incoming.position
          OR lower(trim(existing.label)) = lower(trim(incoming.label))
        )
    )
    ON CONFLICT (ranking_id, position)
    DO NOTHING
  `,
      [rankingsJson],
    ),
    sql.query(
      `
    WITH incoming AS (
      SELECT key AS id, value AS question
      FROM jsonb_each_text($1::jsonb)
    )
    UPDATE rankings ranking
    SET question = incoming.question
    FROM incoming
    WHERE ranking.id = incoming.id
  `,
      [titlesJson],
    ),
  ],
  { isolationLevel: 'Serializable' },
);

const [validation] = await sql.query(
  `
  WITH expected_titles AS (
    SELECT key AS id, value AS question
    FROM jsonb_each_text($1::jsonb)
  ),
  expected_options AS (
    SELECT *
    FROM jsonb_to_recordset($2::jsonb) AS expected(id text, options integer)
  ),
  option_counts AS (
    SELECT ranking_id, COUNT(*)::int AS options
    FROM ranking_options
    GROUP BY ranking_id
  )
  SELECT
    COUNT(*) FILTER (
      WHERE ranking.is_active = true
        AND ranking.question = expected.question
    )::int AS valid_titles,
    (
      SELECT COUNT(*)::int
      FROM expected_options expected
      JOIN rankings ranking ON ranking.id = expected.id
      JOIN option_counts counts ON counts.ranking_id = ranking.id
      WHERE ranking.is_active = true
        AND counts.options >= expected.options
    ) AS valid_new_rankings
  FROM expected_titles expected
  LEFT JOIN rankings ranking ON ranking.id = expected.id
`,
  [titlesJson, expectedOptionsJson],
);

if (
  Number(validation?.valid_titles) !== Object.keys(allTitles).length ||
  Number(validation?.valid_new_rankings) !== 245
) {
  throw new Error(`Catalog validation failed: ${JSON.stringify(validation)}`);
}

console.log(
  `Catalog applied: ${Object.keys(allTitles).length} titles and 245 rankings with ${GENERAL_PUBLIC_OPTION_COUNT} initial options validated.`,
);
