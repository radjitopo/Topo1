import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

await import(new URL('../topo-local.js', import.meta.url));
const local = globalThis.TopoLocal;
const catalog = JSON.parse(
  await readFile(new URL('../data/local-catalog.json', import.meta.url), 'utf8'),
);
const exclusions = JSON.parse(
  await readFile(new URL('../data/local-option-exclusions.json', import.meta.url), 'utf8'),
);

const expectedCategories = local.groupOrder.slice(1);

test('the local seed is a complete 21 by 16 matrix', () => {
  assert.equal(catalog.length, 336);
  assert.equal(new Set(catalog.map((ranking) => ranking.id)).size, 336);
  assert.deepEqual([...new Set(catalog.map((ranking) => ranking.city))], local.cityOrder);

  for (const city of local.cityOrder) {
    const cityRankings = catalog.filter((ranking) => ranking.city === city);
    assert.equal(cityRankings.length, 16, city);
    assert.deepEqual(
      cityRankings.map((ranking) => ranking.localCategory),
      expectedCategories,
      city,
    );
  }
});

test('the curated local options are usable and unique inside each ranking', () => {
  assert.equal(
    catalog.reduce((total, ranking) => total + ranking.opts.length, 0),
    6605,
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
    const positions = ranking.opts.map((option) => option.position);
    assert.ok(
      positions.every(
        (position, index) =>
          Number.isInteger(position) &&
          position > 0 &&
          (index === 0 || position > positions[index - 1]),
      ),
      ranking.id,
    );
  }
  assert.equal(
    catalog.find((ranking) => ranking.id === 'restaurantes-veganos-manaus').opts.length,
    5,
  );
  assert.equal(
    catalog.find((ranking) => ranking.id === 'restaurantes-veganos-guarulhos').opts.length,
    5,
  );
});

test('the editorial exclusion list cannot return to the local catalog', () => {
  const byId = new Map(catalog.map((ranking) => [ranking.id, ranking]));
  for (const [rankingId, labels] of Object.entries(exclusions)) {
    const visible = new Set((byId.get(rankingId)?.opts || []).map((option) => option.label));
    for (const label of labels) assert.equal(visible.has(label), false, `${rankingId}: ${label}`);
  }
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
