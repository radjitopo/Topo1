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
  const selectors = [...js.matchAll(/(?<!\$)\$\('#([^']+)'\)/g)].map((match) => match[1]);

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

test('employee registration requires one of the two Pão da Leli areas', async () => {
  const [html, admin, api] = await Promise.all([
    source('pao-da-leli-ponto/admin.html'),
    source('pao-da-leli-ponto/admin-real.js'),
    source('leli-api.js'),
  ]);

  assert.match(html, /<select id="empUnit" required/);
  assert.match(html, /Escolha a área/);
  assert.match(html, /value="Pão da Leli Café"/);
  assert.match(html, /value="Pão da Leli Produção"/);
  assert.doesNotMatch(html, /id="empRole"/);
  assert.doesNotMatch(admin, /\$\('#empRole'\)/);
  assert.match(admin, /position:'Colaborador'/);
  assert.match(api, /EMPLOYEE_UNITS = new Set\(\['Pão da Leli Café','Pão da Leli Produção'\]\)/);
  assert.match(api, /!EMPLOYEE_UNITS\.has\(unit\)/);
});

test('admins can open an employee record with full history and a weekly schedule', async () => {
  const [api, html, admin] = await Promise.all([
    source('leli-api.js'),
    source('pao-da-leli-ponto/admin.html'),
    source('pao-da-leli-ponto/admin-real.js'),
  ]);

  assert.match(api, /CREATE TABLE IF NOT EXISTS leli_schedules/);
  assert.match(api, /action==='admin-employee-detail'/);
  assert.match(api, /FROM leli_punches WHERE user_id=\$\{id\}/);
  assert.match(api, /action==='admin-save-schedule'/);
  assert.match(api, /Acesso restrito aos administradores/);
  assert.match(html, /id="employeeDetail"/);
  assert.match(html, /id="scheduleForm"/);
  assert.match(html, /id="employeeHistory"/);
  assert.match(admin, /openEmployee/);
  assert.match(admin, /admin-employee-detail/);
  assert.match(admin, /admin-save-schedule/);
  assert.match(admin, /Segunda-feira/);
});

test('the admin app only references controls that exist in its page', async () => {
  const [html, js] = await Promise.all([
    source('pao-da-leli-ponto/admin.html'),
    source('pao-da-leli-ponto/admin-real.js'),
  ]);
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const selectors = [...js.matchAll(/(?<!\$)\$\('#([^']+)'\)/g)].map((match) => match[1]);

  assert.deepEqual([...new Set(selectors.filter((id) => !ids.has(id)))], []);
});
