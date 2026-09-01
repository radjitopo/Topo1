import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const batch = JSON.parse(await readFile(new URL('data/rankings-batch-13.json', root), 'utf8'));
const categories = ['Luxo', 'Compras', 'Futebol', 'Animais', 'Viagens'];

test('thirteenth batch creates ten rankings for each approved category', () => {
  assert.equal(batch.length, 50);
  assert.equal(new Set(batch.map(({ id }) => id)).size, 50);
  assert.equal(new Set(batch.map(({ question }) => question)).size, 50);
  assert.equal(new Set(batch.map(({ image_url: imageUrl }) => imageUrl)).size, 50);

  for (const category of categories) {
    assert.equal(
      batch.filter((ranking) => ranking.category === category).length,
      10,
      `${category} must have exactly ten new rankings`,
    );
  }

  for (const ranking of batch) {
    assert.ok(categories.includes(ranking.category));
    assert.match(ranking.id, /^[a-z0-9-]+$/);
    assert.match(ranking.question, /\?$/);
    assert.match(ranking.image_url, /^https:\/\/images\.unsplash\.com\/photo-/);
    assert.match(ranking.image_url, /[?&]fit=crop/);
    assert.match(ranking.image_url, /[?&]w=1200/);
    assert.match(ranking.image_url, /[?&]h=675/);
    assert.match(ranking.image_url, /[?&]q=82/);
    assert.equal(ranking.opts.length, 10);
    assert.equal(new Set(ranking.opts.map(({ label }) => label)).size, 10);
    assert.deepEqual(
      ranking.opts.map(({ position }) => position),
      Array.from({ length: 10 }, (_, index) => index + 1),
    );
    assert.ok(ranking.opts.every(({ baseline_score: score }) => score === 0));
  }
});

test('thirteenth-batch ids and questions do not repeat the earlier catalog', async () => {
  const earlierFiles = (await readdir(new URL('data/', root))).filter(
    (name) =>
      /^(new-rankings|rankings-batch-\d+)\.json$/.test(name) && name !== 'rankings-batch-13.json',
  );
  const earlier = (
    await Promise.all(
      earlierFiles.map((file) => readFile(new URL(`data/${file}`, root), 'utf8').then(JSON.parse)),
    )
  ).flat();
  const earlierIds = new Set(earlier.map(({ id }) => id));
  const earlierQuestions = new Set(
    earlier.map(({ question }) => question.toLocaleLowerCase('pt-BR')),
  );

  for (const ranking of batch) {
    assert.ok(!earlierIds.has(ranking.id), `${ranking.id} already exists`);
    assert.ok(
      !earlierQuestions.has(ranking.question.toLocaleLowerCase('pt-BR')),
      `${ranking.question} repeats an earlier title`,
    );
  }
});

test('new categories, importer and taxonomy migration are connected', async () => {
  const [app, seo, importer, migration, packageJson] = await Promise.all([
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('seo-taxonomy.js', root), 'utf8'),
    readFile(new URL('scripts/apply-catalog.mjs', root), 'utf8'),
    readFile(new URL('migrations/20260901_ranking_categories.sql', root), 'utf8'),
    readFile(new URL('package.json', root), 'utf8').then(JSON.parse),
  ]);

  for (const category of categories) {
    assert.ok(app.includes(`'${category}'`) || app.includes(`${category}:`));
    assert.ok(seo.includes(`'${category}'`));
  }
  assert.match(importer, /rankings-batch-13\.json/);
  assert.match(importer, /thirteenthBatchRankings\.length !== 50/);
  assert.match(importer, /newRankings\.length !== 245/);
  assert.match(importer, /Object\.keys\(allTitles\)\.length !== 285/);
  assert.match(migration, /SET category = 'Compras'/);
  assert.match(migration, /SET category = 'Futebol'/);
  assert.match(migration, /SET category = 'Animais'/);
  assert.match(migration, /SET category = 'Viagens'/);
  assert.equal(packageJson.scripts['catalog:batch13'], 'node scripts/build-batch-13.mjs');
});
