import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthlyReport } from '../leli-report.js';

const id = 'test-employee';
const kinds = ['in', 'breakOut', 'breakIn', 'out'];
const punches = (date, times) => times.flatMap((time, i) => time ? [{
  user_id: id, work_date: date, kind: kinds[i],
  occurred_at: `${date}T${time}:00-03:00`,
}] : []);
const schedule = [1, 2, 3, 4, 5].map(weekday => ({
  weekday, start_time: '08:00', break_start_time: '12:00',
  break_end_time: '13:00', end_time: '17:00',
}));
const base = {
  month: '2026-10', employees: [{ id, name: 'Funcionária teste', unit: 'Café', active: true }],
  scheduleVersions: [{ user_id: id, effective_from: '2026-09-01', schedule }],
  now: new Date('2026-10-12T11:00:00-03:00'),
};
const rowAt = (report, date) => report.rows.find(row => row.date === date);

test('saldo separa horas positivas e negativas sem alterar extras', () => {
  const report = buildMonthlyReport({
    ...base, corrections: [], punches: [
      ...punches('2026-10-05', ['08:00', '12:00', '13:00', '18:30']),
      ...punches('2026-10-06', ['08:00', '12:00', '13:00', '16:30']),
    ],
  });
  assert.equal(rowAt(report, '2026-10-05').balanceMinutes, 90);
  assert.equal(rowAt(report, '2026-10-06').balanceMinutes, -30);
  assert.equal(report.totals.balancePositiveMinutes, 90);
  assert.equal(report.totals.balanceNegativeMinutes, 30);
  assert.equal(report.totals.balanceNetMinutes, 60);
  assert.equal(rowAt(report, '2026-10-05').overtimeMinutes, 90);
  assert.equal(rowAt(report, '2026-10-06').overtimeMinutes, 0);
});

test('falta, jornada incompleta e correção pendente não criam negativo automático', () => {
  const report = buildMonthlyReport({
    ...base,
    punches: [
      ...punches('2026-10-06', ['08:00', '12:00', '13:00', null]),
      ...punches('2026-10-07', ['08:00', '12:00', '13:00', '16:00']),
      ...punches('2026-10-10', ['08:00', '12:00', '13:00', '18:00']),
    ],
    corrections: [{
      id: 'correction-test', user_id: id, work_date: '2026-10-07',
      kind: 'out', requested_at: '2026-10-07T17:00:00-03:00',
      status: 'pending', created_at: '2026-10-08T08:00:00-03:00',
    }],
  });
  assert.equal(rowAt(report, '2026-10-05').status, 'Falta');
  assert.equal(rowAt(report, '2026-10-05').balanceMinutes, null);
  assert.equal(rowAt(report, '2026-10-06').balanceMinutes, null);
  assert.equal(rowAt(report, '2026-10-07').balanceMinutes, null);
  assert.equal(rowAt(report, '2026-10-10').balanceMinutes, null); // sábado sem escala
  assert.ok(report.totals.balancePendingDays >= 3);
  assert.equal(report.totals.balanceNetMinutes, 0);
});

test('batidas completas com a mesma carga horária têm saldo zero', () => {
  const report = buildMonthlyReport({
    ...base, corrections: [],
    punches: punches('2026-10-05', ['08:00', '12:00', '13:00', '17:00']),
  });
  assert.equal(rowAt(report, '2026-10-05').balanceMinutes, 0);
  assert.equal(rowAt(report, '2026-10-05').balancePositiveMinutes, 0);
  assert.equal(rowAt(report, '2026-10-05').balanceNegativeMinutes, 0);
});
