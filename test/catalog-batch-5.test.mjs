import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compactSource } from './source-helpers.mjs';

const root = new URL('../', import.meta.url);
const batch = JSON.parse(await readFile(new URL('data/rankings-batch-5.json', root), 'utf8'));
const expectedTitles = new Map([
  ['superpoder-incrivel', 'Qual superpoder seria o mais incrível?'],
  ['coisas-escola', 'O que só quem está na escola entende?'],
  ['jogos-com-amigos', 'Qual é o melhor jogo para jogar com os amigos?'],
  ['jogos-roblox', 'Qual é o melhor jogo do Roblox?'],
  ['desenhos-obrigatorios', 'Desenhos animados que todo mundo deveria assistir'],
  ['mundos-games-morar', 'Em qual mundo dos games seria mais legal morar?'],
  ['personagens-anime-poderes', 'Qual personagem de anime tem o poder mais incrível?'],
  ['dinossauros-irados', 'Qual dinossauro é o mais irado de todos?'],
  ['animais-superpoderes', 'Animais que parecem ter superpoderes'],
  ['piores-dia-aula', 'O que mais estraga um dia de aula?'],
  ['quarto-dos-sonhos', 'O quarto dos sonhos: o que não pode faltar?'],
  ['criaturas-fantasticas-pet', 'Qual criatura fantástica seria o melhor bichinho?'],
  ['lanches-recreio', 'Lanches que salvam o recreio'],
  ['ferias-mais-legais', 'O que não pode faltar nas férias perfeitas?'],
  ['surpresas-professor', 'As piores surpresas que o professor pode anunciar'],
  ['festa-do-pijama', 'O que não pode faltar numa festa do pijama?'],
  ['misterios-do-espaco', 'Os maiores mistérios do espaço'],
  ['frases-adultos-irritantes', 'Frases dos adultos que mais irritam'],
  ['presentes-aniversario', 'Qual presente você mais gostaria de ganhar?'],
  ['hobbies-para-comecar', 'Qual hobby você mais admira?'],
]);

test('fifth ranking batch has 20 complete rankings', () => {
  assert.equal(batch.length, 20);
  assert.equal(new Set(batch.map((ranking) => ranking.id)).size, 20);
  assert.equal(new Set(batch.map((ranking) => ranking.image_url)).size, 20);

  for (const ranking of batch) {
    assert.equal(ranking.question, expectedTitles.get(ranking.id));
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
    assert.match(ranking.image_url, /^https:\/\/images\.unsplash\.com\/photo-/);
  }
});

test('catalog importer, categories and editorial include the fifth batch', async () => {
  const [importer, editorial, index, app] = await Promise.all([
    readFile(new URL('scripts/apply-catalog.mjs', root), 'utf8'),
    readFile(new URL('editorial-13.js', root), 'utf8'),
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('app.js', root), 'utf8'),
  ]);

  assert.match(importer, /rankings-batch-5\.json/);
  assert.match(importer, /fifthBatchRankings\.length !== 20/);
  assert.match(importer, /newRankings\.length !== 100/);
  assert.match(importer, /Object\.keys\(allTitles\)\.length !== 140/);
  assert.match(index, /editorial-13\.js/);
  assert.match(index, /app\.js\?v=20260824-29-pop/);
  assert.match(compactSource(app), /'Jogos','Natureza'/);

  for (const id of expectedTitles.keys()) {
    assert.match(editorial, new RegExp(`"${id}"`));
  }
});
