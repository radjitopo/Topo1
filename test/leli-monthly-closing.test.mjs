import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { buildMonthlyReport } from '../leli-report.js';

const source = fs.readFileSync(new URL('../pao-da-leli-ponto/admin-real.js', import.meta.url), 'utf8');
const functions = source.slice(source.indexOf('function monthLabel('), source.indexOf('function historyBadge('));
const kinds = ['in', 'breakOut', 'breakIn', 'out'];
const employees = [{ id: 'a', name: 'Pessoa Teste', unit: 'Café' }, { id: 'b', name: 'Pessoa Teste', unit: 'Produção' }];
const punches = employees.flatMap(employee => Array.from({ length: 31 }, (_, index) => {
  const date = '2026-10-' + String(index + 1).padStart(2, '0');
  const times = employee.id === 'a' ? ['07:00', '12:00', '13:00', '16:30'] : ['09:00', '12:00', '13:00', '17:30'];
  return times.map((time, i) => ({ user_id: employee.id, work_date: date, kind: kinds[i], occurred_at: date + 'T' + time + ':00-03:00' }));
})).flat();
const report = buildMonthlyReport({ month: '2026-10', employees, punches, corrections: [], scheduleVersions: [], now: new Date('2026-11-03T12:00:00-03:00') });
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function setup({ blocked = false, error = null, valid = true } = {}) {
  const nodes = new Map(), events = [], alerts = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', disabled: false, classList: { add() {}, remove() {} } });
    return nodes.get(id);
  };
  node('reportMonth').value = '2026-10';
  node('reportEmployee').value = 'a';
  node('reportDailyHours').value = '8';
  node('reportWeeklyHours').value = '44';
  node('reportForm').reportValidity = () => valid;
  node('reportForm').querySelectorAll = () => ['reportMonth', 'reportEmployee', 'reportDailyHours', 'reportWeeklyHours', 'submitReport'].map(node);
  const popup = { closed: false, documents: [], document: { open() {}, write(html) { popup.documents.push(html); }, close() {} }, focus() {}, print() { events.push('print'); }, close() { popup.closed = true; } };
  const context = vm.createContext({ Intl, Date, esc: escape, dateTime: () => '03/11/2026 12:00', fullDateLabel: value => value, $: selector => node(selector.slice(1)), alert: message => alerts.push(message), setTimeout: callback => callback(), monthlyReport: null,
    window: { open() { events.push('open'); return blocked ? null : popup; } },
    api: async (action, method, parameters) => { events.push({ action, method, parameters: JSON.parse(JSON.stringify(parameters)) }); if (error) throw new Error(error); return report; },
  });
  vm.runInContext(functions, context);
  return { context, node, events, alerts, popup };
}

test('cada funcionário recebe sua própria folha, sem misturar pessoas com o mesmo nome', () => {
  const { context } = setup();
  const html = context.buildMonthlyPrintHtml(report);
  const pages = [...html.matchAll(/<section class="employee-sheet"[\s\S]*?<\/section>/g)].map(match => match[0]);
  assert.equal(pages.length, 2);
  assert.equal((pages[0].match(/<td>07:00<\/td>/g) || []).length, 31);
  assert.doesNotMatch(pages[0], /<td>09:00<\/td>/);
  assert.equal((pages[1].match(/<td>09:00<\/td>/g) || []).length, 31);
  assert.doesNotMatch(pages[1], /<td>07:00<\/td>/);
  assert.match(html, /pao-da-leli-fechamento-outubro-2026-todos/);
  assert.match(html, /Saldo final do mês/);
});

test('o saldo final mostra a subtração e nomes são escapados no PDF', () => {
  const { context } = setup();
  assert.equal(context.reportBalanceFormula({ balancePositiveMinutes: 90, balanceNegativeMinutes: 120, balanceNetMinutes: -30 }), '+1h30 − 2h00 = −0h30');
  const single = { ...report, employees: [{ ...report.employees[0], name: '<script> & Teste' }] };
  const html = context.buildMonthlyPrintHtml(single);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt; &amp; Teste/);
  assert.equal((html.match(/<section class="employee-sheet"/g) || []).length, 1);
});

test('gerar todos ignora o filtro individual e abre uma única janela antes de buscar os dados', async () => {
  const { context, node, events, popup } = setup();
  await context.generateAllMonthlyReports();
  assert.equal(events[0], 'open');
  assert.deepEqual(events[1], { action: 'admin-monthly-report', method: 'GET', parameters: { month: '2026-10', employeeId: '', dailyHours: '8', weeklyHours: '44' } });
  assert.equal(events.filter(event => event === 'open').length, 1);
  assert.equal(events.filter(event => event === 'print').length, 1);
  assert.equal((popup.documents.at(-1).match(/<section class="employee-sheet"/g) || []).length, 2);
  assert.equal(node('reportEmployee').value, '');
  assert.equal(node('generateAllReports').disabled, false);
  assert.equal(node('reportMonth').disabled, false);
  assert.match(node('reportStatus').textContent, /2 funcionário/);
});

test('falha na consulta fecha a janela temporária e libera os controles', async () => {
  const { context, node, popup, alerts } = setup({ error: 'Falha de conexão' });
  await context.generateAllMonthlyReports();
  assert.equal(popup.closed, true);
  assert.equal(node('generateAllReports').disabled, false);
  assert.equal(node('reportMonth').disabled, false);
  assert.deepEqual(alerts, ['Falha de conexão']);
  assert.equal(context.monthlyReport, null);
});

test('janela bloqueada ou formulário inválido não disparam consulta nem impressão', async () => {
  for (const options of [{ blocked: true }, { valid: false }]) {
    const { context, events } = setup(options);
    await context.generateAllMonthlyReports();
    assert.equal(events.some(event => typeof event === 'object'), false);
    assert.equal(events.includes('print'), false);
  }
});

test('CSV e TXT também incluem o saldo final com horas negativas descontadas', () => {
  const { context } = setup();
  const outputs = [];
  context.monthlyReport = report;
  context.saveReportFile = (text, filename) => outputs.push({ text, filename });
  context.downloadMonthlyReport();
  context.downloadMonthlyReportTxt();
  assert.equal(outputs[0].filename, 'pao-da-leli-fechamento-outubro-2026.csv');
  assert.match(outputs[0].text, /Saldo final do mês \(positivas - negativas\)/);
  assert.match(outputs[1].text, /Saldo final do mês: \+/);
  assert.match(outputs[1].text, / = −/);
});
