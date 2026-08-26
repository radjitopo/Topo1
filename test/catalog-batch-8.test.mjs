import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const batch = JSON.parse(await readFile(new URL('data/rankings-batch-8.json', root), 'utf8'));

test('eighth batch contains the Instagram celebrity beer ranking', () => {
  assert.equal(batch.length, 1);
  const [ranking] = batch;
  assert.equal(ranking.id, 'celebridades-cerveja');
  assert.equal(ranking.category, 'Famosos');
  assert.equal(ranking.question, 'Com qual celebridade você tomaria uma cerveja?');
  assert.equal(ranking.image_url, 'https://somostopo.com.br/social/celebridades-cerveja.jpg');
  assert.equal(ranking.opts.length, 20);
  assert.equal(new Set(ranking.opts.map((option) => option.label)).size, 20);
  assert.deepEqual(
    ranking.opts.map((option) => option.position),
    Array.from({ length: 20 }, (_, index) => index + 1),
  );
});

test('eighth batch id does not collide with the earlier catalog', async () => {
  const earlierFiles = [
    'data/new-rankings.json',
    'data/rankings-batch-2.json',
    'data/rankings-batch-3.json',
    'data/rankings-batch-4.json',
    'data/rankings-batch-5.json',
    'data/rankings-batch-6.json',
    'data/rankings-batch-7.json',
  ];
  const earlier = (
    await Promise.all(
      earlierFiles.map(async (file) => JSON.parse(await readFile(new URL(file, root), 'utf8'))),
    )
  ).flat();
  const earlierIds = new Set(earlier.map((ranking) => ranking.id));
  assert.ok(!earlierIds.has(batch[0].id));
});

test('celebrity beer ranking has complete editorial metadata', async () => {
  const source = await readFile(new URL('editorial-16.js', root), 'utf8');
  const context = vm.createContext({ editorial: {} });
  vm.runInContext(source, context);
  const entry = context.editorial['celebridades-cerveja'];
  assert.ok(entry.about.length > 180);
  assert.equal(entry.facts.length, 2);
  assert.equal(entry.related.length, 3);
});

test('catalog importer and page assets include the eighth batch', async () => {
  const [importer, index, vercel] = await Promise.all([
    readFile(new URL('scripts/apply-catalog.mjs', root), 'utf8'),
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('vercel.json', root), 'utf8'),
  ]);
  assert.match(importer, /rankings-batch-8\.json/);
  assert.match(importer, /eighthBatchRankings\.length !== 1/);
  assert.match(importer, /newRankings\.length !== 173/);
  assert.match(importer, /Object\.keys\(allTitles\)\.length !== 213/);
  assert.match(index, /editorial-16\.js/);
  assert.match(vercel, /social\/\*\.jpg/);
});
