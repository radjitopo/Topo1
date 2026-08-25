import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

await import(new URL('../topo-local.js', import.meta.url));
const local = globalThis.TopoLocal;
const catalog = JSON.parse(
  await readFile(new URL('../data/local-catalog.json', import.meta.url), 'utf8'),
);

const expectedCategories = local.groupOrder.slice(1);

test('the local seed is a complete 21 by 14 matrix', () => {
  assert.equal(catalog.length, 294);
  assert.equal(new Set(catalog.map((ranking) => ranking.id)).size, 294);
  assert.deepEqual([...new Set(catalog.map((ranking) => ranking.city))], local.cityOrder);

  for (const city of local.cityOrder) {
    const cityRankings = catalog.filter((ranking) => ranking.city === city);
    assert.equal(cityRankings.length, 14, city);
    assert.deepEqual(
      cityRankings.map((ranking) => ranking.localCategory),
      expectedCategories,
      city,
    );
  }
});

test('all 5,861 starting options are usable and unique inside each ranking', () => {
  assert.equal(
    catalog.reduce((total, ranking) => total + ranking.opts.length, 0),
    5861,
  );
  for (const ranking of catalog) {
    assert.ok(ranking.opts.length >= 5 && ranking.opts.length <= 20, ranking.id);
    assert.equal(
      new Set(ranking.opts.map((option) => local.foldText(option.label))).size,
      ranking.opts.length,
      ranking.id,
    );
    assert.ok(
      ranking.opts.every((option) => option.label.trim().length >= 3),
      ranking.id,
    );
    assert.deepEqual(
      ranking.opts.map((option) => option.position),
      Array.from({ length: ranking.opts.length }, (_, index) => index + 1),
      ranking.id,
    );
  }
  assert.deepEqual(
    catalog
      .filter((ranking) => ranking.opts.length < 20)
      .map((ranking) => [ranking.id, ranking.opts.length]),
    [
      ['restaurantes-veganos-manaus', 19],
      ['restaurantes-veganos-guarulhos', 16],
      ['restaurantes-veganos-sao-goncalo', 6],
    ],
  );
});

test('the frontend taxonomy recognizes every generated ranking', () => {
  for (const ranking of catalog) {
    const publicRanking = { id: ranking.id, cat: ranking.category, q: ranking.question };
    assert.equal(local.isLocalRanking(publicRanking), true, ranking.id);
    assert.equal(local.groupForRanking(publicRanking), ranking.localCategory, ranking.id);
    assert.equal(local.cityForRanking(publicRanking), ranking.city, ranking.id);
  }
});

test('the 17 existing rankings keep their current options and votes during the load', () => {
  assert.equal(catalog.filter((ranking) => ranking.preserveExistingOptions).length, 17);
});
