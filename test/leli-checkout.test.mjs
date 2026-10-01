import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildMonthlyReport, getMonthBounds } from '../leli-report.js';

const apiSource = (await readFile(new URL('../leli-api.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export default async function handler', 'async function handler');
const createHandler = new Function(
  'neon', 'createHash', 'randomBytes', 'scryptSync', 'timingSafeEqual',
  'buildMonthlyReport', 'getMonthBounds', 'defaultRecipes',
  apiSource + '\nreturn handler;',
);
const questionId = '00000000-0000-4000-8000-000000000002';
const missingId = '00000000-0000-4000-8000-000000000003';

async function checkout({ items = [], missingOptions = [], body = {}, ended = false, restricted = false, action = 'checkout', method = 'POST', punches, headers = {}, role = 'employee', policy = {}, savedProfiles = [] } = {}) {
  const writes = [], profileWrites = [], policyWrites = [];
  const user = { id: '00000000-0000-4000-8000-000000000001', role, unit: 'Pão da Leli Café', active: true };
  const sql = async (parts, ...values) => {
    const query = parts.join('?').replace(/\s+/g, ' ').trim();
    if (query.includes('SELECT count(*)::int AS count FROM leli_recipes')) return [{ count: 1 }];
    if (query.includes('FROM leli_sessions s JOIN leli_users')) return [user];
    if (query.startsWith('SELECT id,kind,occurred_at FROM leli_punches')) {
      return (punches ?? ['in', 'breakOut', 'breakIn', ...(ended ? ['out'] : [])]).map((kind) => ({ id: kind, kind, occurred_at: new Date().toISOString() }));
    }
    if (query.startsWith('SELECT id,question FROM leli_checklist_items')) {
      assert.equal(values[0], user.unit);
      return items;
    }
    if (query.startsWith('SELECT id,label FROM leli_checklist_missing_options')) return missingOptions;
    if (query.startsWith('SELECT') && query.includes('FROM leli_access_policy')) return [{ mode: restricted ? 'restricted' : 'free', latitude: -27, longitude: -48, radius_m: 20, network_fingerprint: 'different-network', ...policy }];
    if (query.startsWith('SELECT') && query.includes('FROM leli_access_profiles')) return savedProfiles;
    if (query.startsWith('INSERT INTO leli_access_profiles') && query.includes('RETURNING id')) {
      profileWrites.push({ query, values });
      return [{ id: questionId }];
    }
    if (query.startsWith("UPDATE leli_access_policy SET mode='restricted'")) policyWrites.push({ query, values });
    if (query.startsWith('INSERT INTO leli_punches')) {
      writes.push({ query, values });
      return [{ id: 'punch', kind: values[1], occurred_at: new Date().toISOString() }];
    }
    if (query.startsWith('WITH new_punch AS')) {
      writes.push({ query, values });
      return [{ id: 'out-punch', kind: 'out', submission_id: 'closing', occurred_at: new Date().toISOString() }];
    }
    return [];
  };
  const handler = createHandler(() => sql, crypto.createHash, crypto.randomBytes, crypto.scryptSync, crypto.timingSafeEqual, buildMonthlyReport, getMonthBounds, []);
  const res = { statusCode: null, data: null, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } };
  await handler({ method, query: { action }, headers: { cookie: 'leli_session=test-session', ...headers }, body }, res);
  return { res, writes, profileWrites, policyWrites };
}

test('employees can close their shift with no configured questions and keep an optional note', async () => {
  const { res, writes } = await checkout({ body: { answers: [], message: 'Encomenda na geladeira', messageAudience: 'team' } });
  assert.equal(res.statusCode, 201);
  assert.equal(res.data.state, 'out');
  assert.equal(writes.length, 1);
  assert.ok(writes[0].values.includes('[]'));
  assert.ok(writes[0].values.includes('Encomenda na geladeira'));
  assert.ok(writes[0].values.includes('team'));
});

test('configured questions still require answers and record their snapshot', async () => {
  const items = [{ id: questionId, question: 'Área organizada?' }];
  const incomplete = await checkout({ items });
  assert.equal(incomplete.res.statusCode, 409);
  assert.equal(incomplete.res.data.checklistChanged, true);
  assert.equal(incomplete.writes.length, 0);
  const complete = await checkout({ items, body: { answers: [{ id: questionId, answer: false }] } });
  assert.equal(complete.res.statusCode, 201);
  assert.ok(complete.writes[0].values.includes(JSON.stringify([{ itemId: questionId, question: 'Área organizada?', answer: false }])));
});

test('missing item reports work without configured questions', async () => {
  const missingOptions = [{ id: missingId, label: 'Café' }];
  const incomplete = await checkout({ missingOptions });
  assert.equal(incomplete.res.statusCode, 400);
  assert.equal(incomplete.writes.length, 0);
  const complete = await checkout({ missingOptions, body: { missingItemIds: [missingId] } });
  assert.equal(complete.res.statusCode, 201);
  assert.ok(complete.writes[0].values.includes(JSON.stringify([{ optionId: missingId, label: 'Café' }])));
});

test('empty checklists do not allow a second exit for an ended shift', async () => {
  const { res, writes } = await checkout({ ended: true });
  assert.equal(res.statusCode, 409);
  assert.equal(writes.length, 0);
});

test('empty checklists still enforce configured access restrictions', async () => {
  const { res, writes } = await checkout({ restricted: true });
  assert.equal(res.statusCode, 403);
  assert.equal(res.data.accessDenied, true);
  assert.equal(res.data.reason, 'location');
  assert.equal(writes.length, 0);
});

function locationAt(meters) {
  return { latitude: -27 + meters / 6371000 * 180 / Math.PI, longitude: -48, accuracy: 5, capturedAt: Date.now() };
}

test('all four punches accept mobile data within 30 meters, including existing 20-meter configurations', async () => {
  const stages = [
    { action: 'punch', punches: [], kind: 'in' },
    { action: 'punch', punches: ['in'], kind: 'breakOut' },
    { action: 'punch', punches: ['in', 'breakOut'], kind: 'breakIn' },
    { action: 'checkout', punches: ['in', 'breakOut', 'breakIn'], kind: 'out' },
  ];
  for (const stage of stages) {
    for (const headers of [{}, { 'x-forwarded-for': '198.51.100.2' }]) {
      const { res, writes } = await checkout({ ...stage, restricted: true, headers, body: { location: locationAt(29.9) } });
      assert.equal(res.statusCode, 201, stage.kind);
      assert.equal(res.data.punch.kind, stage.kind);
      assert.equal(writes.length, 1);
      assert.ok(writes[0].values.includes('restricted'));
      assert.doesNotMatch(writes[0].query, /network_fingerprint/);
    }
    const outside = await checkout({ ...stage, restricted: true, body: { location: locationAt(30.1) } });
    assert.equal(outside.res.statusCode, 403, stage.kind);
    assert.equal(outside.res.data.reason, 'distance');
    assert.equal(outside.writes.length, 0);
  }
});

test('restricted punches still need fresh and accurate location', async () => {
  for (const location of [undefined, { ...locationAt(0), capturedAt: Date.now() - 130000 }, { ...locationAt(0), accuracy: 101 }]) {
    const { res, writes } = await checkout({ restricted: true, body: { location } });
    assert.equal(res.statusCode, 403);
    assert.equal(res.data.reason, 'location');
    assert.equal(writes.length, 0);
  }
});

test('admins save and reactivate locations without identifying a network', async () => {
  const saved = await checkout({ action: 'admin-access-policy', role: 'admin', body: { mode: 'restricted', locationName: 'Café', location: locationAt(0) } });
  assert.equal(saved.res.statusCode, 200);
  assert.equal(saved.profileWrites.length, 1);
  assert.ok(saved.profileWrites[0].values.includes('Café'));
  assert.ok(saved.profileWrites[0].values.includes(30));
  assert.equal(saved.policyWrites.length, 1);
  assert.match(saved.policyWrites[0].query, /network_fingerprint=NULL/);
  assert.equal(saved.res.data.accessPolicy.configured, true);
  assert.equal(saved.res.data.accessPolicy.radiusMeters, 30);
  const reactivated = await checkout({ action: 'admin-access-policy', role: 'admin', body: { mode: 'restricted', profileId: questionId }, savedProfiles: [{ id: questionId, network_name: 'Café', latitude: -27, longitude: -48, radius_m: 20 }] });
  assert.equal(reactivated.res.statusCode, 200);
  assert.ok(reactivated.policyWrites[0].values.includes(30));
  assert.equal(reactivated.res.data.accessProfiles[0].locationName, 'Café');
  assert.equal(reactivated.res.data.accessProfiles[0].radiusMeters, 30);
});

test('the employee view displays the 30-meter policy without exposing network requirements', async () => {
  const { res } = await checkout({ action: 'today', method: 'GET', restricted: true });
  assert.equal(res.statusCode, 200);
  assert.equal(res.data.accessPolicy.radiusMeters, 30);
  assert.equal(res.data.accessPolicy.mode, 'restricted');
  assert.equal('networkCode' in res.data.accessPolicy, false);
});
