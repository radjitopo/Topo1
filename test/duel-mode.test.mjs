import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { compactSource, extractTopLevelDeclaration } from './source-helpers.mjs';

const root = new URL('../', import.meta.url);

test('ranking pages default to Top 3 and expose three independent voting tabs', async () => {
  const app = await readFile(new URL('app.js', root), 'utf8');
  const chooseMode = extractTopLevelDeclaration(app, 'activeRankingVoteMode');

  assert.ok(chooseMode, 'the mode selector must remain testable');
  for (const [search, expected] of [
    ['', 'top3'],
    ['?modo=top3', 'top3'],
    ['?modo=duelo', 'duelo'],
    ['?modo=livre', 'livre'],
    ['?modo=flechas', 'livre'],
  ]) {
    const context = vm.createContext({ location: { search }, URLSearchParams });
    vm.runInContext(`${chooseMode}\nglobalThis.mode = activeRankingVoteMode();`, context);
    assert.equal(context.mode, expected);
  }

  const compact = compactSource(app);
  assert.match(compact, /data-ranking-vote-mode="top3"/);
  assert.match(compact, /data-ranking-vote-mode="duelo"/);
  assert.match(compact, /data-ranking-vote-mode="livre"/);
  assert.match(compact, />TOP3</);
  assert.match(compact, />DUELOS</);
  assert.match(compact, />VOTOLIVRE</);
  assert.match(compact, /EsteresultadonãosomapontosaoVotoLivre/);
});

test('tab changes stay in place instead of navigating the ranking page', async () => {
  const app = await readFile(new URL('app.js', root), 'utf8');
  const tabs = extractTopLevelDeclaration(app, 'rankingVoteModeHTML');
  const updateUrl = extractTopLevelDeclaration(app, 'updateVoteModeUrl');

  assert.match(tabs, /<button/);
  assert.doesNotMatch(tabs, /href=/);
  assert.match(updateUrl, /history\.pushState/);
  assert.doesNotMatch(updateUrl, /location\.(?:assign|replace)/);
  assert.doesNotMatch(updateUrl, /scrollTo|scrollIntoView/);
});

test('Top 3 and Duel persist outside the arrow score', async () => {
  const [api, migration] = await Promise.all([
    readFile(new URL('api.js', root), 'utf8'),
    readFile(new URL('migrations/20260828_voting_modes.sql', root), 'utf8'),
  ]);
  const top3 = extractTopLevelDeclaration(api, 'saveTop3');
  const duel = extractTopLevelDeclaration(api, 'saveDuel');

  assert.match(top3, /optionIds\.length !== 3/);
  assert.match(top3, /ranking_top3_selections/);
  assert.doesNotMatch(top3, /INSERT INTO votes\b/);
  assert.match(duel, /ranking_duel_rounds/);
  assert.match(duel, /ranking_duel_entries/);
  assert.doesNotMatch(duel, /INSERT INTO votes\b/);
  assert.match(duel, /winnerOptionId === null/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS ranking_top3_selections/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS ranking_duel_entries/);
});

test('each option appears at most once per voter and pairs favor lower exposure', async () => {
  const [api, migration] = await Promise.all([
    readFile(new URL('api.js', root), 'utf8'),
    readFile(new URL('migrations/20260828_voting_modes.sql', root), 'utf8'),
  ]);
  const state = extractTopLevelDeclaration(api, 'rankingVotingModeState');

  assert.match(migration, /ranking_duel_user_option_unique_idx/);
  assert.match(migration, /\(user_id, ranking_id, option_id\)[\s\S]*WHERE user_id IS NOT NULL/);
  assert.match(migration, /ranking_duel_device_option_unique_idx/);
  assert.match(migration, /\(device_id, ranking_id, option_id\)[\s\S]*WHERE user_id IS NULL/);
  assert.match(state, /AND NOT EXISTS/);
  assert.match(state, /COALESCE\(exposure\.appearances, 0\)/);
  assert.match(state, /ORDER BY[\s\S]*exposure\.appearances/);
  assert.match(state, /COUNT\(entry\.option_id\) FILTER \(WHERE entry\.won IS TRUE\)/);
});

test('duel copy, results and mobile layout keep scoring clear', async () => {
  const [app, style, index] = await Promise.all([
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('editorial-clean.css', root), 'utf8'),
    readFile(new URL('index.html', root), 'utf8'),
  ]);
  const compact = compactSource(app);

  assert.match(compact, /Cadavitóriavale1somentenorankingdosDuelos/);
  assert.match(compact, /Asflechasnãomudam/);
  assert.match(compact, /RankingdosDuelos/);
  assert.match(compact, /desempateporaproveitamento/);
  assert.match(compact, /PULAR·NÃOCONHEÇO/);
  assert.match(style, /\.rankingVoteModes/);
  assert.match(style, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(style, /\.rankingTop3/);
  assert.match(style, /\.duelStandings/);
  assert.match(
    style,
    /\.rankingDuel > header \{[\s\S]*?height: auto;[\s\S]*?display: block;/,
    'the global site header layout must not leak into the duel header',
  );
  assert.match(style, /hyphens: auto;/, 'long duel labels should wrap cleanly on phones');
  assert.match(index, /duel-mode/);
});
