import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createMissingExitFixture, employeeId } from './leli-missing-exit-fixture.mjs';

let fixture;
before(async () => { fixture = await createMissingExitFixture({ now: new Date('2026-11-14T15:00:00Z') }); });
after(async () => { await fixture?.db.close(); });
beforeEach(async () => {
  await fixture.reset();
  await fixture.db.query('UPDATE leli_users SET daily_work_minutes=345 WHERE id=$1', [employeeId]);
});
const save = (dailyHours, effectiveFrom, id = employeeId) => fixture.request('admin-save-daily-hours', 'POST', { id, dailyHours, effectiveFrom }, 'admin');
const report = month => fixture.request('admin-monthly-report', 'GET', {}, 'admin', { month, employeeId });
async function seedComplete(date) {
  await fixture.seedDay(date, employeeId, date === '2026-10-01' ? ['out'] : ['in', 'breakOut', 'breakIn', 'out']);
  await fixture.db.query("UPDATE leli_punches SET occurred_at=($2::date+time '08:00') AT TIME ZONE 'America/Sao_Paulo' WHERE user_id=$1 AND work_date=$2::date AND kind='in'", [employeeId, date]);
}

test('a mudança de 5h45 para 8h mantém o saldo dos meses anteriores', async () => {
  await seedComplete('2026-09-30'); await seedComplete('2026-10-01');
  const previous = (await report('2026-09')).data;
  const result = await save(8, '2026-10-01');
  assert.equal(result.statusCode, 200, JSON.stringify(result.data));
  assert.deepEqual(result.data.employee.daily_hours_versions.map(v => [v.effective_from, v.daily_work_minutes]), [['1900-01-01', 345], ['2026-10-01', 480]]);
  const september = (await report('2026-09')).data;
  assert.equal(september.rows[0].dailyWorkMinutes, 345);
  assert.equal(september.totals.balanceNetMinutes, previous.totals.balanceNetMinutes);
  const october = (await report('2026-10')).data;
  assert.equal(october.rows[0].dailyWorkMinutes, 480);
  assert.equal(october.rows[0].balanceMinutes, 0);
  const review = await fixture.request('admin-monthly-times', 'GET', {}, 'admin', { id: employeeId, month: '2026-09' });
  assert.equal(review.data.days[29].expectedMinutes, 345);
  assert.equal(review.data.employee.daily_work_minutes, 345);
  const audit = (await fixture.db.query("SELECT details FROM leli_audit_log WHERE action='save_daily_hours'")).rows;
  assert.equal(audit[0].details.effectiveFrom, '2026-10-01');
});

test('uma alteração retroativa conserva a jornada posterior e não muda o período anterior', async () => {
  assert.equal((await save(8, '2026-10-01')).statusCode, 200);
  const saved = await save(6, '2026-09-01');
  assert.equal(saved.statusCode, 200, JSON.stringify(saved.data));
  assert.equal(saved.data.employee.daily_work_minutes, 480);
  await seedComplete('2026-08-31'); await seedComplete('2026-09-30');
  assert.equal((await report('2026-08')).data.rows[0].expectedMinutes, 345);
  assert.equal((await report('2026-09')).data.rows[0].expectedMinutes, 360);
});

test('um mês com mudança de jornada calcula cada dia e identifica a vigência na folha', async () => {
  await seedComplete('2026-10-01'); await seedComplete('2026-10-20');
  assert.equal((await save(8, '2026-10-16')).statusCode, 200);
  const data = (await report('2026-10')).data;
  assert.deepEqual(data.rows.map(row => row.expectedMinutes), [345, 480]);
  assert.deepEqual(data.rows.map(row => row.balanceMinutes), [135, 0]);
  assert.deepEqual(data.rows.map(row => row.overtimeDailyMinutes), [135, 0]);
  assert.equal(data.employees[0].dailyWorkVaries, true);
  const source = readFileSync(new URL('../pao-da-leli-ponto/admin-real.js', import.meta.url), 'utf8');
  const context = vm.createContext({ Intl, Date, esc: value => String(value ?? ''), dateTime: () => '' });
  vm.runInContext(source.slice(source.indexOf('function monthLabel('), source.indexOf('function historyBadge(')), context);
  const html = context.buildMonthlyPrintHtml(data);
  assert.match(html, /5h45 no início do mês; 8h00 desde 16\/10\/2026/);
  assert.match(html, /jornada conforme a vigência/);
});

test('a data de início é obrigatória e erros não alteram a jornada nem seu histórico', async () => {
  for (const date of [undefined, '', '2026-02-30', '2026-11-15', 'qualquer data']) {
    const result = await save(8, date);
    assert.equal(result.statusCode, 400, String(date));
  }
  assert.equal((await save(8, '2026-10-01', '00000000-0000-4000-8000-000000000099')).statusCode, 404);
  assert.equal((await fixture.db.query("SELECT count(*)::int AS count FROM leli_audit_log WHERE action='save_daily_hours' AND details ? 'versions'")).rows[0].count, 0);
  assert.equal((await fixture.db.query('SELECT daily_work_minutes FROM leli_users WHERE id=$1', [employeeId])).rows[0].daily_work_minutes, 345);
});

test('a revisão rejeita horários iguais sem gravar correções e expõe a autoria no histórico', async () => {
  const before = (await fixture.request('admin-monthly-times', 'GET', {}, 'admin', { id: employeeId, month: '2026-10' })).data;
  const day = before.days[0];
  const body = { id: employeeId, month: '2026-10', reason: 'Horário conferido com a colaboradora', days: [{ date: day.date, version: day.version, times: { ...day.times, breakIn: '12:00', out: '17:00' } }] };
  assert.equal((await fixture.request('admin-save-monthly-times', 'POST', body, 'admin')).statusCode, 400);
  body.days[0].times.breakIn = '13:00';
  assert.equal((await fixture.request('admin-save-monthly-times', 'POST', body, 'admin')).statusCode, 200);
  const detail = await fixture.request('admin-employee-detail', 'GET', {}, 'admin', { id: employeeId });
  assert.equal(detail.data.corrections[0].decided_by_name, 'ADM Teste');
  assert.equal(detail.data.corrections[0].reason, body.reason);
});
