import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { compactSource, extractTopLevelDeclaration } from './source-helpers.mjs';

const root = new URL('../', import.meta.url);

test('ranking pages default to Ganha, Fica and keep Voto Livre available', async () => {
  const app = await readFile(new URL('app.js', root), 'utf8');
  const chooseMode = extractTopLevelDeclaration(app, 'activeRankingVoteMode');

  assert.ok(chooseMode, 'the mode selector must remain testable');
  for (const [search, expected] of [
    ['', 'duelo'],
    ['?modo=top3', 'duelo'],
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
  assert.ok(
    compact.indexOf('data-ranking-vote-mode="duelo"') <
      compact.indexOf('data-ranking-vote-mode="livre"'),
    'Ganha, Fica should be the left tab and the default mode',
  );
  assert.match(compact, />GANHA,FICA</);
  assert.match(compact, />VOTOLIVRE</);
  assert.doesNotMatch(compact, />TOP3</);
  assert.doesNotMatch(compact, /Votoslivreshoje|DisputanoVotoLivre|rankingModeStatsHTML/);
});

test('Voto Livre starts without a black bar and explains the stronger duel', async () => {
  const [app, style] = await Promise.all([
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('editorial-clean.css', root), 'utf8'),
  ]);
  const freeVote = extractTopLevelDeclaration(app, 'rankingFreeVoteHTML');
  const introRule =
    style.match(/body\.popElectric\.rankingPage \.rankingFreeIntro \{([^}]*)\}/)?.[1] || '';

  assert.match(freeVote, /Não concorda\?/);
  assert.match(freeVote, /Duelo do Topo conta mais/);
  assert.doesNotMatch(introRule, /border-top/);
  assert.match(style, /\.rankingFreeIntro > strong \{[\s\S]*?font-size: 18px;/);
});

test('tab changes stay in place instead of navigating the ranking page', async () => {
  const app = await readFile(new URL('app.js', root), 'utf8');
  const tabs = extractTopLevelDeclaration(app, 'rankingVoteModeHTML');
  const updateUrl = extractTopLevelDeclaration(app, 'updateVoteModeUrl');

  assert.match(tabs, /<button/);
  assert.doesNotMatch(tabs, /href=/);
  assert.match(updateUrl, /history\.pushState/);
  assert.match(updateUrl, /mode\s*===\s*'duelo'\)\s*url\.searchParams\.delete\('modo'\)/);
  assert.match(updateUrl, /url\.searchParams\.set\('modo',\s*mode\)/);
  assert.doesNotMatch(updateUrl, /location\.(?:assign|replace)/);
  assert.doesNotMatch(updateUrl, /scrollTo|scrollIntoView/);
});

test('Ganha, Fica keeps its own sessions and only adds a hidden bonus every 4 points', async () => {
  const [api, winnerMigration, singlePlayMigration, fourPointBonusMigration] = await Promise.all([
    readFile(new URL('api.js', root), 'utf8'),
    readFile(new URL('migrations/20260829_winner_stays.sql', root), 'utf8'),
    readFile(new URL('migrations/20260829_single_duel_play.sql', root), 'utf8'),
    readFile(new URL('migrations/20260829_duel_bonus_four.sql', root), 'utf8'),
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
  assert.match(fourPointBonusMigration, /CREATE OR REPLACE VIEW ranking_duel_option_bonuses/);
  assert.match(fourPointBonusMigration, /FLOOR\(SUM\(points\)::numeric \/ 4\)/);
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
  const [app, style, index, editorialBase, editorial18, editorial19] = await Promise.all([
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('editorial-clean.css', root), 'utf8'),
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('editorial-base.js', root), 'utf8'),
    readFile(new URL('editorial-18.js', root), 'utf8'),
    readFile(new URL('editorial-19.js', root), 'utf8'),
  ]);
  const compact = compactSource(app);
  const duel = extractTopLevelDeclaration(app, 'rankingDuelHTML');
  const duelRule =
    style.match(/body\.popElectric\.rankingPage \.rankingDuel \{([^}]*)\}/)?.[1] || '';

  assert.match(compact, /Seuvencedor/);
  assert.match(compact, /resultadofoiguardadonoMeuTopo/i);
  assert.match(compact, /TROCARDESAFIANTE/);
  assert.match(compact, /Rankingoficial/);
  assert.doesNotMatch(compact, /RankingGanha,Fica|duelStandingsHTML|pontonanasequência/);
  assert.match(style, /\.rankingVoteModes/);
  assert.match(style, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(style, /\.duelChoice\.incumbent/);
  assert.match(style, /\.duelChoice\.challenger/);
  assert.match(duel, /data-duel-pair><div class="duelChoices">/);
  assert.doesNotMatch(duel, /<img|duelChoicePhoto/);
  assert.doesNotMatch(duel, /<header>|headerCopy|Ordem aleatória|uma partida por ranking/);
  assert.doesNotMatch(editorialBase, /Começa pelos últimos/);
  assert.doesNotMatch(duelRule, /border-top/);
  assert.match(style, /\.rankingVoteModes button \{[\s\S]*?min-height: 38px;/);
  assert.match(
    style,
    /@media \(max-width: 700px\)[\s\S]*?\.rankingVoteModes button \{[\s\S]*?min-height: 36px;/,
  );
  assert.match(style, /\.duelChoice \{[\s\S]*?min-height: 220px;/);
  assert.match(
    style,
    /@media \(max-width: 700px\)[\s\S]*?\.duelChoice \{[\s\S]*?min-height: 142px;/,
  );
  assert.match(
    style,
    /@media \(max-width: 700px\)[\s\S]*?\.duelShareBar \{[\s\S]*?margin-top: 8px;/,
  );
  assert.match(
    style,
    /@media \(max-width: 700px\)[\s\S]*?\.duelShareButton \{[\s\S]*?min-height: 40px;/,
  );
  assert.match(editorial18, /@media \(max-width: 900px\)/);
  assert.match(editorial18, /height: 142px !important;/);
  assert.match(editorial18, /height: 50px !important;/);
  assert.doesNotMatch(editorial18, /height: 218px !important;/);
  assert.match(editorial19, /const DUEL_OPTION_PHOTOS_ENABLED = false;/);
  assert.match(editorial19, /typeof document === 'undefined' \|\| !DUEL_OPTION_PHOTOS_ENABLED/);
  assert.match(index, /editorial-19\.js\?v=20260901-3-duel-without-option-photos/);
  assert.match(editorialBase, /background: #92333f;/);
  assert.match(editorialBase, /background: #7d2632;/);
  assert.match(style, /hyphens: auto;/, 'long option labels should wrap cleanly on phones');
  assert.match(style, /\.profileRankingActivityCard/);
  assert.match(index, /single-random-play/);
  assert.match(
    style,
    /\.rankingContinuation > \.rankingFlowActions\[hidden\] \{[\s\S]*?display: none;/,
  );
  assert.doesNotMatch(duel, /OPÇÃO [AB]|ESCOLHA QUEM CONTINUA/);
  assert.match(
    duel,
    /<div class="duelFooter">[\s\S]*?\$\{duelShareButtonHTML\(pair\)\}\$\{nextActions\}/,
  );
});

test('a completed duel puts the next rankings before the small Meu Topo link', async () => {
  const [app, style] = await Promise.all([
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('editorial-clean.css', root), 'utf8'),
  ]);
  const duel = extractTopLevelDeclaration(app, 'rankingDuelHTML');
  const flow = extractTopLevelDeclaration(app, 'rankingFlowActionsHTML');

  assert.match(flow, /Próximo ranking/);
  assert.match(flow, /Ranking aleatório/);
  assert.match(duel, /rankingFlowActionsHTML\(r, 'duelNextActions'\)/);
  assert.match(duel, /Seu vencedor:[\s\S]*?<\/h2>\$\{nextActions\}<div class="duelResultMeta">/);
  assert.match(duel, /Ver no Meu Topo →/);
  assert.doesNotMatch(duel, /IR PARA OUTRO RANKING/);
  assert.match(style, /\.duelNextActions/);
  assert.match(style, /\.duelResultMeta/);
});

test('Meu Topo lists voted and played rankings with the personal winner', async () => {
  const [api, app, style] = await Promise.all([
    readFile(new URL('api.js', root), 'utf8'),
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('editorial-clean.css', root), 'utf8'),
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
  assert.match(app, /PROFILE_RANKING_ACTIVITY_PAGE_SIZE = 5/);
  assert.match(activity, /data-profile-activity-card/);
  assert.match(activity, /data-profile-activity-more/);
  assert.match(app, /bindProfileRankingActivityMore\(feed\)/);
  assert.match(style, /\.profileRankingActivityCard\[hidden\]/);
  assert.match(style, /\.profileRankingActivityMore/);
});
