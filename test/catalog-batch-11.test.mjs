import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const batch = JSON.parse(await readFile(new URL('data/rankings-batch-11.json', root), 'utf8'));
const expectedIds = [
  'bandas-rock-progressivo',
  'bandas-indie-rock',
  'bandas-emo',
  'bandas-hardcore',
  'bandas-punk',
  'bandas-grunge',
  'bandas-shoegaze',
  'bandas-pos-punk',
  'bandas-rock-alternativo',
  'bandas-metal-progressivo',
  'bandas-pop-punk',
  'bandas-britpop',
];
const definingOptions = new Map([
  ['bandas-rock-progressivo', ['King Crimson', 'Yes', 'Genesis']],
  ['bandas-indie-rock', ['Radiohead', 'The Smiths', 'Pavement']],
  ['bandas-emo', ['Rites of Spring', 'Sunny Day Real Estate', 'My Chemical Romance']],
  ['bandas-hardcore', ['Black Flag', 'Bad Brains', 'Ratos de Porão']],
  ['bandas-punk', ['Ramones', 'The Clash', 'Cólera']],
  ['bandas-grunge', ['Nirvana', 'Soundgarden', 'Alice in Chains']],
  ['bandas-shoegaze', ['My Bloody Valentine', 'Slowdive', 'Ride']],
  ['bandas-pos-punk', ['Joy Division', 'The Cure', 'Legião Urbana']],
  ['bandas-rock-alternativo', ['Radiohead', 'R.E.M.', 'Pixies']],
  ['bandas-metal-progressivo', ['Dream Theater', 'Tool', 'Opeth']],
  ['bandas-pop-punk', ['Green Day', 'Blink-182', 'Paramore']],
  ['bandas-britpop', ['Oasis', 'Blur', 'Pulp']],
]);

test('eleventh batch creates a coherent family of music-style rankings', () => {
  assert.equal(batch.length, 12);
  assert.deepEqual(
    batch.map(({ id }) => id),
    expectedIds,
  );
  assert.equal(new Set(batch.map(({ image_url: imageUrl }) => imageUrl)).size, batch.length);

  for (const ranking of batch) {
    assert.equal(ranking.category, 'Música');
    assert.match(ranking.question, /^Qual é a maior banda .+\?$/);
    assert.match(ranking.image_url, /^https:\/\/images\.unsplash\.com\/photo-/);
    assert.match(ranking.image_url, /[?&]fit=crop/);
    assert.match(ranking.image_url, /[?&]w=1200/);
    assert.match(ranking.image_url, /[?&]q=82/);
    assert.equal(ranking.opts.length, 20);
    assert.equal(new Set(ranking.opts.map(({ label }) => label)).size, 20);
    assert.deepEqual(
      ranking.opts.map(({ position }) => position),
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
    assert.ok(ranking.opts.every(({ baseline_score: score }) => score === 0));
    for (const label of definingOptions.get(ranking.id)) {
      assert.ok(
        ranking.opts.some((option) => option.label === label),
        `${ranking.id} must include ${label}`,
      );
    }
  }
});

test('music-style rankings have complete editorial metadata and valid related links', async () => {
  const source = await readFile(new URL('editorial-19.js', root), 'utf8');
  const context = vm.createContext({ editorial: {} });
  vm.runInContext(source, context);
  assert.deepEqual(Object.keys(context.editorial).sort(), [...expectedIds].sort());

  const knownIds = new Set(
    Object.keys(JSON.parse(await readFile(new URL('data/titles.json', root), 'utf8'))),
  );
  const dataFiles = (await readdir(new URL('data/', root))).filter((name) =>
    /^(new-rankings|rankings-batch-\d+)\.json$/.test(name),
  );
  for (const filename of dataFiles) {
    const rankings = JSON.parse(await readFile(new URL(`data/${filename}`, root), 'utf8'));
    for (const ranking of rankings) knownIds.add(ranking.id);
  }

  for (const id of expectedIds) {
    const entry = context.editorial[id];
    assert.ok(entry.about.length > 280);
    assert.equal(entry.facts.length, 2);
    assert.equal(entry.related.length, 3);
    assert.equal(new Set(entry.related).size, 3);
    assert.ok(!entry.related.includes(id));
    for (const relatedId of entry.related) {
      assert.ok(knownIds.has(relatedId), `${id} links to unknown ranking ${relatedId}`);
    }
  }
});

test('eleventh batch is connected to the importer and public shell', async () => {
  const [importer, index, devServer, source] = await Promise.all([
    readFile(new URL('scripts/apply-catalog.mjs', root), 'utf8'),
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('test/dev-server.mjs', root), 'utf8'),
    readFile(new URL('editorial-19.js', root), 'utf8'),
  ]);

  assert.match(importer, /rankings-batch-11\.json/);
  assert.match(importer, /eleventhBatchRankings\.length !== 12/);
  assert.match(importer, /newRankings\.length !== 195/);
  assert.match(importer, /Object\.keys\(allTitles\)\.length !== 235/);
  assert.match(index, /editorial-19\.js\?v=20260901-3-duel-without-option-photos/);
  assert.match(source, /min-height:168px/);
  assert.match(source, /height:56px/);
  assert.match(devServer, /editorial-19\.js/);
});
