import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compactSource } from './source-helpers.mjs';

const root = new URL('../', import.meta.url);

test('registered votes have one canonical owner per account and option', async () => {
  const [api, migration] = await Promise.all([
    readFile(new URL('api.js', root), 'utf8'),
    readFile(new URL('migrations/20260825_vote_identity.sql', root), 'utf8'),
  ]);

  assert.match(migration, /ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users/);
  assert.match(
    migration,
    /CREATE UNIQUE INDEX IF NOT EXISTS votes_user_option_unique_idx[\s\S]*ON votes \(user_id, option_id\)[\s\S]*WHERE user_id IS NOT NULL/,
  );
  assert.match(migration, /PARTITION BY vote\.user_id, vote\.option_id/);
  assert.match(api, /async function mergeAnonymousVotes\(userId, deviceId\)/);
  assert.match(
    api,
    /DELETE FROM votes AS anonymous_vote[\s\S]*account_vote\.user_id = \$1[\s\S]*account_vote\.option_id = anonymous_vote\.option_id/,
    'an existing account vote must win over a duplicate anonymous vote',
  );
  assert.match(api, /INSERT INTO votes \(device_id, user_id, option_id, direction, updated_at\)/);
});

test('logout keeps the browser identity and linked browsers require login to vote', async () => {
  const [api, app] = await Promise.all([
    readFile(new URL('api.js', root), 'utf8'),
    readFile(new URL('app.js', root), 'utf8'),
  ]);
  const compactApp = compactSource(app);
  const logoutStart = compactApp.indexOf('asyncfunctionlogout()');
  const logoutEnd = compactApp.indexOf('functionshowModal(', logoutStart);
  const logout = compactApp.slice(logoutStart, logoutEnd);

  assert.ok(logoutStart >= 0 && logoutEnd > logoutStart);
  assert.doesNotMatch(logout, /rotateDeviceId\(/);
  assert.match(api, /account_required_on_this_device/);
  assert.match(api, /!user && \(await deviceAccountId\(deviceId\)\)/);
  assert.match(compactApp, /functionshowAccountRequired\(\)/);
  assert.match(compactApp, /result\.error==='account_required_on_this_device'/);
});
