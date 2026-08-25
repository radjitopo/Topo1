import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compactSource } from './source-helpers.mjs';

test('the notification center is persisted, generated and visible beside the profile', async () => {
  const [api, app, css, index, migration] = await Promise.all([
    readFile(new URL('../api.js', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../migrations/20260824_notifications.sql', import.meta.url), 'utf8'),
  ]);
  const compactApp = compactSource(app);

  assert.match(migration, /CREATE TABLE IF NOT EXISTS user_notifications/);
  assert.match(migration, /notification_last_seen_at/);
  assert.match(migration, /user_notifications_unread_idx/);

  assert.match(api, /async function notifications\(req, res, body = null\)/);
  assert.match(api, /async function queueRankingChangeNotifications/);
  assert.match(api, /orderBefore !== orderAfter/);
  assert.match(api, /NOTIFICATION_RETURN_DAYS = 7/);
  assert.match(api, /action === 'notifications'/);
  assert.match(api, /Você ganhou um voto duplo/);
  assert.match(api, /Novo nível:/);

  assert.match(compactApp, /notificationButton/);
  assert.match(compactApp, /\/api\?action=notifications/);
  assert.match(compactApp, /operation:'read-all'/);
  assert.match(
    compactApp,
    /notificationButton[\s\S]*href="\/perfil">Perfil/,
    'the bell must appear immediately beside the profile link',
  );
  assert.match(css, /\.notificationPanel/);
  assert.match(css, /\.notificationBadge/);
  assert.match(index, /app\.js\?v=20260825-34-dense-home/);
  assert.match(index, /style\.css\?v=20260825-9-seo/);
});
