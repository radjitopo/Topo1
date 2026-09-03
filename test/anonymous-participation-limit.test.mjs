import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compactSource, extractTopLevelDeclaration } from './source-helpers.mjs';

const root = new URL('../', import.meta.url);

test('the first anonymous limit reached blocks new participation', async () => {
  const api = await readFile(new URL('api.js', root), 'utf8');
  const reason = extractTopLevelDeclaration(api, 'anonymousRegistrationReason');
  const vote = extractTopLevelDeclaration(api, 'vote');
  const reset = extractTopLevelDeclaration(api, 'resetDuel');

  assert.match(api, /const ANONYMOUS_LIMIT = 10;/);
  assert.match(api, /const ANONYMOUS_DUEL_LIMIT = 2;/);
  assert.match(reason, /votesUsed >= ANONYMOUS_LIMIT/);
  assert.match(reason, /duelsCompleted >= ANONYMOUS_DUEL_LIMIT/);
  assert.match(vote, /anonymousRegistrationReason\(participation\)/);
  assert.match(reset, /anonymousRegistrationReason\(participation, true\)/);
  assert.match(reset, /registrationRequired/);
});

test('duel rounds do not consume free votes and completion is counted once', async () => {
  const [api, bottomApi] = await Promise.all([
    readFile(new URL('api.js', root), 'utf8'),
    readFile(new URL('duel-bottom-api.js', root), 'utf8'),
  ]);
  const duel = extractTopLevelDeclaration(api, 'saveDuel');
  const bottomDuel = extractTopLevelDeclaration(bottomApi, 'saveBottomUpDuel');

  for (const implementation of [duel, bottomDuel]) {
    assert.match(implementation, /tracksAnonymousDuel/);
    assert.match(implementation, /anonymous_duel_usage/);
    assert.match(implementation, /tracked_completion/);
    assert.doesNotMatch(implementation, /INSERT INTO anonymous_(?:vote_)?usage/);
  }
  assert.match(duel, /tracksAnonymousDuel && !modesBefore\.duel\.sessionId/);
  assert.match(bottomDuel, /tracksAnonymousDuel && !duel\.sessionId/);
});

test('the migration separates historical free votes from completed duels', async () => {
  const migration = await readFile(
    new URL('migrations/20260903_anonymous_duel_limit.sql', root),
    'utf8',
  );
  const compact = compactSource(migration);

  assert.match(migration, /CREATE TABLE IF NOT EXISTS anonymous_vote_usage/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS anonymous_duel_usage/);
  assert.match(migration, /session\.completed = true/);
  assert.doesNotMatch(migration, /UPDATE anonymous_usage/);
  assert.match(compact, /ranking\.is_vip=false/);
  assert.match(compact, /COUNT\(DISTINCTselection\.ranking_id\)/);
});

test('the registration wall explains whether votes or duels reached the limit', async () => {
  const app = await readFile(new URL('app.js', root), 'utf8');
  const wall = extractTopLevelDeclaration(app, 'showRegistrationWall');
  const account = extractTopLevelDeclaration(app, 'renderAccount');

  assert.match(wall, /votos livres usados/);
  assert.match(wall, /Duelos concluídos/);
  assert.match(wall, /Para continuar, faça seu cadastro/);
  assert.match(account, /anonymousAccessExhausted/);
  assert.match(account, /duelos/);
});
