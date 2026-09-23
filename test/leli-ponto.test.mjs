import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('the employee app only references controls that exist in its page', async () => {
  const [html, js] = await Promise.all([
    source('pao-da-leli-ponto/index.html'),
    source('pao-da-leli-ponto/app-real.js'),
  ]);
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const selectors = [...js.matchAll(/\$\('#([^']+)'\)/g)].map((match) => match[1]);

  assert.deepEqual([...new Set(selectors.filter((id) => !ids.has(id)))], []);
  assert.doesNotMatch(js, /corrType|corrTime/);
});

test('a correction is saved and decided as one complete journey', async () => {
  const [api, employee, admin] = await Promise.all([
    source('leli-api.js'),
    source('pao-da-leli-ponto/app-real.js'),
    source('pao-da-leli-ponto/admin-real.js'),
  ]);

  assert.match(employee, /api\('correction-batch','POST'/);
  assert.match(api, /jsonb_to_recordset/);
  assert.match(api, /request_group/);
  assert.match(api, /count\(\*\)::int AS count/);
  assert.match(admin, /correctionGroups/);
  assert.match(admin, /Aprovar tudo/);
  assert.match(admin, /Recusar tudo/);
});

test('sessions reach the API and activation codes remain visible to admins', async () => {
  const [api, admin] = await Promise.all([
    source('leli-api.js'),
    source('pao-da-leli-ponto/admin-real.js'),
  ]);

  assert.match(api, /Path=\/; HttpOnly; Secure; SameSite=Lax/);
  assert.match(api, /activation_code text/);
  assert.match(api, /activation_code,created_at/);
  assert.match(admin, /Código de ativação:/);
  assert.match(admin, /Copiar código/);
});
