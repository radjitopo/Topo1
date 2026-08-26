import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { compactSource } from './source-helpers.mjs';

const root = new URL('../', import.meta.url);
const batch = JSON.parse(await readFile(new URL('data/rankings-batch-6.json', root), 'utf8'));
const expectedTitles = new Map([
  ['maiores-times-brasil', 'Qual é o maior time de futebol do Brasil?'],
  ['melhores-musicas-brasileiras', 'Qual é a melhor música brasileira de todos os tempos?'],
  ['red-flags-relacionamento', 'Qual é a maior red flag em um relacionamento?'],
  ['green-flags-relacionamento', 'Qual é a maior green flag em um relacionamento?'],
  ['coisas-irritantes-todo-mundo', 'Qual coisa irritante todo mundo deveria parar de fazer?'],
  ['comidas-infancia', 'Qual comida tem mais gosto de infância?'],
  ['desenhos-anos-90', 'Qual foi o melhor desenho animado dos anos 90?'],
  ['desenhos-anos-2000', 'Qual foi o melhor desenho animado dos anos 2000?'],
  [
    'melhores-inteligencias-artificiais',
    'Qual ferramenta de inteligência artificial é a mais útil?',
  ],
  [
    'profissoes-transformadas-ia',
    'Qual profissão será mais transformada pela inteligência artificial?',
  ],
  ['memes-brasileiros', 'Qual é o melhor meme brasileiro de todos os tempos?'],
  ['aplicativos-indispensaveis', 'Qual aplicativo é indispensável no seu celular?'],
  ['piores-habitos-whatsapp', 'Qual é o pior hábito das pessoas no WhatsApp?'],
  ['maiores-nomes-funk', 'Quem é o maior nome do funk brasileiro?'],
  ['maiores-duplas-sertanejas', 'Qual é a maior dupla sertaneja de todos os tempos?'],
  ['rappers-trappers-brasil', 'Quem é o maior nome do rap e do trap brasileiro?'],
  ['realities-brasileiros', 'Qual é o melhor reality show brasileiro?'],
  ['celebridades-amadas-brasil', 'Qual é a celebridade mais amada do Brasil?'],
  ['celebridades-dividem-opinioes', 'Qual celebridade mais divide opiniões na internet?'],
  ['coisas-fingem-gostar', 'O que todo mundo finge gostar?'],
]);

test('sixth ranking batch has 20 complete and distinct rankings', () => {
  assert.equal(batch.length, 20);
  assert.equal(new Set(batch.map((ranking) => ranking.id)).size, 20);
  assert.equal(new Set(batch.map((ranking) => ranking.image_url)).size, 20);
  assert.doesNotMatch(JSON.stringify(batch), /celebridades? mais odiad/iu);

  for (const ranking of batch) {
    assert.equal(ranking.question, expectedTitles.get(ranking.id));
    assert.ok(ranking.category, `${ranking.id} should have a category`);
    assert.equal(ranking.baseline_votes, 0);
    assert.equal(ranking.opts.length, 20, `${ranking.id} should have 20 options`);
    assert.equal(
      new Set(ranking.opts.map((option) => option.label)).size,
      20,
      `${ranking.id} should not repeat options`,
    );
    assert.deepEqual(
      ranking.opts.map((option) => option.position),
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
    assert.ok(ranking.opts.every((option) => option.baseline_score === 0));
    assert.match(
      ranking.image_url,
      /^https:\/\/images\.unsplash\.com\/photo-[^?]+\?auto=format&fit=crop&w=1200&q=82$/,
    );
  }
});

test('sixth batch does not reuse local ranking ids or covers', async () => {
  const previousFiles = [
    'data/new-rankings.json',
    'data/rankings-batch-2.json',
    'data/rankings-batch-3.json',
    'data/rankings-batch-4.json',
    'data/rankings-batch-5.json',
  ];
  const previous = (
    await Promise.all(
      previousFiles.map((file) => readFile(new URL(file, root), 'utf8').then(JSON.parse)),
    )
  ).flat();
  const previousIds = new Set(previous.map((ranking) => ranking.id));
  const previousImages = new Set(previous.map((ranking) => ranking.image_url));

  for (const ranking of batch) {
    assert.ok(!previousIds.has(ranking.id), `${ranking.id} must be new`);
    assert.ok(!previousImages.has(ranking.image_url), `${ranking.id} must have a new cover`);
  }
});

test('catalog importer and page assets include the sixth batch', async () => {
  const [importer, index, app] = await Promise.all([
    readFile(new URL('scripts/apply-catalog.mjs', root), 'utf8'),
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('app.js', root), 'utf8'),
  ]);

  assert.match(importer, /rankings-batch-6\.json/);
  assert.match(importer, /sixthBatchRankings\.length !== 20/);
  assert.match(importer, /newRankings\.length !== 173/);
  assert.match(importer, /Object\.keys\(allTitles\)\.length !== 213/);
  assert.match(index, /editorial-14\.js/);
  assert.match(index, /app\.js\?v=20260826-43-profile-editorial/);
  assert.match(compactSource(app), /\['Pessoas','Famosos'\]\.includes\(r\.cat\)/);
});

test('every sixth-batch ranking has complete editorial and valid related links', async () => {
  const source = await readFile(new URL('editorial-14.js', root), 'utf8');
  const context = vm.createContext({ editorial: {} });
  vm.runInContext(source, context);

  const localIds = new Set([
    ...Object.keys(JSON.parse(await readFile(new URL('data/titles.json', root), 'utf8'))),
    ...(
      await Promise.all(
        [
          'data/new-rankings.json',
          'data/rankings-batch-2.json',
          'data/rankings-batch-3.json',
          'data/rankings-batch-4.json',
          'data/rankings-batch-5.json',
        ].map((file) => readFile(new URL(file, root), 'utf8').then(JSON.parse)),
      )
    )
      .flat()
      .map((ranking) => ranking.id),
    ...batch.map((ranking) => ranking.id),
  ]);

  assert.deepEqual(Object.keys(context.editorial).sort(), [...expectedTitles.keys()].sort());
  for (const id of expectedTitles.keys()) {
    const item = context.editorial[id];
    assert.ok(item.about.length >= 120, `${id} should have a useful introduction`);
    assert.equal(item.facts.length, 2, `${id} should have two facts`);
    assert.equal(item.related.length, 3, `${id} should have three related rankings`);
    assert.equal(new Set(item.related).size, 3, `${id} should not repeat related rankings`);
    assert.ok(
      item.related.every((relatedId) => localIds.has(relatedId)),
      `${id} should only link to known rankings`,
    );
  }
});
