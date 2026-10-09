import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test, { before, after, beforeEach } from 'node:test';
import { createMissingExitFixture, employeeId, now } from './leli-missing-exit-fixture.mjs';

const employeeSource = await readFile(new URL('../pao-da-leli-ponto/app-real.js', import.meta.url), 'utf8');
const employeeHtml = await readFile(new URL('../pao-da-leli-ponto/index.html', import.meta.url), 'utf8');
const adminSource = await readFile(new URL('../pao-da-leli-ponto/admin-real.js', import.meta.url), 'utf8');
let fixture;
before(async () => { fixture = await createMissingExitFixture(); });
after(async () => { await fixture?.db.close(); });
beforeEach(async () => { await fixture.reset(); });

function node() {
  const classes = new Set();
  return {
    value: '', textContent: '', innerHTML: '', disabled: false, children: [],
    classList: {
      add(value) { classes.add(value); },
      remove(value) { classes.delete(value); },
      contains(value) { return classes.has(value); },
      toggle(value, enabled) { if (enabled ?? !classes.has(value)) classes.add(value); else classes.delete(value); },
    },
    append(...children) { this.children.push(...children); },
  };
}

function client({ role = 'employee', staleFirstRead = false } = {}) {
  const calls = [], alerts = [];
  const elements = new Map([...employeeHtml.matchAll(/id="([^"]+)"/g)].map(match => [match[1], node()]));
  const screens = [...employeeHtml.matchAll(/<section id="([^"]+)" class="screen/g)].map(match => elements.get(match[1]));
  elements.get('ponto').classList.add('active');
  elements.get('mainAction').textContent = 'INICIAR JORNADA';
  class TestDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now.getTime(); }
  }
  const context = vm.createContext({
    Intl, Date: TestDate, URLSearchParams, navigator: {},
    window: { scrollTo() {} }, alert(message) { alerts.push(message); },
    document: {
      documentElement: { scrollTop: 0 }, body: { scrollTop: 0 },
      querySelector(selector) { return elements.get(selector.slice(1)) || null; },
      querySelectorAll(selector) { return selector === '.screen' ? screens : []; },
      createElement: node,
    },
    async leliApi(endpoint, action, method = 'GET', payload) {
      assert.equal(endpoint, '/leli-api');
      calls.push({ action, method, payload });
      const response = await fixture.request(action, method, payload, role);
      const data = JSON.parse(JSON.stringify(response.data));
      if (response.statusCode >= 400) {
        const error = new Error(data.error);
        error.status = response.statusCode;
        error.data = data;
        throw error;
      }
      if (staleFirstRead && action === 'today') { staleFirstRead = false; data.missingExits = []; }
      return data;
    },
  });
  if (role === 'admin') {
    vm.runInContext(adminSource.slice(0, adminSource.indexOf('\nwindow.openEmployee=')), context);
  } else {
    vm.runInContext(employeeSource.slice(0, employeeSource.indexOf("$('#loginForm').addEventListener")), context);
    vm.runInContext(`currentUser=${JSON.stringify({ id: employeeId, role: 'employee', name: 'Laura Teste' })}`, context);
  }
  return {
    context, calls, alerts, elements,
    active(id) { return elements.get(id).classList.contains('active'); },
  };
}

async function todayPunchCount() {
  return (await fixture.db.query("SELECT count(*)::int AS n FROM leli_punches WHERE user_id=$1 AND work_date='2026-10-02'", [employeeId])).rows[0].n;
}

test('starting a day opens the forgotten-exit question before sending an entry', async () => {
  const ui = client();
  await ui.context.punch();
  assert.equal(ui.active('missingExit'), true);
  assert.equal(ui.elements.get('missingExitTime').value, '');
  assert.equal(ui.elements.get('missingExitReason').value, 'Esqueci de registrar a saída.');
  assert.equal(ui.elements.get('missingExitDay').textContent, '01/10/2026');
  assert.equal(ui.calls.some(call => call.action === 'punch'), false);
  assert.equal(await todayPunchCount(), 0);
  assert.equal(ui.elements.get('mainAction').disabled, false);
  assert.deepEqual(ui.alerts, []);
});

test('submitting the exit unlocks the new entry and ADM OK confirms only the old exit', async () => {
  const ui = client();
  await ui.context.punch();
  ui.elements.get('missingExitTime').value = '17:00';
  await ui.context.submitMissingExit();
  assert.equal(ui.active('confirm'), true);
  assert.match(ui.elements.get('confirmText').textContent, /aguarda confirmação do ADM/);
  assert.equal(await todayPunchCount(), 0);
  const pending = (await fixture.request('today')).data.missingExits[0];
  assert.equal(pending.status, 'pending');
  await ui.context.punch();
  assert.equal(await todayPunchCount(), 1);
  assert.equal((await fixture.request('today')).data.state, 'working');
  const adm = client({ role: 'admin' });
  const list = adm.context.missingExitList([pending]);
  assert.match(list, /saída não registrada/);
  assert.match(list, /Saída informada: 17:00/);
  assert.match(list, />OK<\/button>/);
  let rendered = false;
  adm.context.render = async () => { rendered = true; };
  adm.context.invalidateMonthlyReport = () => {};
  await adm.context.confirmMissingExit(pending.correction_id, node());
  assert.equal(rendered, true);
  assert.equal((await fixture.request('today')).data.missingExits.length, 0);
  assert.equal(await todayPunchCount(), 1);
  const report = await fixture.request('admin-monthly-report', 'GET', {}, 'admin', { month: '2026-10', employeeId });
  const oldDay = report.data.rows.find(row => row.date === '2026-10-01');
  assert.equal(oldDay.punches[3], '17:00');
  assert.equal(oldDay.workedMinutes, 420);
  assert.deepEqual(adm.alerts, []);
});

test('the server guard opens the question even when the first client read is stale', async () => {
  const ui = client({ staleFirstRead: true });
  await ui.context.punch();
  assert.equal(ui.calls.filter(call => call.action === 'punch').length, 1);
  assert.equal(ui.active('missingExit'), true);
  assert.equal(await todayPunchCount(), 0);
  assert.deepEqual(ui.alerts, []);
});

test('a rejected request reopens with its previous time and the ADM note', async () => {
  const request = await fixture.request('missing-exit', 'POST', { date: '2026-10-01', requestedTime: '17:00', reason: 'Saída esquecida.' });
  await fixture.request('admin-decide-correction', 'POST', { id: request.data.id, status: 'rejected', note: 'Confira o horário.' }, 'admin');
  const ui = client();
  await ui.context.loadToday();
  assert.match(ui.elements.get('missingExitCards').innerHTML, /Confira o horário\./);
  await ui.context.punch();
  assert.equal(ui.active('missingExit'), true);
  assert.equal(ui.elements.get('missingExitTime').value, '17:00');
  assert.equal(await todayPunchCount(), 0);
  const pending = (await fixture.request('today')).data.missingExits;
  assert.doesNotMatch(client({ role: 'admin' }).context.missingExitList(pending), />OK<\/button>/);
});

test('double tapping start sends only one entry for a completed previous day', async () => {
  await fixture.seedDay('2026-10-01', employeeId, ['out']);
  const ui = client();
  await Promise.all([ui.context.punch(), ui.context.punch()]);
  assert.equal(ui.calls.filter(call => call.action === 'punch').length, 1);
  assert.equal(await todayPunchCount(), 1);
  assert.equal(ui.active('missingExit'), false);
  assert.deepEqual(ui.alerts, []);
});
