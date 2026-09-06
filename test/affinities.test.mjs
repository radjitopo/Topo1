import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { affinityPercent } from '../affinity.js';
import { compactSource } from './source-helpers.mjs';

const root = new URL('../', import.meta.url);

test('affinity is the rounded share of common rankings with the same winner', () => {
  assert.equal(affinityPercent(18, 12), 67);
  assert.equal(affinityPercent(3, 3), 100);
  assert.equal(affinityPercent(3, 0), 0);
  assert.equal(affinityPercent(0, 0), null);
  assert.equal(affinityPercent(3, 8), 100);
});

test('affinity storage is reproducible and keeps unlisted share tokens', async () => {
  const [migration, script, packageJson] = await Promise.all([
    readFile(new URL('migrations/20260906_user_affinities.sql', root), 'utf8'),
    readFile(new URL('scripts/apply-user-affinities.mjs', root), 'utf8'),
    readFile(new URL('package.json', root), 'utf8'),
  ]);

  assert.match(migration, /CREATE TABLE IF NOT EXISTS user_affinity_links/);
  assert.match(migration, /share_token text NOT NULL UNIQUE/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS user_affinity_connections/);
  assert.match(migration, /PRIMARY KEY \(user_id, compared_user_id\)/);
  assert.match(migration, /CHECK \(user_id <> compared_user_id\)/);
  assert.match(script, /20260906_user_affinities\.sql/);
  assert.match(script, /splitSqlStatements/);
  assert.match(packageJson, /"db:user-affinities"/);
});

test('API compares only completed public duels and never exposes e-mail', async () => {
  const api = await readFile(new URL('api.js', root), 'utf8');
  const compact = compactSource(api);
  const comparison = api.slice(
    api.indexOf('async function affinityComparison'),
    api.indexOf('async function affinityHistory'),
  );

  assert.match(comparison, /ranking_duel_sessions/);
  assert.match(comparison, /mine\.completed = true/);
  assert.match(comparison, /theirs\.completed = true/);
  assert.match(comparison, /ranking\.is_active = true/);
  assert.match(comparison, /ranking\.is_vip = false/);
  assert.match(comparison, /mine\.champion_option_id = theirs\.champion_option_id/);
  assert.doesNotMatch(comparison, /email/i);
  assert.match(compact, /action==='affinities'\)returnaffinities/);
  assert.match(compact, /action==='affinity'\)returnaffinity/);
  assert.match(compact, /action==='affinity-share'\)returnshareAffinity/);
});

test('Meu Topo and the public invite route expose the affinity flow', async () => {
  const [app, style, page, vercel] = await Promise.all([
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('editorial-clean.css', root), 'utf8'),
    readFile(new URL('page.js', root), 'utf8'),
    readFile(new URL('vercel.json', root), 'utf8'),
  ]);

  assert.match(app, /function affinityPanelHTML/);
  assert.match(app, /COMPARAR COM ALGUÉM/);
  assert.match(app, /em comum/);
  assert.match(app, /mesmo vencedor/);
  assert.match(app, /function loadAffinityPage/);
  assert.match(style, /\.affinityPanel/);
  assert.match(style, /\.affinityScore/);
  assert.match(page, /afinidade: \['Afinidade — TOPO'/);
  assert.match(vercel, /afinidade\/\(\[\^\/\]\+\)/);
});
