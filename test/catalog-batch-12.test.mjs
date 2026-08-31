import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const batch = JSON.parse(await readFile(new URL('data/rankings-batch-12.json', root), 'utf8'));
const expectedIds = [
  'melhor-jogador-futebol-todos-tempos',
  'melhores-goleiros-historia',
  'melhores-zagueiros-historia',
  'melhores-laterais-historia',
  'melhores-meio-campistas-historia',
  'melhores-camisas-10-historia',
  'melhores-atacantes-historia',
  'melhores-tecnicos-futebol-historia',
];
const definingOptions = new Map([
  ['melhor-jogador-futebol-todos-tempos', ['Pelé', 'Lionel Messi', 'Diego Maradona']],
  ['melhores-goleiros-historia', ['Lev Yashin', 'Gianluigi Buffon', 'Rogério Ceni']],
  ['melhores-zagueiros-historia', ['Franz Beckenbauer', 'Franco Baresi', 'Domingos da Guia']],
  ['melhores-laterais-historia', ['Cafu', 'Roberto Carlos', 'Nilton Santos']],
  ['melhores-meio-campistas-historia', ['Zinedine Zidane', 'Xavi', 'Falcão']],
  ['melhores-camisas-10-historia', ['Pelé', 'Diego Maradona', 'Zico']],
  ['melhores-atacantes-historia', ['Ronaldo Nazário', 'Romário', 'Gerd Müller']],
  ['melhores-tecnicos-futebol-historia', ['Alex Ferguson', 'Rinus Michels', 'Telê Santana']],
]);

test('twelfth batch creates the eight approved historical football rankings', () => {
  assert.equal(batch.length, 8);
  assert.deepEqual(
    batch.map(({ id }) => id),
    expectedIds,
  );
  assert.equal(new Set(batch.map(({ id }) => id)).size, batch.length);
  assert.equal(new Set(batch.map(({ question }) => question)).size, batch.length);
  assert.equal(new Set(batch.map(({ image_url: imageUrl }) => imageUrl)).size, batch.length);

  for (const ranking of batch) {
    assert.equal(ranking.category, 'Esporte');
    assert.match(ranking.id, /^[a-z0-9-]+$/);
    assert.match(ranking.question, /^Quem é o melhor .+ de todos os tempos\?$/);
    assert.match(ranking.image_url, /^https:\/\/images\.unsplash\.com\/photo-/);
    assert.match(ranking.image_url, /[?&]fit=crop/);
    assert.match(ranking.image_url, /[?&]w=1200/);
    assert.match(ranking.image_url, /[?&]h=675/);
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

test('historical football rankings do not collide with the earlier catalog', async () => {
  const dataFiles = (await readdir(new URL('data/', root))).filter(
    (name) =>
      /^(new-rankings|rankings-batch-\d+)\.json$/.test(name) && name !== 'rankings-batch-12.json',
  );
  const earlier = (
    await Promise.all(
      dataFiles.map((file) => readFile(new URL(`data/${file}`, root), 'utf8').then(JSON.parse)),
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

test('historical football rankings have complete editorial metadata', async () => {
  const source = await readFile(new URL('editorial-20.js', root), 'utf8');
  const context = vm.createContext({ editorial: {} });
  vm.runInContext(source, context);
  assert.deepEqual(Object.keys(context.editorial).sort(), [...expectedIds].sort());

  const knownIds = new Set(
    Object.keys(JSON.parse(await readFile(new URL('data/titles.json', root), 'utf8'))),
  );
  knownIds.add('jogadoras-futebol');
  knownIds.add('melhores-jogadores-sao-paulo');
  const dataFiles = (await readdir(new URL('data/', root))).filter((name) =>
    /^(new-rankings|rankings-batch-\d+)\.json$/.test(name),
  );
  for (const filename of dataFiles) {
    const rankings = JSON.parse(await readFile(new URL(`data/${filename}`, root), 'utf8'));
    for (const ranking of rankings) knownIds.add(ranking.id);
  }

  for (const id of expectedIds) {
    const entry = context.editorial[id];
    assert.ok(entry.about.length > 250, `${id} needs a useful introduction`);
    assert.equal(entry.facts.length, 2);
    assert.equal(entry.related.length, 3);
    assert.equal(new Set(entry.related).size, 3);
    assert.ok(!entry.related.includes(id));
    for (const relatedId of entry.related) {
      assert.ok(knownIds.has(relatedId), `${id} links to unknown ranking ${relatedId}`);
    }
  }
});

test('twelfth batch is connected to the importer and public shell', async () => {
  const [importer, index, devServer] = await Promise.all([
    readFile(new URL('scripts/apply-catalog.mjs', root), 'utf8'),
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('test/dev-server.mjs', root), 'utf8'),
  ]);

  assert.match(importer, /rankings-batch-12\.json/);
  assert.match(importer, /twelfthBatchRankings\.length !== 8/);
  assert.match(importer, /newRankings\.length !== 195/);
  assert.match(importer, /Object\.keys\(allTitles\)\.length !== 235/);
  assert.match(index, /editorial-20\.js\?v=20260831-1-football-legends/);
  assert.match(devServer, /editorial-20\.js/);
});
