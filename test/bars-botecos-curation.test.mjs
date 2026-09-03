import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const review = JSON.parse(
  await readFile(new URL('../data/local-bars-botecos-2026-09.json', import.meta.url), 'utf8'),
);
const catalog = JSON.parse(
  await readFile(new URL('../data/local-catalog.json', import.meta.url), 'utf8'),
);

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

test('the editorial split covers all 21 cities with 20 choices per ranking', () => {
  assert.equal(review.reviewKey, 'local-bars-botecos-2026-09-v1');
  assert.deepEqual(review.scope, {
    cityCount: 21,
    rankingCount: 42,
    optionsPerRanking: 20,
    municipalityStrict: true,
    barsDefinition:
      'Coquetelarias, gastrobares, pubs, rooftops, casas de vinho e cervejarias com experiência de bar.',
    botecosDefinition:
      'Casas populares ou tradicionais, de balcão, cerveja, petiscos e identidade de bairro.',
  });
  assert.equal(review.cities.length, 21);
  assert.equal(new Set(review.cities.map((city) => city.city)).size, 21);
  assert.equal(new Set(review.cities.map((city) => city.slug)).size, 21);

  for (const city of review.cities) {
    assert.equal(city.bars.length, 20, `${city.city}: bares`);
    assert.equal(city.botecos.length, 20, `${city.city}: botecos`);
    assert.ok(city.sources.length > 0, `${city.city}: fontes`);
    assert.ok(
      city.sources.every((source) => /^https:\/\//.test(source)),
      `${city.city}: fontes`,
    );
    const bars = city.bars.map(fold);
    const botecos = city.botecos.map(fold);
    assert.equal(new Set(bars).size, 20, `${city.city}: bares repetidos`);
    assert.equal(new Set(botecos).size, 20, `${city.city}: botecos repetidos`);
    assert.deepEqual(
      bars.filter((label) => botecos.includes(label)),
      [],
      `${city.city}: nome presente nas duas categorias`,
    );
  }
});

test('the generated catalog contains the approved bars and botecos in editorial order', () => {
  const byId = new Map(catalog.map((ranking) => [ranking.id, ranking]));
  for (const city of review.cities) {
    const bars = byId.get(`bares-${city.slug}`);
    const botecos = byId.get(`botecos-${city.slug}`);
    assert.equal(bars?.localCategory, 'Bares', city.city);
    assert.equal(botecos?.localCategory, 'Botecos', city.city);
    assert.equal(bars?.question, `Qual é o melhor bar em ${city.city}?`, city.city);
    assert.equal(botecos?.question, `Qual é o melhor boteco em ${city.city}?`, city.city);
    assert.deepEqual(
      bars?.opts.map((option) => option.label),
      city.bars,
      `${city.city}: bares`,
    );
    assert.deepEqual(
      botecos?.opts.map((option) => option.label),
      city.botecos,
      `${city.city}: botecos`,
    );
  }
});
