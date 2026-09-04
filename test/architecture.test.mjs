import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('production requests do not run schema migrations or legacy account password code', async () => {
  const api = await readFile(new URL('api.js', root), 'utf8');

  assert.doesNotMatch(api, /CREATE TABLE|ALTER TABLE|CREATE INDEX/);
  assert.doesNotMatch(api, /function signup|function login/);
  assert.match(api, /function hashVipPassword/);
  assert.match(api, /scryptSync/);
  assert.match(api, /timingSafeEqual/);
  assert.doesNotMatch(api, /ensureClerkSchema|ensureSuggestionSchema/);
  assert.match(api, /legacy_auth_disabled/);
  assert.match(api, /password_auth_disabled/);
});

test('successful votes update the current catalog without downloading it again', async () => {
  const [api, app] = await Promise.all([
    readFile(new URL('api.js', root), 'utf8'),
    readFile(new URL('app.js', root), 'utf8'),
  ]);

  assert.match(api, /rankingVotes/);
  assert.match(api, /todayVotes/);
  assert.match(api, /communityVotes/);
  assert.match(app, /function applyVoteResult\(optionId, result\)/);
  assert.match(
    app,
    /if \(!applyVoteResult\(optionId, result\)\) await refreshVoteState\(rankOrder\)/,
  );
});

test('catalog sends compact previews and keeps the opened ranking complete', async () => {
  const [api, app] = await Promise.all([
    readFile(new URL('api.js', root), 'utf8'),
    readFile(new URL('app.js', root), 'utf8'),
  ]);

  assert.match(api, /ROW_NUMBER\(\) OVER/);
  assert.match(api, /catalog_position <= 3/);
  assert.match(api, /ranking_id = \$7::text/);
  assert.match(api, /option_search_text/);
  assert.match(api, /ranking_live_votes/);
  assert.match(api, /my_vote_count/);
  assert.match(app, /r\.searchText \|\|/);
  assert.match(app, /ranking\.myVoteCount = previousVoteCount \+ 1/);
});

test('dead public copies are gone and the Open Graph image is static', async () => {
  const vercel = JSON.parse(await readFile(new URL('vercel.json', root), 'utf8'));
  const ogBuild = vercel.builds.find((build) => build.src === 'og-topo-v3.png');
  assert.equal(ogBuild?.use, '@vercel/static');
  assert.ok(!vercel.routes.some((route) => route.dest === '/og-topo.js'));

  for (const path of [
    'og-topo.js',
    'indexb.html',
    'como-funciona.html',
    'privacidade.html',
    'termos.html',
  ]) {
    await assert.rejects(access(new URL(path, root)));
  }
});

test('security headers run inside the custom route chain', async () => {
  const vercel = JSON.parse(await readFile(new URL('vercel.json', root), 'utf8'));
  const headerRoute = vercel.routes[0];

  assert.equal(vercel.headers, undefined);
  assert.equal(headerRoute.src, '/(.*)');
  assert.equal(headerRoute.continue, true);
  assert.equal(headerRoute.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headerRoute.headers['X-Frame-Options'], 'DENY');
  assert.equal(headerRoute.headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.equal(
    headerRoute.headers['Permissions-Policy'],
    'camera=(), microphone=(), geolocation=()',
  );
});

test('migration tooling understands PostgreSQL dollar-quoted blocks', async () => {
  const script = await readFile(new URL('scripts/apply-suggestions.mjs', root), 'utf8');
  assert.match(script, /splitSqlStatements/);
  assert.doesNotMatch(script, /split\(\/;\\s\*/);
});
