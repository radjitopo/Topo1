import assert from 'node:assert/strict';
import test, { before, after, beforeEach } from 'node:test';
import { createMissingExitFixture, employeeId, otherEmployeeId, adminId } from './leli-missing-exit-fixture.mjs';

let fixture;
before(async () => { fixture = await createMissingExitFixture(); });
after(async () => { await fixture?.db.close(); });
beforeEach(async () => { await fixture.reset(); });
const payload = { date: '2026-10-01', requestedTime: '17:00', reason: 'Esqueci de registrar a saída.' };
const report = () => fixture.request('admin-monthly-report', 'GET', {}, 'admin', { month: '2026-10', employeeId });
const firstDay = response => response.data.rows.find(row => row.date === payload.date);
async function submit() {
  const response = await fixture.request('missing-exit', 'POST', payload);
  assert.equal(response.statusCode, 201, JSON.stringify(response.data));
  return response.data.id;
}

test('previous missing exits must be reported before starting the new day', async () => {
  await fixture.seedDay('2026-09-30');
  await fixture.seedDay('2026-10-01', otherEmployeeId);
  const today = await fixture.request('today');
  assert.equal(today.statusCode, 200);
  assert.equal(today.data.state, 'idle');
  assert.deepEqual(today.data.missingExits.map(row => row.work_date), ['2026-10-01', '2026-09-30']);
  assert.ok(today.data.missingExits.every(row => row.user_id === employeeId));
  const entry = await fixture.request('punch', 'POST');
  assert.equal(entry.statusCode, 428);
  assert.equal(entry.data.needsMissingExit, true);
  assert.deepEqual(entry.data.missingExits.map(row => row.work_date), ['2026-10-01', '2026-09-30']);
  assert.equal((await fixture.request('today')).data.state, 'idle');
  assert.equal((await fixture.db.query("SELECT count(*)::int AS n FROM leli_punches WHERE user_id=$1 AND work_date='2026-10-02'", [employeeId])).rows[0].n, 0);
  assert.equal((await fixture.request('today')).data.missingExits.length, 2);
  const overview = await fixture.request('admin-overview', 'GET', {}, 'admin');
  assert.equal(overview.statusCode, 200);
  assert.equal(overview.data.missingExits.length, 3);
  assert.equal(firstDay(await report()).status, 'Saída não registrada');
});

test('reporting the forgotten exit allows a new entry while ADM approval is still pending', async () => {
  const id = await submit();
  const entry = await fixture.request('punch', 'POST');
  assert.equal(entry.statusCode, 201, JSON.stringify(entry.data));
  assert.equal(entry.data.state, 'working');
  const today = (await fixture.request('today')).data;
  assert.equal(today.missingExits[0].correction_id, id);
  assert.equal(today.missingExits[0].status, 'pending');
  assert.equal(firstDay(await report()).workedMinutes, null);
});

test('all unanswered days must be reported, including a missing exit from the previous month', async () => {
  await fixture.seedDay('2026-09-30');
  await submit();
  const blocked = await fixture.request('punch', 'POST');
  assert.equal(blocked.statusCode, 428);
  assert.deepEqual(blocked.data.missingExits.map(row => row.work_date), ['2026-09-30']);
  assert.equal((await fixture.request('missing-exit', 'POST', { ...payload, date: '2026-09-30' })).statusCode, 201);
  assert.equal((await fixture.request('punch', 'POST')).statusCode, 201);
});

test('a rejected exit is asked again before a new entry and a resubmission unlocks the entry', async () => {
  const id = await submit();
  await fixture.request('admin-decide-correction', 'POST', { id, status: 'rejected', note: 'Confira o horário.' }, 'admin');
  const blocked = await fixture.request('punch', 'POST');
  assert.equal(blocked.statusCode, 428);
  assert.equal(blocked.data.missingExits[0].status, 'rejected');
  assert.equal(blocked.data.missingExits[0].decision_note, 'Confira o horário.');
  await submit();
  assert.equal((await fixture.request('punch', 'POST')).statusCode, 201);
});

test('an already active day can continue its interval punches despite an older missing exit', async () => {
  await fixture.seedDay('2026-10-02', employeeId, ['in']);
  const interval = await fixture.request('punch', 'POST');
  assert.equal(interval.statusCode, 201, JSON.stringify(interval.data));
  assert.equal(interval.data.punch.kind, 'breakOut');
});

test('a submitted exit awaits approval and changes neither original punches nor worked hours', async () => {
  const id = await submit();
  const today = await fixture.request('today');
  assert.equal(today.data.missingExits[0].status, 'pending');
  assert.equal(today.data.missingExits[0].correction_id, id);
  const row = firstDay(await report());
  assert.equal(row.status, 'Saída aguardando aprovação');
  assert.equal(row.workedMinutes, null);
  assert.equal(row.punches[3], null);
  const originals = await fixture.db.query("SELECT kind FROM leli_punches WHERE user_id=$1 ORDER BY occurred_at", [employeeId]);
  assert.deepEqual(originals.rows.map(p => p.kind), ['in', 'breakOut', 'breakIn']);
  const saved = (await fixture.db.query('SELECT punch_id,original_at,reason FROM leli_corrections WHERE id=$1', [id])).rows[0];
  assert.equal(saved.punch_id, null);
  assert.equal(saved.original_at, null);
  assert.equal(saved.reason, payload.reason);
});

test('approval adds only an effective exit, records the ADM and includes it in the monthly calculation', async () => {
  const id = await submit();
  const approved = await fixture.request('admin-decide-correction', 'POST', { id, status: 'approved' }, 'admin');
  assert.equal(approved.statusCode, 200, JSON.stringify(approved.data));
  assert.equal((await fixture.request('today')).data.missingExits.length, 0);
  const history = await fixture.request('history', 'GET', {}, 'employee', { month: '2026-10' });
  assert.equal(history.data.punches.some(p => p.kind === 'out'), false);
  assert.equal(history.data.corrections[0].status, 'approved');
  const row = firstDay(await report());
  assert.equal(row.workedMinutes, 420);
  assert.equal(row.punches[3], '17:00');
  assert.equal(row.exitAddedLater, true);
  const saved = (await fixture.db.query('SELECT decided_by,decided_at FROM leli_corrections WHERE id=$1', [id])).rows[0];
  assert.equal(saved.decided_by, adminId);
  assert.ok(saved.decided_at);
  const audit = await fixture.db.query("SELECT actor_user_id,action,details FROM leli_audit_log WHERE target_id=$1 ORDER BY id", [id]);
  assert.deepEqual(audit.rows.map(row => row.action), ['request_missing_exit', 'decide_missing_exit']);
  assert.equal(audit.rows[1].actor_user_id, adminId);
  assert.equal(audit.rows[1].details.status, 'approved');
});

test('resetting an approval removes the effective exit and restores the pendency', async () => {
  const id = await submit();
  await fixture.request('admin-decide-correction', 'POST', { id, status: 'approved' }, 'admin');
  const reset = await fixture.request('admin-reset-correction-decision', 'POST', { id }, 'admin');
  assert.equal(reset.statusCode, 200);
  assert.equal((await fixture.request('today')).data.missingExits[0].status, 'pending');
  const row = firstDay(await report());
  assert.equal(row.workedMinutes, null);
  assert.equal(row.exitAddedLater, false);
});

test('a refused exit can be resubmitted while both requests remain in the history', async () => {
  const first = await submit();
  const refused = await fixture.request('admin-decide-correction', 'POST', { id: first, status: 'rejected', note: 'Confira o horário.' }, 'admin');
  assert.equal(refused.statusCode, 200);
  const missed = (await fixture.request('today')).data.missingExits[0];
  assert.equal(missed.status, 'rejected');
  assert.equal(missed.decision_note, 'Confira o horário.');
  const second = await submit();
  assert.notEqual(second, first);
  const reset = await fixture.request('admin-reset-correction-decision', 'POST', { id: first }, 'admin');
  assert.equal(reset.statusCode, 409);
  const rows = (await fixture.db.query('SELECT status FROM leli_corrections ORDER BY created_at')).rows;
  assert.deepEqual(rows.map(row => row.status), ['rejected', 'pending']);
});

test('simultaneous submissions produce one pending exit and one audit entry', async () => {
  const responses = await Promise.all([fixture.request('missing-exit', 'POST', payload), fixture.request('missing-exit', 'POST', payload)]);
  assert.deepEqual(responses.map(r => r.statusCode).sort(), [201, 409]);
  assert.equal((await fixture.db.query('SELECT count(*)::int AS n FROM leli_corrections')).rows[0].n, 1);
  assert.equal((await fixture.db.query("SELECT count(*)::int AS n FROM leli_audit_log WHERE action='request_missing_exit'")).rows[0].n, 1);
});

test('dates, actual chronology and already completed days are validated before saving', async () => {
  for (const change of [{ date: '2026-10-02' }, { date: '2026-10-03' }, { date: '2026-02-30' }, { date: 'wrong' }, { requestedTime: '24:00' }, { reason: '' }]) {
    assert.equal((await fixture.request('missing-exit', 'POST', { ...payload, ...change })).statusCode, 400);
  }
  assert.equal((await fixture.request('missing-exit', 'POST', { ...payload, requestedTime: '12:59' })).statusCode, 409);
  assert.equal((await fixture.request('missing-exit', 'POST', { ...payload, date: '2026-09-29' })).statusCode, 409);
  await fixture.db.query("INSERT INTO leli_punches(user_id,kind,work_date,occurred_at) VALUES($1,'out','2026-10-01','2026-10-01T20:00Z')", [employeeId]);
  assert.equal((await fixture.request('missing-exit', 'POST', payload)).statusCode, 409);
  assert.equal((await fixture.db.query('SELECT count(*)::int AS n FROM leli_corrections')).rows[0].n, 0);
});

test('approval rechecks chronology when another approved correction changed the previous punch', async () => {
  const id = await submit();
  await fixture.db.query("INSERT INTO leli_corrections(user_id,punch_id,work_date,kind,original_at,requested_at,reason,status,decided_at) SELECT user_id,id,work_date,kind,occurred_at,'2026-10-01T21:00Z','Horário corrigido','approved',now() FROM leli_punches WHERE user_id=$1 AND kind='breakIn'", [employeeId]);
  const response = await fixture.request('admin-decide-correction', 'POST', { id, status: 'approved' }, 'admin');
  assert.equal(response.statusCode, 409);
  assert.equal((await fixture.db.query('SELECT status FROM leli_corrections WHERE id=$1', [id])).rows[0].status, 'pending');
});

test('only employees submit their own exits and only ADM accounts decide them', async () => {
  assert.equal((await fixture.request('missing-exit', 'POST', payload, 'anonymous')).statusCode, 401);
  assert.equal((await fixture.request('missing-exit', 'POST', payload, 'admin')).statusCode, 403);
  assert.equal((await fixture.request('missing-exit', 'POST', { ...payload, userId: otherEmployeeId })).statusCode, 201);
  const saved = (await fixture.db.query('SELECT id,user_id FROM leli_corrections')).rows[0];
  assert.equal(saved.user_id, employeeId);
  assert.equal((await fixture.request('admin-decide-correction', 'POST', { id: saved.id, status: 'approved' })).statusCode, 403);
  assert.equal((await fixture.request('admin-overview')).statusCode, 403);
});

const regularize = (changes = {}, role = 'admin') => fixture.request('admin-regularize-missing-exit', 'POST', { ...payload, userId: employeeId, reason: 'Horário conferido com Laura pelo ADM.', ...changes }, role);

test('ADM regularizes a past exit without changing original punches and records the responsible administrator', async () => {
  const original = (await fixture.db.query('SELECT id,kind,occurred_at FROM leli_punches ORDER BY occurred_at')).rows;
  assert.equal((await fixture.request('punch', 'POST')).statusCode, 428);
  const response = await regularize();
  assert.equal(response.statusCode, 201, JSON.stringify(response.data));
  assert.deepEqual((await fixture.db.query('SELECT id,kind,occurred_at FROM leli_punches ORDER BY occurred_at')).rows, original);
  const saved = (await fixture.db.query('SELECT * FROM leli_corrections WHERE id=$1', [response.data.id])).rows[0];
  assert.equal(saved.user_id, employeeId);
  assert.equal(saved.status, 'approved');
  assert.equal(saved.decided_by, adminId);
  assert.ok(saved.decided_at);
  assert.equal(saved.punch_id, null);
  assert.equal(saved.original_at, null);
  assert.equal(new Date(saved.requested_at).toISOString(), '2026-10-01T20:00:00.000Z');
  assert.equal(saved.reason, 'Horário conferido com Laura pelo ADM.');
  const audit = (await fixture.db.query('SELECT actor_user_id,action,details FROM leli_audit_log WHERE target_id=$1', [saved.id])).rows;
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actor_user_id, adminId);
  assert.equal(audit[0].action, 'admin_regularize_missing_exit');
  assert.equal(audit[0].details.userId, employeeId);
  assert.equal(audit[0].details.date, payload.date);
  assert.equal(audit[0].details.reason, saved.reason);
  assert.equal((await fixture.request('admin-overview', 'GET', {}, 'admin')).data.missingExits.length, 0);
  assert.equal((await fixture.request('today')).data.missingExits.length, 0);
  const row = firstDay(await report());
  assert.equal(row.workedMinutes, 420);
  assert.equal(row.punches[3], '17:00');
  assert.equal(row.exitAddedLater, true);
  assert.equal((await fixture.request('punch', 'POST')).statusCode, 201);
});

test('regularization validates the employee, past date, real time and corrected chronology', async () => {
  for (const change of [{ userId: '' }, { userId: 'wrong' }, { date: '2026-10-02' }, { date: '2026-10-03' }, { date: '2026-02-30' }, { date: 'wrong' }, { requestedTime: '24:00' }, { requestedTime: '' }, { reason: '' }, { reason: 'x'.repeat(1001) }]) {
    assert.equal((await regularize(change)).statusCode, 400, JSON.stringify(change));
  }
  assert.equal((await regularize({ userId: adminId })).statusCode, 404);
  assert.equal((await regularize({ userId: '00000000-0000-4000-8000-000000000099' })).statusCode, 404);
  assert.equal((await regularize({ date: '2026-09-29' })).statusCode, 409);
  assert.equal((await regularize({ requestedTime: '12:59' })).statusCode, 409);
  await fixture.db.query("INSERT INTO leli_corrections(user_id,punch_id,work_date,kind,original_at,requested_at,reason,status,decided_at) SELECT user_id,id,work_date,kind,occurred_at,'2026-10-01T21:00Z','Horário corrigido','approved',now() FROM leli_punches WHERE user_id=$1 AND kind='breakIn'", [employeeId]);
  assert.equal((await regularize()).statusCode, 409);
  assert.equal((await fixture.db.query("SELECT count(*)::int AS n FROM leli_corrections WHERE kind='out'")).rows[0].n, 0);
});

test('only ADM can regularize exits, including past records of an inactive employee', async () => {
  assert.equal((await regularize({}, 'anonymous')).statusCode, 401);
  assert.equal((await regularize({}, 'employee')).statusCode, 403);
  assert.equal((await regularize({}, 'other')).statusCode, 403);
  await fixture.seedDay(payload.date, otherEmployeeId);
  await fixture.db.query('UPDATE leli_users SET active=false WHERE id=$1', [otherEmployeeId]);
  const response = await regularize({ userId: otherEmployeeId });
  assert.equal(response.statusCode, 201);
  const saved = (await fixture.db.query('SELECT user_id,decided_by FROM leli_corrections WHERE id=$1', [response.data.id])).rows[0];
  assert.equal(saved.user_id, otherEmployeeId);
  assert.equal(saved.decided_by, adminId);
  assert.equal((await fixture.request('today')).data.missingExits[0].user_id, employeeId);
});

test('a pending employee request keeps its time until ADM decides it, and a rejected exit can be regularized', async () => {
  const id = await submit();
  assert.equal((await regularize({ requestedTime: '18:00' })).statusCode, 409);
  assert.equal((await fixture.db.query('SELECT status FROM leli_corrections WHERE id=$1', [id])).rows[0].status, 'pending');
  await fixture.request('admin-decide-correction', 'POST', { id, status: 'rejected', note: 'Horário conferido: 18:00.' }, 'admin');
  const response = await regularize({ requestedTime: '18:00' });
  assert.equal(response.statusCode, 201);
  assert.deepEqual((await fixture.db.query('SELECT status FROM leli_corrections ORDER BY created_at,id')).rows.map(row => row.status).sort(), ['approved', 'rejected']);
  assert.equal(firstDay(await report()).punches[3], '18:00');
  assert.equal((await fixture.request('today')).data.missingExits.length, 0);
});

test('double regularization saves only one confirmed exit and one audit entry', async () => {
  const responses = await Promise.all([regularize(), regularize()]);
  assert.deepEqual(responses.map(row => row.statusCode).sort(), [201, 409]);
  assert.equal((await fixture.db.query("SELECT count(*)::int AS n FROM leli_corrections WHERE status='approved'")).rows[0].n, 1);
  assert.equal((await fixture.db.query("SELECT count(*)::int AS n FROM leli_audit_log WHERE action='admin_regularize_missing_exit'")).rows[0].n, 1);
  assert.equal((await regularize()).statusCode, 409);
});

test('a simultaneous employee submission and ADM regularization cannot create two active exits', async () => {
  const responses = await Promise.all([fixture.request('missing-exit', 'POST', payload), regularize()]);
  assert.deepEqual(responses.map(row => row.statusCode).sort(), [201, 409]);
  assert.equal((await fixture.db.query("SELECT count(*)::int AS n FROM leli_corrections WHERE status IN ('pending','approved')")).rows[0].n, 1);
  assert.equal((await fixture.db.query("SELECT count(*)::int AS n FROM leli_audit_log WHERE action IN ('request_missing_exit','admin_regularize_missing_exit')")).rows[0].n, 1);
});

test('regularizing an old month resolves only that day and unanswered exits still block the next entry', async () => {
  await fixture.seedDay('2026-09-30');
  assert.equal((await regularize({ date: '2026-09-30' })).statusCode, 201);
  const blocked = await fixture.request('punch', 'POST');
  assert.equal(blocked.statusCode, 428);
  assert.deepEqual(blocked.data.missingExits.map(row => row.work_date), [payload.date]);
  await submit();
  assert.equal((await fixture.request('punch', 'POST')).statusCode, 201);
});
