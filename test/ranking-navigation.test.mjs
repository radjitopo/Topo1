import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { extractTopLevelDeclaration } from './source-helpers.mjs';

const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const selected = [
  'myVoteCount',
  'rankingNeedsParticipation',
  'rankingSequenceCompare',
  'nextRankingFor',
  'randomRankingFor',
].map((name) => extractTopLevelDeclaration(source, name));

assert.ok(selected.every(Boolean), 'ranking navigation functions must remain testable');

function navigationContext(random = 0) {
  const context = vm.createContext({
    Date,
    Math: { floor: Math.floor, max: Math.max, random: () => random },
  });
  vm.runInContext(
    `
      function rankingsInSameExperience() { return globalThis.inputRankings; }
      function experienceGroupOf(ranking) { return ranking.group; }
      function experienceGroupNames() { return ['Todos', 'Esporte', 'Música', 'Cinema']; }
      function isTeamRanking(ranking) { return ranking.team === true; }
      ${selected.join('\n')}
      globalThis.nextRankingForTest = nextRankingFor;
      globalThis.randomRankingForTest = randomRankingFor;
    `,
    context,
  );
  return context;
}

const ranking = (id, group, order, extra = {}) => ({
  id,
  group,
  createdAt: `2026-08-${String(order).padStart(2, '0')}T12:00:00.000Z`,
  opts: [],
  ...extra,
});

test('next ranking advances through the category and then into the next category', () => {
  const context = navigationContext();
  context.inputRankings = [
    ranking('futebol-a', 'Esporte', 1, { duelCompleted: true }),
    ranking('futebol-b', 'Esporte', 2),
    ranking('futebol-c', 'Esporte', 3),
    ranking('musica-votada', 'Música', 4, { opts: [{ mine: 1 }] }),
    ranking('musica-livre', 'Música', 5),
    ranking('cinema-concluido', 'Cinema', 6, { duelCompleted: true }),
  ];

  assert.equal(context.nextRankingForTest(context.inputRankings[0]).id, 'futebol-b');
  context.inputRankings[1].duelCompleted = true;
  assert.equal(context.nextRankingForTest(context.inputRankings[1]).id, 'futebol-c');
  context.inputRankings[2].duelCompleted = true;
  assert.equal(context.nextRankingForTest(context.inputRankings[2]).id, 'musica-livre');
});

test('next and random never return a voted or completed ranking', () => {
  const context = navigationContext(0.99);
  const current = ranking('atual', 'Esporte', 1, { duelCompleted: true });
  context.inputRankings = [
    current,
    ranking('votado', 'Esporte', 2, { opts: [{ mine: -1 }] }),
    ranking('concluido', 'Música', 3, { duelCompleted: true }),
    ranking('pendente', 'Cinema', 4),
  ];

  assert.equal(context.nextRankingForTest(current).id, 'pendente');
  assert.equal(context.randomRankingForTest(current).id, 'pendente');

  context.inputRankings[3].duelCompleted = true;
  assert.equal(context.nextRankingForTest(current), null);
  assert.equal(context.randomRankingForTest(current), null);
});

test('random can still choose a team ranking when it is the only unfinished option', () => {
  const context = navigationContext();
  const current = ranking('atual', 'Esporte', 1, { duelCompleted: true });
  context.inputRankings = [current, ranking('time-pendente', 'Esporte', 2, { team: true })];

  assert.equal(context.randomRankingForTest(current).id, 'time-pendente');
});
