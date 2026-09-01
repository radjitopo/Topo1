import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { compactSource, extractTopLevelDeclaration } from './source-helpers.mjs';

const root = new URL('../', import.meta.url);

test('a shared duel link keeps the exact pair as the start of a new run', async () => {
  const [app, api] = await Promise.all([
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('duel-bottom-api.js', root), 'utf8'),
  ]);
  const parseClient = extractTopLevelDeclaration(app, 'sharedDuelStartOptionIds');
  const context = vm.createContext({ location: { search: '?duelo=41-72' }, URLSearchParams });
  vm.runInContext(`${parseClient}\nglobalThis.optionIds = sharedDuelStartOptionIds();`, context);
  assert.deepEqual([...context.optionIds], [41, 72]);

  context.location.search = '?duelo=41-41';
  vm.runInContext('globalThis.invalidOptionIds = sharedDuelStartOptionIds();', context);
  assert.deepEqual([...context.invalidOptionIds], []);

  const compactApp = compactSource(app);
  assert.match(compactApp, /data-share-duel/);
  assert.match(compactApp, /COMPARTILHARESTEDUELO/);
  assert.doesNotMatch(app, /Duelo compartilhado · sua partida começa aqui/);
  assert.match(compactApp, /\/duel-bottom-api\?\$\{params\}/);
  assert.match(compactApp, /payload\.start_option_ids=startOptionIds/);

  assert.match(api, /async function sharedStartPair/);
  assert.match(api, /if \(duel\?\.sessionId \|\| duel\?\.completed/);
  assert.match(api, /option\.id = ANY\(\$2::bigint\[\]\)/);
  assert.match(api, /sharedStart: sharedPair\.length === 2/);
});

test('shared duel pages advertise the matchup without creating duplicate index pages', async () => {
  const template = await readFile(new URL('index.html', root), 'utf8');
  const { renderRankingPage, sharedDuelForRanking } = await import(
    `../page.js?duel-sharing=${Date.now()}`
  );
  const ranking = {
    id: 'craques-teste',
    question: 'Quem é o maior craque?',
    category: 'Esporte',
    imageUrl: '',
    createdAt: '2026-08-31T00:00:00Z',
    updatedAt: '2026-08-31T00:00:00Z',
    voteCount: 12,
    options: [
      { id: 41, label: 'Pelé', score: 10 },
      { id: 72, label: 'Maradona', score: 9 },
      { id: 90, label: 'Messi', score: 8 },
    ],
  };
  const shared = sharedDuelForRanking('41-72', ranking);
  assert.deepEqual(
    shared.map((option) => option.label),
    ['Pelé', 'Maradona'],
  );
  assert.equal(sharedDuelForRanking('41-999', ranking), null);

  const html = renderRankingPage(template, ranking, shared);
  assert.match(html, /<meta property="og:title" content="Pelé × Maradona — Duelo do Topo">/);
  assert.match(html, /uma nova partida neste ranking do TOPO exatamente por este duelo/);
  assert.match(html, /<meta name="robots" content="noindex,follow/);
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/somostopo\.com\.br\/ranking\/craques-teste">/,
  );
});
