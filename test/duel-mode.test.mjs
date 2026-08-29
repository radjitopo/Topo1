import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { compactSource, extractTopLevelDeclaration } from './source-helpers.mjs';

const root = new URL('../', import.meta.url);

test('ranking pages default to Voto Livre and expose Ganha, Fica without Top 3', async () => {
  const app = await readFile(new URL('app.js', root), 'utf8');
  const chooseMode = extractTopLevelDeclaration(app, 'activeRankingVoteMode');

  assert.ok(chooseMode, 'the mode selector must remain testable');
  for (const [search, expected] of [
    ['', 'livre'],
    ['?modo=top3', 'livre'],
    ['?modo=duelo', 'duelo'],
    ['?modo=livre', 'livre'],
    ['?modo=flechas', 'livre'],
  ]) {
    const context = vm.createContext({ location: { search }, URLSearchParams });
    vm.runInContext(`${chooseMode}\nglobalThis.mode = activeRankingVoteMode();`, context);
    assert.equal(context.mode, expected);
  }

  const compact = compactSource(app);
  assert.doesNotMatch(compact, /data-ranking-vote-mode="top3"/);
  assert.match(compact, /data-ranking-vote-mode="duelo"/);
  assert.match(compact, /data-ranking-vote-mode="livre"/);
  assert.match(compact, />GANHA,FICA</);
  assert.match(compact, />VOTOLIVRE</);
  assert.doesNotMatch(compact, />TOP3</);
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

test('Ganha, Fica keeps its own sessions and only adds a hidden bonus every 15 points', async () => {
  const [api, winnerMigration, singlePlayMigration] = await Promise.all([
    readFile(new URL('api.js', root), 'utf8'),
    readFile(new URL('migrations/20260829_winner_stays.sql', root), 'utf8'),
    readFile(new URL('migrations/20260829_single_duel_play.sql', root), 'utf8'),
  ]);
  const duel = extractTopLevelDeclaration(api, 'saveDuel');

  assert.match(duel, /ranking_duel_sessions/);
  assert.match(duel, /ranking_duel_rounds/);
  assert.match(duel, /ranking_duel_entries/);
  assert.doesNotMatch(duel, /INSERT INTO votes\b/);
  assert.match(duel, /winnerOptionId === null/);
  assert.match(winnerMigration, /CREATE TABLE IF NOT EXISTS ranking_duel_sessions/);
  assert.match(winnerMigration, /DROP INDEX IF EXISTS ranking_duel_user_option_unique_idx/);
  assert.match(singlePlayMigration, /CREATE OR REPLACE VIEW ranking_duel_option_bonuses/);
  assert.match(singlePlayMigration, /FLOOR\(SUM\(points\)::numeric \/ 15\)/);
  assert.match(api, /COALESCE\(duel_bonus\.score_bonus, 0\)/);
  assert.doesNotMatch(api, /action === 'ranking-top3'/);
});

test('each person gets one stable random run and previous winners keep their hidden points', async () => {
  const [api, winnerMigration, singlePlayMigration] = await Promise.all([
    readFile(new URL('api.js', root), 'utf8'),
    readFile(new URL('migrations/20260829_winner_stays.sql', root), 'utf8'),
    readFile(new URL('migrations/20260829_single_duel_play.sql', root), 'utf8'),
  ]);
  const state = extractTopLevelDeclaration(api, 'rankingVotingModeState');
  const duel = extractTopLevelDeclaration(api, 'saveDuel');

  assert.match(state, /'incumbent'/);
  assert.match(state, /'challenger'/);
  assert.match(state, /session\.order_seed/);
  assert.match(state, /md5\(/);
  assert.doesNotMatch(state, /appearances|exposure/);
  assert.match(state, /NOT EXISTS \(SELECT 1 FROM seen/);
  assert.match(duel, /potAfter = skipped \? potBefore : potBefore \+ 1/);
  assert.match(duel, /championAfterOptionId = skipped \? championBeforeOptionId : winnerOptionId/);
  assert.match(duel, /order_seed/);
  assert.match(duel, /completed =/);
  assert.match(singlePlayMigration, /MAX\(round\.pot_after\)/);
  assert.match(singlePlayMigration, /round\.champion_after_option_id/);
  assert.match(singlePlayMigration, /ADD COLUMN IF NOT EXISTS order_seed/);
  assert.match(winnerMigration, /ranking_duel_session_user_ranking_unique_idx/);
  assert.match(winnerMigration, /ranking_duel_session_device_ranking_unique_idx/);
});

test('Ganha, Fica hides its points, records the personal winner and stays usable on mobile', async () => {
  const [app, style, index] = await Promise.all([
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('editorial-clean.css', root), 'utf8'),
    readFile(new URL('index.html', root), 'utf8'),
  ]);
  const compact = compactSource(app);

  assert.match(compact, /Quemganha,fica/);
  assert.match(compact, /umapartidaporranking/);
  assert.match(compact, /Seuvencedor/);
  assert.match(compact, /resultadofoiguardadonoMeuTopo/i);
  assert.match(compact, /TROCARDESAFIANTE/);
  assert.match(compact, /Rankingoficial/);
  assert.doesNotMatch(compact, /RankingGanha,Fica|duelStandingsHTML|pontonanasequência/);
  assert.match(style, /\.rankingVoteModes/);
  assert.match(style, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(style, /\.duelChoice\.incumbent/);
  assert.match(style, /\.duelChoice\.challenger/);
  assert.match(
    style,
    /\.rankingDuel > header \{[\s\S]*?height: auto;[\s\S]*?display: block;/,
    'the global site header layout must not leak into the Ganha, Fica header',
  );
  assert.match(style, /hyphens: auto;/, 'long option labels should wrap cleanly on phones');
  assert.match(style, /\.profileRankingActivityCard/);
  assert.match(index, /single-random-play/);
});

test('Meu Topo lists voted and played rankings with the personal winner', async () => {
  const [api, app] = await Promise.all([
    readFile(new URL('api.js', root), 'utf8'),
    readFile(new URL('app.js', root), 'utf8'),
  ]);
  const profile = extractTopLevelDeclaration(api, 'profile');
  const activity = extractTopLevelDeclaration(app, 'profileRankingActivityHTML');

  assert.match(profile, /ranking_duel_sessions/);
  assert.match(profile, /champion_option_id/);
  assert.match(profile, /rankingActivity/);
  assert.match(activity, /Rankings votados e jogados/);
  assert.match(activity, /Seu vencedor/);
  assert.match(activity, /Seu líder até agora/);
  assert.match(activity, /\?modo=duelo/);
});
