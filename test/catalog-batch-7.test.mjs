import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const batch = JSON.parse(await readFile(new URL('data/rankings-batch-7.json', root), 'utf8'));
const expectedCategoryCounts = {
  Cinema: 5,
  'TV & Séries': 3,
  Livros: 10,
  Arte: 9,
  Moda: 5,
  Famosos: 5,
  Natureza: 2,
  Motores: 10,
  Jogos: 3,
  Tecnologia: 6,
  Produtos: 3,
};

test('seventh batch contains the planned 61 Top 20 rankings', () => {
  assert.equal(batch.length, 61);
  assert.equal(new Set(batch.map((ranking) => ranking.id)).size, 61);
  assert.equal(new Set(batch.map((ranking) => ranking.image_url)).size, 61);

  const categoryCounts = Object.fromEntries(
    Object.keys(expectedCategoryCounts).map((category) => [
      category,
      batch.filter((ranking) => ranking.category === category).length,
    ]),
  );
  assert.deepEqual(categoryCounts, expectedCategoryCounts);

  for (const ranking of batch) {
    assert.match(ranking.id, /^[a-z0-9-]+$/);
    assert.match(ranking.question, /\?$/);
    assert.match(ranking.image_url, /^https:\/\/images\.unsplash\.com\/photo-/);
    assert.match(ranking.image_url, /[?&]fit=crop/);
    assert.match(ranking.image_url, /[?&]w=1200/);
    assert.equal(ranking.opts.length, 20, `${ranking.id} must be a Top 20`);
    assert.equal(
      new Set(ranking.opts.map((option) => option.label)).size,
      20,
      `${ranking.id} must not repeat options`,
    );
    assert.deepEqual(
      ranking.opts.map((option) => option.position),
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
  }
});

test('seventh batch ids do not collide with the earlier catalog', async () => {
  const earlierFiles = [
    'data/new-rankings.json',
    'data/rankings-batch-2.json',
    'data/rankings-batch-3.json',
    'data/rankings-batch-4.json',
    'data/rankings-batch-5.json',
    'data/rankings-batch-6.json',
  ];
  const earlier = (
    await Promise.all(
      earlierFiles.map(async (file) => JSON.parse(await readFile(new URL(file, root), 'utf8'))),
    )
  ).flat();
  const earlierIds = new Set(earlier.map((ranking) => ranking.id));
  for (const ranking of batch) {
    assert.ok(!earlierIds.has(ranking.id), `${ranking.id} already exists in an earlier batch`);
  }
});

test('every seventh-batch ranking has complete editorial metadata', async () => {
  const source = await readFile(new URL('editorial-15.js', root), 'utf8');
  const context = vm.createContext({ editorial: {} });
  vm.runInContext(source, context);

  assert.deepEqual(Object.keys(context.editorial).sort(), batch.map(({ id }) => id).sort());
  const batchIds = new Set(batch.map(({ id }) => id));
  for (const ranking of batch) {
    const entry = context.editorial[ranking.id];
    assert.ok(entry.about.length > 180, `${ranking.id} needs a useful introduction`);
    assert.equal(entry.facts.length, 2);
    assert.equal(entry.related.length, 3);
    assert.equal(new Set(entry.related).size, 3);
    assert.ok(!entry.related.includes(ranking.id));
    for (const relatedId of entry.related) {
      if (expectedCategoryCounts[ranking.category] >= 4) {
        assert.ok(batchIds.has(relatedId), `${ranking.id} has an unknown related ranking`);
      }
    }
  }
});

test('catalog importer and page assets include the seventh batch', async () => {
  const [importer, index, app] = await Promise.all([
    readFile(new URL('scripts/apply-catalog.mjs', root), 'utf8'),
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('app.js', root), 'utf8'),
  ]);

  assert.match(importer, /rankings-batch-7\.json/);
  assert.match(importer, /seventhBatchRankings\.length !== 61/);
  assert.match(importer, /newRankings\.length !== 187/);
  assert.match(importer, /Object\.keys\(allTitles\)\.length !== 227/);
  assert.match(index, /editorial-15\.js/);
  assert.match(index, /app\.js\?v=20260827-1-vip-area/);
  for (const category of ['Arte', 'Motores', 'Tecnologia', 'Produtos', 'TV & Séries']) {
    assert.ok(app.includes(`'${category}'`), `app must preserve the ${category} group`);
  }
});
