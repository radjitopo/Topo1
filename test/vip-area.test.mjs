import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compactSource } from './source-helpers.mjs';

const root = new URL('../', import.meta.url);

test('VIP schema stores hashes, versions access and rate-limits unlock attempts', async () => {
  const [migration, script, packageJson] = await Promise.all([
    readFile(new URL('migrations/20260827_vip_area.sql', root), 'utf8'),
    readFile(new URL('scripts/apply-vip-area.mjs', root), 'utf8'),
    readFile(new URL('package.json', root), 'utf8'),
  ]);

  assert.match(migration, /ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS vip_password_hash text/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS vip_password_version integer/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS ranking_vip_unlock_attempts/);
  assert.doesNotMatch(migration, /vip_password\s+text/i);
  assert.match(script, /20260827_vip_area\.sql/);
  assert.match(script, /splitSqlStatements/);
  assert.match(packageJson, /"db:vip-area"/);
});

test('VIP access is hashed, signed, HttpOnly and throttled on the server', async () => {
  const api = await readFile(new URL('api.js', root), 'utf8');
  const compact = compactSource(api);

  assert.match(api, /function hashVipPassword\(password\)/);
  assert.match(api, /scryptSync\(password, salt, 64\)/);
  assert.match(api, /timingSafeEqual\(actual, expected\)/);
  assert.match(api, /createHmac\('sha256', key\)/);
  assert.match(api, /HttpOnly; SameSite=Lax; Max-Age=/);
  assert.match(api, /VIP_ACCESS_MAX_AGE_SECONDS = 60 \* 60 \* 24 \* 30/);
  assert.match(api, /ranking_vip_unlock_attempts/);
  assert.match(api, /interval '15 minutes'/);
  assert.match(api, /VIP_UNLOCK_ATTEMPT_LIMIT = 8/);
  assert.match(compact, /action==='vip-unlock'\)returnunlockVipRanking/);
  assert.match(compact, /action==='vip-ranking'\)returnvipRanking/);
  assert.match(compact, /action==='vip-catalog'\)returnvipCatalog/);
});

test('protected ranking data is excluded from public discovery and guarded on writes', async () => {
  const [api, page, sitemap] = await Promise.all([
    readFile(new URL('api.js', root), 'utf8'),
    readFile(new URL('page.js', root), 'utf8'),
    readFile(new URL('sitemap.js', root), 'utf8'),
  ]);
  const catalog = api.slice(
    api.indexOf('async function catalog'),
    api.indexOf('function clerkConfig'),
  );
  const meta = api.slice(
    api.indexOf('function vipRankingMeta'),
    api.indexOf('async function vipCatalog'),
  );
  const voting = api.slice(api.indexOf('async function vote'), api.indexOf('export default'));
  const comments = api.slice(
    api.indexOf('async function comments'),
    api.indexOf('function emailHtml'),
  );
  const suggestions = api.slice(
    api.indexOf('async function createSuggestion'),
    api.indexOf('async function mySuggestions'),
  );

  assert.match(catalog, /r\.is_vip = false OR \$4::boolean = true/);
  assert.match(catalog, /function vipRankingMeta/);
  assert.doesNotMatch(meta, /vipPasswordHash|vip_password_hash/);
  assert.match(voting, /hasVipAccess\(req, user/);
  assert.match(voting, /vip_password_required/);
  assert.match(comments, /hasVipAccess\(req, user/);
  assert.match(comments, /vip_password_required/);
  assert.match(suggestions, /hasVipAccess\(req, user/);
  assert.match(page, /AND ranking\.is_vip = false/);
  assert.match(page, /renderVipRankingPage/);
  assert.match(sitemap, /AND ranking\.is_vip = false/);
});

test('moderators control VIP placement and passwords in the ranking editor', async () => {
  const [api, app, index, style, vercel] = await Promise.all([
    readFile(new URL('api.js', root), 'utf8'),
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('editorial-clean.css', root), 'utf8'),
    readFile(new URL('vercel.json', root), 'utf8'),
  ]);
  const editor = api.slice(
    api.indexOf('async function updateRankingContent'),
    api.indexOf('async function moderationQueue'),
  );

  assert.match(editor, /if \(!isModerator\(user\)\)/);
  assert.match(editor, /hashVipPassword\(nextVipPassword\)/);
  assert.match(editor, /vip_password_version = \$6/);
  assert.match(editor, /vipHasPassword/);
  assert.doesNotMatch(editor, /afterContent[\s\S]{0,500}vipPasswordHash/);
  assert.match(app, /id="rankingEditorVip"/);
  assert.match(app, /id="rankingEditorVipPassword"/);
  assert.match(app, /Colocar este ranking na Área VIP/);
  assert.match(app, /function renderVipGate/);
  assert.match(app, /function loadVipArea/);
  assert.match(index, /data-experience="vip" href="\/vip"/);
  assert.match(style, /\.vipGate/);
  assert.match(style, /\.rankingEditorVip/);
  assert.match(vercel, /moderacao\|vip\|recuperar-senha/);
});
