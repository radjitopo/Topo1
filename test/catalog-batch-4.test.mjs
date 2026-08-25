import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compactSource } from './source-helpers.mjs';

const root = new URL('../', import.meta.url);
const batch = JSON.parse(await readFile(new URL('data/rankings-batch-4.json', root), 'utf8'));
const expectedTitles = new Map([
  ['desastres-date', 'Qual é o pior desastre que pode acontecer num date?'],
  ['pokemons-irados', 'Os Pokémon mais irados de todos os tempos'],
  ['remedios-rotina', 'Qual remédio mais aparece na farmacinha de casa?'],
  ['piores-pandemia', 'O que foi pior na pandemia?'],
  ['habitos-masculinos', 'Qual hábito masculino mais tira você do sério?'],
  ['ditadores-crueis', 'Os ditadores mais cruéis da história'],
  ['vozes-samba', 'As maiores vozes do samba brasileiro'],
  ['filhos-fofos', 'Filhos em modo fofura: o que mais derrete o coração?'],
  ['filhos-irritantes', 'O que os filhos fazem que mais tira os pais do sério?'],
]);

test('fourth ranking batch is complete and internally consistent', () => {
  assert.equal(batch.length, 9);
  assert.equal(new Set(batch.map((ranking) => ranking.id)).size, batch.length);

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
    assert.match(ranking.image_url, /^https:\/\/images\.unsplash\.com\/photo-/);
  }
});

test('catalog importer and editorial bundle include the fourth batch', async () => {
  const [importer, editorial, index, app] = await Promise.all([
    readFile(new URL('scripts/apply-catalog.mjs', root), 'utf8'),
    readFile(new URL('editorial-12.js', root), 'utf8'),
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('app.js', root), 'utf8'),
  ]);

  assert.match(importer, /rankings-batch-4\.json/);
  assert.match(importer, /newRankings\.length !== 162/);
  assert.match(importer, /Object\.keys\(allTitles\)\.length !== 202/);
  assert.match(index, /editorial-12\.js/);
  assert.match(compactSource(app), /'pokemons-irados':'Jogos'/);

  for (const id of expectedTitles.keys()) {
    assert.match(editorial, new RegExp(`"${id}"`));
  }
});
