import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { rankingQuestion, rankingTitleOverrides } from '../ranking-titles.js';

const catalogFiles = [
  'data/new-rankings.json',
  'data/rankings-batch-2.json',
  'data/rankings-batch-3.json',
  'data/rankings-batch-4.json',
  'data/rankings-batch-5.json',
  'data/rankings-batch-6.json',
];

test('editorial review keeps 56 approved titles in one canonical map', async () => {
  const knownIds = new Set(
    Object.keys(
      JSON.parse(await readFile(new URL('../data/titles.json', import.meta.url), 'utf8')),
    ),
  );
  const legacyLiveIds = [
    'comfort-foods',
    'esportes-radicais',
    'moda-polemica',
    'discos-rock',
    'grupos-kpop',
    'plantas-dificeis',
    'jogos-celular',
    'animais-venenosos',
    'drinks-classicos',
    'animes',
    'piores-empregos',
    'roupas-voltar-moda',
    'sapatos-polemicos',
    'ruas-incriveis',
  ];
  for (const id of legacyLiveIds) knownIds.add(id);

  for (const file of catalogFiles) {
    const rankings = JSON.parse(await readFile(new URL(`../${file}`, import.meta.url), 'utf8'));
    for (const ranking of rankings) knownIds.add(ranking.id);
  }

  const citySource = await readFile(
    new URL('../scripts/apply-city-rankings.mjs', import.meta.url),
    'utf8',
  );
  for (const match of citySource.matchAll(/\branking\(\s*['"]([^'"]+)['"]/g)) {
    knownIds.add(match[1]);
  }

  assert.equal(Object.keys(rankingTitleOverrides).length, 56);
  for (const [id, title] of Object.entries(rankingTitleOverrides)) {
    assert.ok(knownIds.has(id), `${id} must belong to the known ranking catalog`);
    assert.match(title, /\?$/, `${id} must invite a direct answer`);
  }
});

test('editorial title helper overrides approved rankings and preserves every other title', () => {
  assert.equal(
    rankingQuestion('hamburguer-floripa', 'old title'),
    'Quem faz o melhor hambúrguer de Florianópolis?',
  );
  assert.equal(
    rankingQuestion('hobbies-para-comecar', 'old title'),
    'Qual hobby você gostaria de começar?',
  );
  assert.equal(rankingQuestion('ranking-sem-revisao', 'Título original'), 'Título original');
});

test('ambiguous expressions removed by the approved review do not return', () => {
  const titles = Object.values(rankingTitleOverrides).join('\n').toLocaleLowerCase('pt-BR');
  for (const expression of [
    'hambúrguer mais absurdo',
    'hambúrguer mais desejado',
    'mais viciantes',
    'mais difíceis de parar',
    'impossíveis de largar',
    'entrega a melhor experiência',
    'reina no rio',
  ]) {
    assert.ok(!titles.includes(expression), `removed expression returned: ${expression}`);
  }
});
