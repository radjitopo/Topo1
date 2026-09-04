import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [review, migration, runner, packageJson] = await Promise.all([
  readFile(new URL('data/floripa-neighborhood-expansion-2026-09.json', root), 'utf8').then(
    JSON.parse,
  ),
  readFile(new URL('migrations/20260904_floripa_neighborhood_expansion.sql', root), 'utf8'),
  readFile(new URL('scripts/apply-floripa-neighborhood-expansion.mjs', root), 'utf8'),
  readFile(new URL('package.json', root), 'utf8').then(JSON.parse),
]);

const expectedRankingIds = [
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
const expectedRegions = ['Central', 'Continental', 'Leste', 'Norte', 'Sul'];

function normalized(value) {
  return value.trim().replaceAll(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

test('the Florianópolis expansion covers all 20 active rankings and all five regions', () => {
  assert.equal(review.reviewKey, '20260904_floripa_neighborhood_expansion');
  assert.equal(review.city, 'Florianópolis');
  assert.deepEqual(review.rules, {
    appendOnly: true,
    preserveExistingOptions: true,
    preserveVotes: true,
  });
  assert.deepEqual(
    review.rankings.map(({ rankingId }) => rankingId).sort(),
    expectedRankingIds.sort(),
  );

  const additions = review.rankings.flatMap(({ additions }) => additions);
  assert.equal(additions.length, 237);
  assert.equal(new Set(additions.map(({ neighborhood }) => neighborhood)).size, 53);
  assert.deepEqual([...new Set(additions.map(({ region }) => region))].sort(), expectedRegions);

  for (const ranking of review.rankings) {
    assert.ok(ranking.sources.length > 0, `${ranking.rankingId} has evidence`);
    assert.ok(ranking.sources.every((source) => source.startsWith('https://')));
    assert.ok(ranking.additions.length > 0, `${ranking.rankingId} has additions`);
    assert.equal(
      new Set(ranking.additions.map(({ label }) => normalized(label))).size,
      ranking.additions.length,
      `${ranking.rankingId} has unique labels`,
    );
  }
});

test('the neighborhood ranking supplies every official neighborhood missing from the old list', () => {
  const neighborhoodRanking = review.rankings.find(
    ({ rankingId }) => rankingId === 'bairros-floripa',
  );
  const expectedMissingNeighborhoods = [
    'Abraão',
    'Alto Ribeirão',
    'Armação',
    'Balneário',
    'Barra da Lagoa',
    'Bom Abrigo',
    'Cachoeira do Bom Jesus',
    'Canasvieiras',
    'Canto',
    'Capoeiras',
    'Carianos',
    'Coloninha',
    'Costa da Lagoa',
    'Costeira do Pirajubaé',
    'Daniela',
    'Itaguaçu',
    'Jardim Atlântico',
    'Jardim Capoeiras',
    'José Mendes',
    'Moçambique',
    'Monte Cristo',
    'Monte Verde',
    'Morro das Pedras',
    'Pantanal',
    'Pântano do Sul',
    'Ponta das Canas',
    'Praia Brava',
    'Praia do Forte',
    'Ratones',
    'Rio Vermelho',
    'Saco dos Limões',
    'Saco Grande',
    'Sambaqui',
    'Santinho',
    'Tapera da Base',
    'Vargem do Bom Jesus',
    'Vargem Grande',
    'Vargem Pequena',
  ];

  assert.deepEqual(
    neighborhoodRanking.additions.map(({ label }) => label).sort(),
    expectedMissingNeighborhoods.sort(),
  );
  assert.ok(neighborhoodRanking.sources.some((source) => source.includes('pmf.sc.gov.br')));
});

test('the migration is append-only and proves existing participation is unchanged', () => {
  assert.match(migration, /INSERT INTO ranking_options/);
  assert.match(migration, /floripa_neighborhood_existing_options/);
  assert.match(migration, /floripa_neighborhood_participation/);
  assert.match(migration, /Uma opção anterior foi removida ou alterada/);
  assert.match(migration, /A participação anterior mudou durante a expansão/);
  assert.doesNotMatch(migration, /DELETE\s+FROM\s+ranking_options/i);
  assert.doesNotMatch(migration, /UPDATE\s+ranking_options/i);
  assert.doesNotMatch(
    migration,
    /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:votes|user_double_votes|user_vote_history|ranking_duel_entries|ranking_duel_rounds|ranking_duel_sessions|ranking_top3_selections|ranking_comments)\b/i,
  );
  assert.match(runner, /SET TRANSACTION ISOLATION LEVEL SERIALIZABLE/);
  assert.match(runner, /ON COMMIT DROP/);
  assert.equal(
    packageJson.scripts['db:floripa-neighborhood-expansion'],
    'node scripts/apply-floripa-neighborhood-expansion.mjs',
  );
});

test('the vegan expansion does not restore previously rejected or closed candidates', () => {
  const vegan = review.rankings.find(
    ({ rankingId }) => rankingId === 'restaurantes-veganos-floripa',
  );
  const rejected = [
    'Da Terra Restaurante Natural',
    'Restaurante Ubaiá',
    'Ubaiá',
    'Ubaia Botânico',
    'Lamiró',
    'Fermentaria',
    "Lalu's Veggie",
    'Lual Coqueiros',
    'Botânico Colheita Criativa',
    'Guna',
    'Sweet Cakes Vegan',
  ].map(normalized);

  for (const addition of vegan.additions) {
    assert.ok(!rejected.includes(normalized(addition.label)));
  }
});
