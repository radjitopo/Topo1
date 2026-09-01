import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const batch = JSON.parse(await readFile(new URL('data/rankings-batch-10.json', root), 'utf8'));

const expectedOptions = new Map([
  [
    'bandas-ilha-da-magia',
    [
      'Dazaranha',
      'Expresso Rural',
      'Grupo Engenho',
      'Iriê',
      'Brasil Papaya',
      'John Bala Jones',
      'Phunky Buddha',
      'Pipodélica',
      'Tijuquera',
      'Stonkas y Congas',
      'Aerocirco',
      'Aeroilis',
      'Samambaia Sound Club',
      'Skrotes',
      'End of Pipe',
      'Nós Naldeia',
      'Noahs',
      'Ibejiz',
      'Somato',
      'Karibu',
    ],
  ],
  [
    'bandas-rock-ilha-da-magia',
    [
      'Dazaranha',
      'Expresso Rural',
      'Brasil Papaya',
      'Pipodélica',
      'Aerocirco',
      'Aeroilis',
      'John Bala Jones',
      'Phunky Buddha',
      'Samambaia Sound Club',
      'End of Pipe',
      'Euthanasia',
      'Os Ambervisions',
      'Cabeleira de Berenice',
      'Lixo Orgânico',
      'Pão com Musse',
      'Black Tainhas',
      'Xevi 50',
      'Kratera',
      'Left/Leaving',
      'Tijuquera',
    ],
  ],
]);

test('tenth batch contains both Ilha da Magia band rankings', () => {
  assert.equal(batch.length, 2);
  assert.deepEqual(
    batch.map(({ id }) => id),
    ['bandas-ilha-da-magia', 'bandas-rock-ilha-da-magia'],
  );
  assert.equal(new Set(batch.map(({ image_url: imageUrl }) => imageUrl)).size, 2);

  for (const ranking of batch) {
    assert.equal(ranking.category, 'Música');
    assert.match(ranking.question, /Ilha da Magia\?$/);
    assert.match(ranking.image_url, /^https:\/\/images\.unsplash\.com\/photo-/);
    assert.match(ranking.image_url, /[?&]fit=crop/);
    assert.match(ranking.image_url, /[?&]w=1200/);
    assert.deepEqual(
      ranking.opts.map(({ label }) => label),
      expectedOptions.get(ranking.id),
    );
    assert.deepEqual(
      ranking.opts.map(({ position }) => position),
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
    assert.ok(ranking.opts.every(({ baseline_score: score }) => score === 0));
  }
});

test('Ilha da Magia band rankings have complete editorial metadata', async () => {
  const source = await readFile(new URL('editorial-18.js', root), 'utf8');
  const context = vm.createContext({ editorial: {} });
  vm.runInContext(source, context);

  assert.deepEqual(Object.keys(context.editorial).sort(), [...expectedOptions.keys()].sort());
  for (const id of expectedOptions.keys()) {
    const entry = context.editorial[id];
    assert.ok(entry.about.length > 220);
    assert.equal(entry.facts.length, 2);
    assert.equal(entry.related.length, 3);
    assert.equal(new Set(entry.related).size, 3);
    assert.ok(!entry.related.includes(id));
  }
});

test('tenth batch is connected to the importer and public shell', async () => {
  const [importer, index, devServer] = await Promise.all([
    readFile(new URL('scripts/apply-catalog.mjs', root), 'utf8'),
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('test/dev-server.mjs', root), 'utf8'),
  ]);

  assert.match(importer, /rankings-batch-10\.json/);
  assert.match(importer, /tenthBatchRankings\.length !== 2/);
  assert.match(importer, /newRankings\.length !== 195/);
  assert.match(importer, /Object\.keys\(allTitles\)\.length !== 235/);
  assert.match(index, /editorial-18\.js\?v=20260901-2-compact-duel-first-screen/);
  assert.match(devServer, /editorial-18\.js/);
});
