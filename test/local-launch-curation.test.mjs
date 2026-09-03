import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [refresh, catalog, generator, builder, veganFloripa, cafesFloripa] = await Promise.all([
  readFile(new URL('../data/local-launch-curation-2026-09.json', import.meta.url), 'utf8').then(
    JSON.parse,
  ),
  readFile(new URL('../data/local-catalog.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../scripts/generate-local-launch-curation.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/build-local-catalog.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../data/vegan-floripa-refresh.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../data/cafes-floripa-refresh.json', import.meta.url), 'utf8').then(JSON.parse),
]);

function fold(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

test('the launch curation covers exactly 20 non-Florianópolis cities and 320 rankings', () => {
  assert.equal(refresh.reviewKey, 'local-launch-curation-2026-09-v2');
  assert.deepEqual(refresh.scope, {
    excludedCity: 'Florianópolis',
    cityCount: 20,
    rankingCount: 320,
    minimumOptionsPerRanking: 5,
    maximumOptionsPerRanking: 20,
    resetParticipation: true,
  });
  assert.equal(refresh.rankings.length, 320);
  assert.equal(new Set(refresh.rankings.map((ranking) => ranking.rankingId)).size, 320);
  assert.equal(new Set(refresh.rankings.map((ranking) => ranking.city)).size, 20);
  assert.equal(
    refresh.rankings.some((ranking) => ranking.city === 'Florianópolis'),
    false,
  );

  for (const city of new Set(refresh.rankings.map((ranking) => ranking.city))) {
    assert.equal(refresh.rankings.filter((ranking) => ranking.city === city).length, 16, city);
  }
});

test('common rankings have 20 candidates and scarce vegan lists never use padding', () => {
  assert.equal(
    refresh.rankings.reduce((total, ranking) => total + ranking.options.length, 0),
    6352,
  );
  for (const ranking of refresh.rankings) {
    assert.ok(ranking.options.length >= 5 && ranking.options.length <= 20, ranking.rankingId);
    if (ranking.categoryKey !== 'vegan')
      assert.equal(ranking.options.length, 20, ranking.rankingId);
    assert.equal(
      new Set(ranking.options.map(fold)).size,
      ranking.options.length,
      ranking.rankingId,
    );
    assert.equal(
      ranking.options.every((label) => label === label.trim()),
      true,
      ranking.rankingId,
    );
  }
});

test('curated labels exclude generic, placeholder and obvious specialty conflicts', () => {
  const generic = new Set(
    [
      'restaurante',
      'bar',
      'café',
      'cafeteria',
      'academia',
      'pet shop',
      'barbearia',
      'salão de beleza',
      'padaria',
      'pizzaria',
      'hamburgueria',
      'hambúrgueria',
      'hamburguer',
      'hambúrguer',
      'burger',
      'burguer',
      'brechó',
      'buffet',
    ].map(fold),
  );
  for (const ranking of refresh.rankings) {
    for (const label of ranking.options) {
      assert.equal(generic.has(fold(label)), false, `${ranking.rankingId}: ${label}`);
      assert.doesNotMatch(label, /^\(?\s*em breve\b|nova franquia|desativad[oa]/i);
      if (ranking.categoryKey === 'sushi') {
        assert.doesNotMatch(label, /coco bambu|fogo campeiro|churrascaria/i);
      }
      if (ranking.categoryKey === 'italian') {
        assert.doesNotMatch(label, /coco bambu|\bsushi\b|japon[eê]s|\bryori\b|santa grelha/i);
      }
    }
  }
});

test('food rankings do not fall back to mass-market chains', () => {
  const excludedByCategory = {
    restaurants:
      /burger king|burguer king|mcdonald|outback|domino|pizza hut|giraffas|habib'?s|subway|\bkfc\b|casa bauducco|coco bambu|rei do mate|spoleto|johnny rockets/i,
    pizza: /domino|pizza hut/i,
    burger: /burger king|burguer king|mcdonald|johnny rockets|\bbob'?s\b|madero|jeronimo/i,
    cafe: /rei do mate|havanna|bacio di latte|starbucks|casa bauducco/i,
    italian: /spoleto|domino|pizza hut|olive garden|pecorino|abbraccio/i,
    bakery: /casa bauducco|sodiê|fábrica de bolos/i,
  };
  for (const ranking of refresh.rankings) {
    const excluded = excludedByCategory[ranking.categoryKey];
    if (!excluded) continue;
    for (const label of ranking.options) {
      assert.doesNotMatch(label, excluded, `${ranking.rankingId}: ${label}`);
    }
  }
});

test('a brand occupies at most one position in each ranking', () => {
  const branchBrands = [
    'lemax',
    'coffeetown',
    'sushi ponta negra',
    'pés patas',
    'ph d sports',
    'companhia athletica',
    'peça rara',
    'ultra',
    'acuas',
    'boteco do manolo',
    'rodo grill',
    'libélula',
  ].map(fold);
  for (const ranking of refresh.rankings) {
    const labels = ranking.options.map(fold);
    for (const brand of branchBrands) {
      assert.ok(
        labels.filter((label) => label.includes(brand)).length <= 1,
        `${ranking.rankingId}: ${brand}`,
      );
    }
  }
});

test('the reviewed overlay is exactly reflected by the local catalog', () => {
  const catalogById = new Map(catalog.map((ranking) => [ranking.id, ranking]));
  for (const reviewed of refresh.rankings) {
    const ranking = catalogById.get(reviewed.rankingId);
    assert.ok(ranking, reviewed.rankingId);
    assert.equal(ranking.city, reviewed.city);
    assert.equal(ranking.question, reviewed.question);
    assert.equal(ranking.localCategory, reviewed.categoryLabel);
    assert.equal(ranking.baseline_votes, 0);
    assert.equal(ranking.preserveExistingOptions, false);
    assert.deepEqual(
      ranking.opts.map((option) => option.label),
      reviewed.options,
      reviewed.rankingId,
    );
    assert.equal(
      ranking.opts.every((option) => option.baseline_score === 0),
      true,
    );
  }
});

test('Florianópolis keeps its dedicated audited lists and is excluded from the reset overlay', () => {
  const byId = new Map(catalog.map((ranking) => [ranking.id, ranking]));
  assert.deepEqual(
    byId.get(veganFloripa.rankingId).opts.map((option) => option.label),
    veganFloripa.options,
  );
  assert.equal(
    byId.get(veganFloripa.rankingId).localCategory,
    'Restaurante/lanchonete vegano/vegetariano',
  );
  assert.deepEqual(
    byId.get(cafesFloripa.rankingId).opts.map((option) => option.label),
    cafesFloripa.options,
  );
  assert.equal(
    refresh.rankings.some((ranking) => ranking.rankingId.endsWith('-floripa')),
    false,
  );
});

test('future catalog builds retain the reviewed overlay', () => {
  assert.match(generator, /baseCatalogRevision/);
  assert.match(builder, /local-launch-curation-2026-09\.json/);
  assert.match(builder, /localLaunchById/);
  assert.match(builder, /LOCAL_PUBLIC_MINIMUM_OPTION_COUNT = 5/);
});
