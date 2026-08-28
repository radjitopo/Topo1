import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compactSource } from './source-helpers.mjs';

const root = new URL('../', import.meta.url);

test('favorites have reproducible storage and a private share token', async () => {
  const [migration, script, packageJson] = await Promise.all([
    readFile(new URL('migrations/20260827_ranking_favorites.sql', root), 'utf8'),
    readFile(new URL('scripts/apply-ranking-favorites.mjs', root), 'utf8'),
    readFile(new URL('package.json', root), 'utf8'),
  ]);

  assert.match(migration, /CREATE TABLE IF NOT EXISTS user_ranking_favorites/);
  assert.match(migration, /PRIMARY KEY \(user_id, ranking_id\)/);
  assert.match(migration, /REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(migration, /REFERENCES rankings\(id\) ON DELETE CASCADE/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS user_favorite_collections/);
  assert.match(migration, /share_token text NOT NULL UNIQUE/);
  assert.match(script, /20260827_ranking_favorites\.sql/);
  assert.match(script, /splitSqlStatements/);
  assert.match(packageJson, /"db:ranking-favorites"/);
});

test('API only favorites active public rankings and exposes an unlisted collection', async () => {
  const api = await readFile(new URL('api.js', root), 'utf8');
  const add = api.slice(
    api.indexOf('async function addFavorite'),
    api.indexOf('async function removeFavorite'),
  );
  const collection = api.slice(
    api.indexOf('async function favoriteCollection'),
    api.indexOf('function clerkConfig'),
  );
  const compact = compactSource(api);

  assert.match(add, /const user = await sessionUser\(req\)/);
  assert.match(add, /authentication_required/);
  assert.match(add, /ranking\.is_active = true/);
  assert.match(add, /ranking\.is_vip = false/);
  assert.match(api, /user_ranking_favorites/);
  assert.match(api, /user_favorite_collections/);
  assert.match(collection, /collection\.share_token = \$1/);
  assert.doesNotMatch(collection, /users\.email/);
  assert.match(compact, /action==='favorites'\)returnfavorites/);
  assert.match(compact, /action==='favorites'\)returnaddFavorite/);
  assert.match(compact, /action==='favorite-share'\)returnshareFavorites/);
  assert.match(compact, /action==='favorite-collection'\)returnfavoriteCollection/);
  assert.match(compact, /action==='favorites'\)returnremoveFavorite/);
});

test('catalog marks favorites and uses them to personalize discovery', async () => {
  const [api, app] = await Promise.all([
    readFile(new URL('api.js', root), 'utf8'),
    readFile(new URL('app.js', root), 'utf8'),
  ]);

  assert.match(api, /AS is_favorite/);
  assert.match(api, /favorite: row\.is_favorite === true/);
  assert.match(app, /function favoriteAffinity\(r, favorites\)/);
  assert.match(app, /b\.affinity - a\.affinity/);
});

test('Meu Topo renders favorites, a heart toggle and one collection share action', async () => {
  const [app, style, page, vercel] = await Promise.all([
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('editorial-clean.css', root), 'utf8'),
    readFile(new URL('page.js', root), 'utf8'),
    readFile(new URL('vercel.json', root), 'utf8'),
  ]);

  assert.match(app, /function favoriteButtonHTML/);
  assert.match(app, /data-favorite-ranking/);
  assert.match(app, /<h2>Favoritos<\/h2>/);
  assert.match(app, /COMPARTILHAR FAVORITOS/);
  assert.match(app, /function loadFavoriteCollection/);
  assert.doesNotMatch(app, /Não gostei|Gostei deste ranking/);
  assert.match(style, /\.favoriteToggle/);
  assert.match(style, /\.favoriteGrid/);
  assert.match(style, /\.favoritePublicHero/);
  assert.match(page, /favoritos: \['Favoritos — TOPO'/);
  assert.match(vercel, /favoritos\/\(\[\^\/\]\+\)/);
});

test('ranking actions move below the stats in one mobile row while desktop stays unchanged', async () => {
  const [app, style] = await Promise.all([
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('editorial-clean.css', root), 'utf8'),
  ]);
  const compactApp = compactSource(app);
  const compactStyle = compactSource(style);

  assert.match(app, /rankingPersonalActionsHTML\(r, placement = 'desktop'\)/);
  assert.match(
    compactApp,
    /<h1>\$\{escapeHTML\(r\.q\)\}<\/h1>\$\{rankingPersonalActionsHTML\(r,'desktop'\)\}[\s\S]*\$\{rankingModeStatsHTML\(r,votingOpen\)\}\$\{rankingPersonalActionsHTML\(r,'mobile'\)\}\$\{rankingVoteModeHTML\(r,votingOpen\)\}<divid="rankingVotingPanel"/,
  );
  assert.match(compactStyle, /body\.popElectric\.rankingPersonalActionsMobile\{display:none;?\}/);
  assert.match(
    compactStyle,
    /@media\(max-width:700px\)[\s\S]*body\.popElectric\.rankingPage\.rankingPersonalActionsDesktop\{display:none;?\}[\s\S]*body\.popElectric\.rankingPage\.rankingPersonalActionsMobile\{[^}]*display:flex[^}]*flex-direction:row[^}]*margin:0027px[^}]*padding:12px00;?\}/,
  );
  assert.match(
    compactStyle,
    /body\.popElectric\.rankingPage\.rankingPersonalActionsMobile\.shareActions\{[^}]*flex-wrap:nowrap/,
  );
});
