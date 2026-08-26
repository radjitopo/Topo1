import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const batch = JSON.parse(await readFile(new URL('data/rankings-batch-9.json', root), 'utf8'));

test('ninth batch contains 11 complete Nostalgia rankings', () => {
  assert.equal(batch.length, 11);
  assert.equal(new Set(batch.map((ranking) => ranking.id)).size, 11);
  assert.equal(new Set(batch.map((ranking) => ranking.image_url)).size, 11);

  for (const ranking of batch) {
    assert.equal(ranking.category, 'Nostalgia');
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

test('Coleção Vaga-Lume ranking contains 20 verified classic titles', () => {
  const ranking = batch.find(({ id }) => id === 'livros-colecao-vaga-lume');
  assert.ok(ranking);
  assert.equal(ranking.question, 'Qual livro da Coleção Vaga-Lume mais marcou você?');
  assert.deepEqual(
    ranking.opts.map(({ label }) => label),
    [
      'A Ilha Perdida',
      'O Escaravelho do Diabo',
      'O Mistério do Cinco Estrelas',
      'A Turma da Rua Quinze',
      'O Caso da Borboleta Atíria',
      'O Rapto do Garoto de Ouro',
      'Um Cadáver Ouve Rádio',
      'Sozinha no Mundo',
      'Meninos sem Pátria',
      'Açúcar Amargo',
      'A Árvore que Dava Dinheiro',
      'Spharion',
      'O Feijão e o Sonho',
      'A Serra dos Dois Meninos',
      'Zezinho, o Dono da Porquinha Preta',
      'Os Barcos de Papel',
      'Menino de Asas',
      'Éramos Seis',
      'Coração de Onça',
      'O Gigante de Botas',
    ],
  );
});

test('Nostalgia ids and titles do not collide with the earlier catalog', async () => {
  const earlierFiles = [
    'data/new-rankings.json',
    'data/rankings-batch-2.json',
    'data/rankings-batch-3.json',
    'data/rankings-batch-4.json',
    'data/rankings-batch-5.json',
    'data/rankings-batch-6.json',
    'data/rankings-batch-7.json',
    'data/rankings-batch-8.json',
  ];
  const earlier = (
    await Promise.all(
      earlierFiles.map(async (file) => JSON.parse(await readFile(new URL(file, root), 'utf8'))),
    )
  ).flat();
  const earlierIds = new Set(earlier.map((ranking) => ranking.id));
  const earlierQuestions = new Set(
    earlier.map((ranking) => ranking.question.toLocaleLowerCase('pt-BR')),
  );

  for (const ranking of batch) {
    assert.ok(!earlierIds.has(ranking.id), `${ranking.id} already exists`);
    assert.ok(
      !earlierQuestions.has(ranking.question.toLocaleLowerCase('pt-BR')),
      `${ranking.question} repeats an earlier title`,
    );
  }
});

test('every Nostalgia ranking has complete editorial metadata', async () => {
  const source = await readFile(new URL('editorial-17.js', root), 'utf8');
  const context = vm.createContext({ editorial: {} });
  vm.runInContext(source, context);
  const batchIds = new Set(batch.map(({ id }) => id));

  assert.deepEqual(Object.keys(context.editorial).sort(), [...batchIds].sort());
  for (const ranking of batch) {
    const entry = context.editorial[ranking.id];
    assert.ok(entry.about.length > 180, `${ranking.id} needs a useful introduction`);
    assert.equal(entry.facts.length, 2);
    assert.equal(entry.related.length, 3);
    assert.equal(new Set(entry.related).size, 3);
    assert.ok(!entry.related.includes(ranking.id));
    for (const relatedId of entry.related) {
      assert.ok(batchIds.has(relatedId), `${ranking.id} has an unknown related ranking`);
    }
  }
});

test('Nostalgia is wired into catalog, navigation, moderation and SEO', async () => {
  const [importer, index, app, api, taxonomy] = await Promise.all([
    readFile(new URL('scripts/apply-catalog.mjs', root), 'utf8'),
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('api.js', root), 'utf8'),
    readFile(new URL('seo-taxonomy.js', root), 'utf8'),
  ]);

  assert.match(importer, /rankings-batch-9\.json/);
  assert.match(importer, /ninthBatchRankings\.length !== 11/);
  assert.match(importer, /newRankings\.length !== 173/);
  assert.match(importer, /Object\.keys\(allTitles\)\.length !== 213/);
  assert.match(index, /editorial-17\.js\?v=20260826-1-vagalume/);
  assert.match(index, /app\.js\?v=20260826-37-compact-categories/);
  assert.match(app, /Nostalgia: 'nostalgia'/);
  assert.match(app, /'Nostalgia'/);
  assert.match(api, /'Nostalgia'/);
  assert.match(taxonomy, /'Nostalgia'/);
});
