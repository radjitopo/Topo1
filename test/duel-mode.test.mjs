import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { compactSource, extractTopLevelDeclaration } from './source-helpers.mjs';

const root = new URL('../', import.meta.url);

test('duel rounds are balanced, short and limited to options without a vote', async () => {
  const source = await readFile(new URL('app.js', root), 'utf8'),
    declarations = ['duelEligibleOptions', 'duelPairKey', 'buildBalancedDuelPairs'].map((name) =>
      extractTopLevelDeclaration(source, name),
    );

  assert.ok(declarations.every(Boolean), 'duel pairing helpers must remain testable');

  const context = vm.createContext({ Math, Number, Set });
  vm.runInContext(
    `${declarations.join('\n')}
globalThis.buildPairsForTest = buildBalancedDuelPairs;
globalThis.pairKeyForTest = duelPairKey;`,
    context,
  );

  const options = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      label: `Opção ${index + 1}`,
      mine: [2, 7].includes(index + 1) ? 1 : 0,
    })),
    seen = new Set(['1:3']),
    pairs = context.buildPairsForTest(options, seen, 5, () => 0.9),
    ids = pairs.flat().map((option) => option.id);

  assert.equal(pairs.length, 5, 'a round should contain at most five duels');
  assert.equal(new Set(ids).size, ids.length, 'an option must appear only once per round');
  assert.ok(!ids.includes(2) && !ids.includes(7), 'previously voted options must be excluded');
  assert.ok(
    pairs.every((pair) => !seen.has(context.pairKeyForTest(pair[0], pair[1]))),
    'a previous pair should be avoided while a new pairing is available',
  );
});

test('a duel gives only the chosen option one positive vote', async () => {
  const [app, style, index] = await Promise.all([
      readFile(new URL('app.js', root), 'utf8'),
      readFile(new URL('editorial-clean.css', root), 'utf8'),
      readFile(new URL('index.html', root), 'utf8'),
    ]),
    compact = compactSource(app),
    choose = extractTopLevelDeclaration(app, 'chooseDuelOption');

  assert.match(choose, /direction:\s*1/);
  assert.doesNotMatch(choose, /direction:\s*-1/);
  assert.match(compact, /Avencedorarecebe\+1eaoutracontinuacomzero/);
  assert.match(compact, /duelEligibleOptions\(ranking\)\.length>=2/);
  assert.match(compact, /data-start-random-duel/);
  assert.match(compact, /VOTARCOMFLECHAS/);
  assert.match(compact, /MODODUELO/);
  assert.match(style, /\.rankingVoteModes/);
  assert.match(style, /\.duelChoices/);
  assert.match(style, /\.duelHomeCallout/);
  assert.match(index, /duel-mode/);
});
