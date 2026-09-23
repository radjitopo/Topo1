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

test('administrators cannot use the employee app or employee-only API actions', async () => {
  const [api, employee] = await Promise.all([
    source('leli-api.js'),
    source('pao-da-leli-ponto/app-real.js'),
  ]);

  assert.match(employee, /if\(user\?\.role!=='employee'\)\{location\.replace\('\.\/admin\.html'\);return false\}/);
  assert.match(employee, /if\(!\(await enterEmployeeApp\(m\.user\)\)\)return/);
  assert.match(employee, /await enterEmployeeApp\(r\.user\)/);
  assert.match(api, /employeeActions=\['photo','today','history','punch','checklist','checkout','messages-read','correction-batch','correction'\]/);
  assert.match(api, /employeeActions\.includes\(action\)&&user\.role!=='employee'/);
  assert.match(api, /Esta área é exclusiva para colaboradores/);
});

test('leaving the admin area ends the session before opening the employee login', async () => {
  const [html, admin, sw] = await Promise.all([
    source('pao-da-leli-ponto/admin.html'),
    source('pao-da-leli-ponto/admin-real.js'),
    source('pao-da-leli-ponto/sw.js'),
  ]);

  assert.match(html, /id="leaveAdmin"/);
  assert.match(html, /Sair para o ponto/);
  assert.match(admin, /async function endAdminSession\(destination\)/);
  assert.match(admin, /await api\('logout','POST',\{\}\)/);
  assert.match(admin, /if\(destination\)location\.replace\(destination\)/);
  assert.match(admin, /\$\('#leaveAdmin'\)\.addEventListener\('click'/);
  assert.doesNotMatch(admin, /catch\{\}currentUser=null/);
  assert.match(html, /admin-real\.js\?v=11/);
  assert.match(sw, /admin-real\.js\?v=11/);
});

test('a correction is sent as one journey and each time is decided separately', async () => {
  const [api, employee, admin, employeeHtml, adminHtml] = await Promise.all([
    source('leli-api.js'),
    source('pao-da-leli-ponto/app-real.js'),
    source('pao-da-leli-ponto/admin-real.js'),
    source('pao-da-leli-ponto/index.html'),
    source('pao-da-leli-ponto/admin.html'),
  ]);

  assert.match(employee, /api\('correction-batch','POST'/);
  assert.match(api, /jsonb_to_recordset/);
  assert.match(api, /request_group/);
  assert.match(api, /count\(\*\)::int AS count/);
  assert.match(admin, /correctionGroups/);
  assert.match(admin, /pendingCorrectionRequests/);
  assert.match(admin, /decideCorrection/);
  assert.match(admin, /api\('admin-decide-correction','POST'/);
  assert.match(admin, /redoCorrection/);
  assert.match(admin, />Refazer</);
  assert.match(admin, /api\('admin-reset-correction-decision','POST'/);
  assert.match(api, /action==='admin-reset-correction-decision'/);
  assert.match(api, /status='pending',decided_by=NULL,decided_at=NULL,decision_note=NULL/);
  assert.doesNotMatch(admin, /Aprovar tudo|Recusar tudo|admin-decide-correction-group/);
  assert.match(adminHtml, /id="correctionCount"/);
  assert.match(employeeHtml, /id="confirmDetails"/);
  assert.match(employee, /O administrador ainda precisa aprovar/);
  assert.match(employee, /horários antigos continuam valendo/);
  assert.match(employee, /\['Data',fullDateLabel\(correctionDate\)\]/);
  assert.match(employee, /\['Status','Aguardando aprovação'\]/);
});

test('corrections accept consecutive punches recorded in the same minute', async () => {
  const [api, employee] = await Promise.all([
    source('leli-api.js'),
    source('pao-da-leli-ponto/app-real.js'),
  ]);

  assert.match(employee, /value<minutes\[index-1\]/);
  assert.match(api, /value<minutes\[index-1\]/);
  assert.doesNotMatch(employee, /Os horários precisam seguir a ordem: chegada/);
  assert.doesNotMatch(api, /Os horários precisam seguir a ordem: chegada/);
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

test('checkout requires the area checklist and delivers individual messages', async () => {
  const [api, employeeHtml, employee, adminHtml, admin, sw] = await Promise.all([
    source('leli-api.js'),
    source('pao-da-leli-ponto/index.html'),
    source('pao-da-leli-ponto/app-real.js'),
    source('pao-da-leli-ponto/admin.html'),
    source('pao-da-leli-ponto/admin-real.js'),
    source('pao-da-leli-ponto/sw.js'),
  ]);

  assert.match(api, /CREATE TABLE IF NOT EXISTS leli_checklist_items/);
  assert.match(api, /CREATE TABLE IF NOT EXISTS leli_checklist_submissions/);
  assert.match(api, /WHERE unit=\$\{user\.unit\} AND active=true/);
  assert.match(api, /needsChecklist:true/);
  assert.match(api, /action==='checkout'/);
  assert.match(api, /typeof answer\?\.answer!=='boolean'/);
  assert.match(api, /checkout_with_checklist/);
  assert.match(api, /action==='messages-read'/);
  assert.match(api, /action==='admin-checklist'/);
  assert.match(api, /action==='admin-save-checklist'/);
  assert.match(employeeHtml, /id="checklistForm"/);
  assert.match(employeeHtml, /id="messageRecipient"/);
  assert.match(employeeHtml, /id="unreadMessages"/);
  assert.match(employee, /before==='afterbreak'/);
  assert.match(employee, /api\('checkout','POST'/);
  assert.match(employee, /api\('messages-read','POST'/);
  assert.match(adminHtml, /data-tab="checklistAdmin"/);
  assert.match(adminHtml, /id="checklistFormAdmin"/);
  assert.match(adminHtml, /id="checklistHistory"/);
  assert.match(admin, /api\('admin-checklist'/);
  assert.match(admin, /api\('admin-save-checklist','POST'/);
  assert.match(employeeHtml, /app-real\.js\?v=10/);
  assert.match(adminHtml, /admin-real\.js\?v=11/);
  assert.match(sw, /leli-ponto-v16/);
  assert.match(sw, /app-real\.js\?v=10/);
  assert.match(sw, /admin-real\.js\?v=11/);
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
