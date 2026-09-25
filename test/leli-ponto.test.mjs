import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildMonthlyReport } from '../leli-report.js';
import { demoRecipes } from '../leli-recipes-data.js';

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
  assert.match(html, /href="\.\/admin\.html">Entrar como administrador<\/a>/);
  assert.match(html, /\.admin-login-link\{/);
});

test('administrators cannot use the employee app or employee-only API actions', async () => {
  const [api, employee] = await Promise.all([
    source('leli-api.js'),
    source('pao-da-leli-ponto/app-real.js'),
  ]);

  assert.match(employee, /if\(user\?\.role!=='employee'\)/);
  assert.match(employee, /api\('logout','POST',\{\}\)\.catch/);
  assert.match(employee, /currentUser=null;show\('login'\);return false/);
  assert.doesNotMatch(employee, /location\.replace\('\.\/admin\.html'\)/);
  assert.match(employee, /if\(!\(await enterEmployeeApp\(m\.user\)\)\)return/);
  assert.match(employee, /await enterEmployeeApp\(r\.user\)/);
  assert.match(api, /employeeActions=\['photo','today','history','punch','checklist','checkout','messages-read','correction-batch','correction'\]/);
  assert.match(api, /employeeActions\.includes\(action\)&&user\.role!=='employee'/);
  assert.match(api, /Esta área é exclusiva para colaboradores/);
});

test('employees can browse point history month by month', async () => {
  const [api, html, employee, sw] = await Promise.all([
    source('leli-api.js'),
    source('pao-da-leli-ponto/index.html'),
    source('pao-da-leli-ponto/app-real.js'),
    source('pao-da-leli-ponto/sw.js'),
  ]);

  assert.match(html, /id="previousMonth"/);
  assert.match(html, /id="nextMonth"/);
  assert.match(html, /aria-label="Mês anterior"/);
  assert.match(html, /aria-label="Próximo mês"/);
  assert.match(employee, /api\('history','GET',\{month\}\)/);
  assert.match(employee, /currentHistoryMonth=shiftMonth\(currentHistoryMonth,-1\)/);
  assert.match(employee, /if\(next>currentMonth\(\)\)return/);
  assert.match(api, /action==='history'/);
  assert.match(api, /getMonthBounds\(month\)/);
  assert.match(api, /work_date BETWEEN \$\{bounds\.start\}::date AND \$\{bounds\.end\}::date/);
  assert.match(html, /app-real\.js\?v=20/);
  assert.match(sw, /leli-ponto-v38/);
  assert.match(sw, /app-real\.js\?v=20/);
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
  assert.match(html, /admin-real\.js\?v=22/);
  assert.match(sw, /admin-real\.js\?v=22/);
});

test('forgotten passwords can be requested and reset with a new admin-issued code', async () => {
  const [api, employeeHtml, employee, adminHtml, admin] = await Promise.all([
    source('leli-api.js'),
    source('pao-da-leli-ponto/index.html'),
    source('pao-da-leli-ponto/app-real.js'),
    source('pao-da-leli-ponto/admin.html'),
    source('pao-da-leli-ponto/admin-real.js'),
  ]);

  assert.match(api, /password_reset_requested_at timestamptz/);
  assert.match(api, /action==='request-password-reset'/);
  assert.match(api, /Se o telefone ou e-mail estiver cadastrado/);
  assert.match(api, /password_reset_requested_at=NULL/);
  assert.match(api, /action==='admin-reset-activation'/);
  assert.match(api, /reset_password_code/);
  assert.match(api, /DELETE FROM leli_sessions WHERE user_id=\$\{id\}/);
  assert.match(employeeHtml, /id="goForgotPassword"/);
  assert.match(employeeHtml, /id="forgotPasswordForm"/);
  assert.match(employee, /api\('request-password-reset','POST'/);
  assert.match(adminHtml, /id="adminForgotPassword"/);
  assert.match(admin, /pediu nova senha/);
  assert.match(admin, /Gerar novo código/);
  assert.match(admin, /Novo código de senha/);
});

test('new employees and administrators are registered with name and phone', async () => {
  const [api, employeeHtml, employee, adminHtml, admin, recipeHtml, recipeApp] =
    await Promise.all([
      source('leli-api.js'),
      source('pao-da-leli-ponto/index.html'),
      source('pao-da-leli-ponto/app-real.js'),
      source('pao-da-leli-ponto/admin.html'),
      source('pao-da-leli-ponto/admin-real.js'),
      source('pao-da-leli-ponto/receitas.html'),
      source('pao-da-leli-ponto/receitas-real.js'),
    ]);

  assert.match(api, /ALTER TABLE leli_users ADD COLUMN IF NOT EXISTS phone text/);
  assert.match(api, /leli_users_phone_unique/);
  assert.match(api, /ALTER TABLE leli_users ALTER COLUMN email DROP NOT NULL/);
  assert.match(api, /function normPhone/);
  assert.match(api, /function identifierFrom/);
  assert.match(api, /INSERT INTO leli_users\(email,phone,name,role/);
  assert.match(adminHtml, /id="empPhone" type="tel"/);
  assert.match(adminHtml, /id="newAdminPhone" type="tel"/);
  assert.match(adminHtml, /id="setupPhone" type="tel"/);
  assert.doesNotMatch(adminHtml, /id="empEmail"|id="newAdminEmail"/);
  assert.match(admin, /phone:\$\('#empPhone'\)\.value\.trim\(\)/);
  assert.match(admin, /phone:\$\('#newAdminPhone'\)\.value\.trim\(\)/);
  assert.match(employeeHtml, /id="identifier"/);
  assert.match(employee, /identifier:\$\('#identifier'\)\.value\.trim\(\)/);
  assert.match(recipeHtml, /id="recipeIdentifier"/);
  assert.match(recipeApp, /identifier:\$\('#recipeIdentifier'\)\.value\.trim\(\)/);
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
  assert.match(api, /activation_code,password_reset_requested_at,created_at/);
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
  assert.match(api, /unit IN \('Pão da Leli','Pão da Leli atendimento'\)/);
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

test('checkout requires the area checklist, tracks missing items and delivers team or individual messages', async () => {
  const [api, employeeHtml, employee, adminHtml, admin, sw] = await Promise.all([
    source('leli-api.js'),
    source('pao-da-leli-ponto/index.html'),
    source('pao-da-leli-ponto/app-real.js'),
    source('pao-da-leli-ponto/admin.html'),
    source('pao-da-leli-ponto/admin-real.js'),
    source('pao-da-leli-ponto/sw.js'),
  ]);

  assert.match(api, /CREATE TABLE IF NOT EXISTS leli_checklist_items/);
  assert.match(api, /CREATE TABLE IF NOT EXISTS leli_checklist_missing_options/);
  assert.match(api, /CREATE TABLE IF NOT EXISTS leli_checklist_submissions/);
  assert.match(api, /CREATE TABLE IF NOT EXISTS leli_checklist_message_reads/);
  assert.match(api, /CREATE TABLE IF NOT EXISTS leli_missing_reports/);
  assert.match(api, /WHERE unit=\$\{user\.unit\} AND active=true/);
  assert.match(api, /needsChecklist:true/);
  assert.match(api, /action==='checkout'/);
  assert.match(api, /if\(!items\.length\)return json\(res,409/);
  assert.match(api, /typeof answer\?\.answer!=='boolean'/);
  assert.match(api, /checkout_with_checklist/);
  assert.match(api, /missingItemIds/);
  assert.match(api, /messageAudience/);
  assert.match(api, /message_audience='team'/);
  assert.match(api, /action==='messages-read'/);
  assert.match(api, /action==='admin-checklist'/);
  assert.match(api, /action==='admin-save-checklist'/);
  assert.match(api, /action==='admin-resolve-missing'/);
  assert.match(employeeHtml, /id="checklistForm"/);
  assert.match(employeeHtml, /id="missingOptions"/);
  assert.match(employeeHtml, /id="messageRecipient"/);
  assert.match(employeeHtml, /Toda a equipe/);
  assert.match(employeeHtml, /id="unreadMessages"/);
  assert.match(employee, /before==='afterbreak'/);
  assert.doesNotMatch(employee, /if\(p\.kind==='breakIn'\)\{await openChecklist\(\);return\}/);
  assert.match(employee, /\$\('#checklistSubmit'\)\.disabled=!hasQuestions/);
  assert.match(employee, /api\('checkout','POST'/);
  assert.match(employee, /api\('messages-read','POST'/);
  assert.match(adminHtml, /data-tab="checklistAdmin"/);
  assert.match(adminHtml, /id="checklistFormAdmin"/);
  assert.match(adminHtml, /id="missingOptionsAdmin"/);
  assert.match(adminHtml, /id="missingReports"/);
  assert.match(adminHtml, /id="closingMessages"/);
  assert.match(adminHtml, /id="checklistHistory"/);
  assert.match(adminHtml, /\.checklist-row-actions\{grid-column:auto;justify-content:flex-end\}/);
  assert.match(adminHtml, /\.missing-report-count\{/);
  assert.match(adminHtml, /white-space:nowrap/);
  assert.match(admin, /class="missing-report-count"/);
  assert.match(admin, />Resolvido<\/button>/);
  assert.doesNotMatch(admin, />Comprado<\/button>/);
  assert.match(admin, /api\('admin-checklist'/);
  assert.match(admin, /api\('admin-save-checklist','POST'/);
  assert.match(admin, /api\('admin-resolve-missing','POST'/);
  assert.match(employeeHtml, /app-real\.js\?v=20/);
  assert.match(adminHtml, /admin-real\.js\?v=22/);
  assert.match(sw, /leli-ponto-v38/);
  assert.match(sw, /app-real\.js\?v=20/);
  assert.match(sw, /admin-real\.js\?v=22/);
  assert.match(employeeHtml, /logo-leli-oficial\.jpg\?v=2/);
  assert.match(adminHtml, /logo-leli-oficial\.jpg\?v=2/);
  assert.match(sw, /logo-leli-oficial\.jpg\?v=2/);
});

test('admins can require the bakery network and location or temporarily leave punches free', async () => {
  const [api, employeeHtml, employee, adminHtml, admin, vercel] = await Promise.all([
    source('leli-api.js'),
    source('pao-da-leli-ponto/index.html'),
    source('pao-da-leli-ponto/app-real.js'),
    source('pao-da-leli-ponto/admin.html'),
    source('pao-da-leli-ponto/admin-real.js'),
    source('vercel.json'),
  ]);

  assert.match(api, /CREATE TABLE IF NOT EXISTS leli_access_policy/);
  assert.match(api, /CREATE TABLE IF NOT EXISTS leli_access_profiles/);
  assert.match(api, /x-forwarded-for/);
  assert.match(api, /networkFingerprint/);
  assert.match(api, /distanceMeters/);
  assert.match(api, /ACCESS_RADIUS_METERS = 20/);
  assert.match(api, /action==='admin-access-policy'/);
  assert.match(api, /mode:'restricted'/);
  assert.match(api, /mode:'free'/);
  assert.match(api, /validatePunchAccess\(req,body\(req\)\)/);
  assert.match(api, /validatePunchAccess\(req,b\)/);
  assert.match(api, /accessDenied:true/);
  assert.match(employeeHtml, /id="accessNotice"/);
  assert.match(employee, /captureLocation/);
  assert.match(employee, /enableHighAccuracy:true/);
  assert.match(employee, /punchAccessPayload/);
  assert.match(adminHtml, /id="restrictPunches"/);
  assert.match(adminHtml, /id="freePunches"/);
  assert.match(adminHtml, /id="accessPolicyLocation"/);
  assert.match(adminHtml, /id="accessPolicyNetwork"/);
  assert.match(adminHtml, /id="accessProfileList"/);
  assert.match(adminHtml, /Abrir no mapa/);
  assert.match(adminHtml, /Até 20 metros/);
  assert.match(admin, /admin-access-policy/);
  assert.match(admin, /Atualizar local \+ rede/);
  assert.match(adminHtml, /Locais e redes salvos/);
  assert.match(admin, /Ativar esta configuração/);
  assert.match(admin, /activateAccessProfile/);
  assert.match(admin, /profileId/);
  assert.match(api, /activate_access_profile/);
  assert.match(api, /accessProfiles:profiles\.map\(accessProfileView\)/);
  assert.match(api, /view\.networkCode/);
  assert.match(api, /view\.networkName/);
  assert.match(api, /view\.latitude/);
  assert.match(admin, /policy\?\.networkCode/);
  assert.match(admin, /policy\.networkName/);
  assert.match(admin, /Qual nome você quer mostrar para esta rede/);
  assert.match(api, /network_name text/);
  assert.match(admin, /funcionários poderão registrar de qualquer lugar/);
  assert.match(vercel, /geolocation=\(self\)/);
  assert.doesNotMatch(vercel, /geolocation=\(\)/);
});

test('monthly closing calculates hours, absences and approved corrections from schedule history', () => {
  const employee = { id: 'employee-1', name: 'Leli', unit: 'Pão da Leli Café', active: true };
  const report = buildMonthlyReport({
    month: '2026-09',
    employees: [employee],
    scheduleVersions: [{
      user_id: employee.id,
      effective_from: '2026-09-07',
      schedule: [
        { weekday: 1, start_time: '08:00', break_start_time: '12:00', break_end_time: '13:00', end_time: '17:00' },
        { weekday: 2, start_time: '08:00', break_start_time: '12:00', break_end_time: '13:00', end_time: '17:00' },
      ],
    }],
    punches: [
      { user_id: employee.id, work_date: '2026-09-07', kind: 'in', occurred_at: '2026-09-07T11:10:00.000Z' },
      { user_id: employee.id, work_date: '2026-09-07', kind: 'breakOut', occurred_at: '2026-09-07T15:00:00.000Z' },
      { user_id: employee.id, work_date: '2026-09-07', kind: 'breakIn', occurred_at: '2026-09-07T16:00:00.000Z' },
      { user_id: employee.id, work_date: '2026-09-07', kind: 'out', occurred_at: '2026-09-07T20:00:00.000Z' },
    ],
    corrections: [{
      id: 'correction-1',
      user_id: employee.id,
      work_date: '2026-09-07',
      kind: 'in',
      status: 'approved',
      requested_at: '2026-09-07T11:00:00.000Z',
      decided_at: '2026-09-07T21:00:00.000Z',
      request_group: 'group-1',
    }],
    now: new Date('2026-09-09T02:00:00.000Z'),
  });

  assert.equal(report.periodEnd, '2026-09-08');
  assert.equal(report.rows.length, 2);
  assert.equal(report.rows[0].workedMinutes, 480);
  assert.equal(report.rows[0].delayMinutes, 0);
  assert.equal(report.rows[1].status, 'Falta');
  assert.deepEqual(report.totals, {
    expectedMinutes: 960,
    workedMinutes: 480,
    delayMinutes: 0,
    absenceDays: 1,
    incompleteDays: 0,
    correctionRequests: 1,
    pendingCorrections: 0,
  });
});

test('the admin monthly closing can filter employees and export spreadsheet or PDF', async () => {
  const [api, html, admin] = await Promise.all([
    source('leli-api.js'),
    source('pao-da-leli-ponto/admin.html'),
    source('pao-da-leli-ponto/admin-real.js'),
  ]);

  assert.match(api, /CREATE TABLE IF NOT EXISTS leli_schedule_versions/);
  assert.match(api, /action==='admin-monthly-report'/);
  assert.match(api, /buildMonthlyReport/);
  assert.match(html, /data-tab="reports">Fechamento/);
  assert.match(html, /id="reportMonth"/);
  assert.match(html, /id="reportEmployee"/);
  assert.match(html, /id="downloadReportCsv"/);
  assert.match(html, /id="printReport"/);
  assert.match(admin, /admin-monthly-report/);
  assert.match(admin, /text\/csv;charset=utf-8/);
  assert.match(admin, /popup\.print\(\)/);
});

test('an administrator can reset test data while keeping only their account and current session', async () => {
  const [api, html, admin, sw] = await Promise.all([
    source('leli-api.js'),
    source('pao-da-leli-ponto/admin.html'),
    source('pao-da-leli-ponto/admin-real.js'),
    source('pao-da-leli-ponto/sw.js'),
  ]);

  assert.match(api, /action==='admin-reset-system'/);
  assert.match(api, /confirmation!=='APAGAR TUDO'/);
  assert.match(api, /await sql\.transaction\(\[/);
  assert.match(api, /LOCK TABLE leli_users,leli_sessions/);
  for (const table of [
    'leli_checklist_message_reads',
    'leli_missing_reports',
    'leli_checklist_submissions',
    'leli_checklist_items',
    'leli_checklist_missing_options',
    'leli_corrections',
    'leli_schedule_versions',
    'leli_schedules',
    'leli_punches',
    'leli_audit_log',
    'leli_access_profiles',
  ]) assert.match(api, new RegExp(`DELETE FROM ${table}`));
  assert.match(api, /DELETE FROM leli_sessions WHERE token_hash<>\$\{currentSessionHash\}/);
  assert.match(api, /DELETE FROM leli_users WHERE id<>\$\{user\.id\}/);
  assert.match(api, /UPDATE leli_access_policy SET mode='free'.*active_profile_id=NULL/);
  assert.match(api, /UPDATE leli_users SET active=true.*password_reset_requested_at=NULL/);
  assert.match(html, /id="resetSystem"/);
  assert.match(html, /somente o administrador que apertar o botão/);
  assert.match(admin, /api\('admin-reset-system','POST',\{confirmation:'APAGAR TUDO'\}\)/);
  assert.match(admin, /location\.reload\(\)/);
  assert.match(html, /admin-real\.js\?v=22/);
  assert.match(sw, /leli-ponto-v38/);
  assert.match(sw, /admin-real\.js\?v=22/);
});
test('the recipe book scales demo recipes and keeps management in the point admin', async () => {
  const [api, employeeHtml, recipeHtml, recipeApp, adminHtml, admin, sw, vercel] =
    await Promise.all([
      source('leli-api.js'),
      source('pao-da-leli-ponto/index.html'),
      source('pao-da-leli-ponto/receitas.html'),
      source('pao-da-leli-ponto/receitas-real.js'),
      source('pao-da-leli-ponto/admin.html'),
      source('pao-da-leli-ponto/admin-real.js'),
      source('pao-da-leli-ponto/sw.js'),
      source('vercel.json'),
    ]);

  assert.equal(demoRecipes.length, 28);
  assert.equal(new Set(demoRecipes.map((recipe) => recipe.id)).size, 28);
  assert.ok(demoRecipes.some((recipe) => recipe.category === 'Bebidas'));
  assert.match(employeeHtml, /href="\.\/receitas\.html"/);
  assert.match(recipeHtml, /id="recipeApp"/);
  assert.match(recipeApp, /const batchOptions=\[1,1\.5,2,3\]/);
  assert.match(recipeApp, /api\('admin-recipes'\)/);
  assert.match(adminHtml, /data-tab="recipesAdmin"/);
  assert.match(adminHtml, /id="recipeForm"/);
  assert.match(admin, /admin-save-recipe/);
  assert.match(admin, /admin-delete-recipe/);
  assert.match(api, /CREATE TABLE IF NOT EXISTS leli_recipes/);
  assert.match(api, /action==='admin-recipes'/);
  assert.match(api, /action==='admin-save-recipe'/);
  assert.match(api, /action==='admin-delete-recipe'/);
  assert.match(sw, /receitas-real\.js\?v=2/);
  assert.match(vercel, /"src": "\/receitas\/\?"/);
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
