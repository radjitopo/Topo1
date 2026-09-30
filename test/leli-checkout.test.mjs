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

async function checkout({ items = [], missingOptions = [], body = {}, ended = false, restricted = false } = {}) {
  const writes = [];
  const user = { id: '00000000-0000-4000-8000-000000000001', role: 'employee', unit: 'Pão da Leli Café', active: true };
  const sql = async (parts, ...values) => {
    const query = parts.join('?').replace(/\s+/g, ' ').trim();
    if (query.includes('SELECT count(*)::int AS count FROM leli_recipes')) return [{ count: 1 }];
    if (query.includes('FROM leli_sessions s JOIN leli_users')) return [user];
    if (query.startsWith('SELECT id,kind,occurred_at FROM leli_punches')) {
      return ['in', 'breakOut', 'breakIn', ...(ended ? ['out'] : [])].map((kind) => ({ id: kind, kind, occurred_at: new Date().toISOString() }));
    }
    if (query.startsWith('SELECT id,question FROM leli_checklist_items')) {
      assert.equal(values[0], user.unit);
      return items;
    }
    if (query.startsWith('SELECT id,label FROM leli_checklist_missing_options')) return missingOptions;
    if (query.includes('FROM leli_access_policy')) return [{ mode: restricted ? 'restricted' : 'free', network_fingerprint: 'different-network' }];
    if (query.startsWith('WITH new_punch AS')) {
      writes.push({ query, values });
      return [{ id: 'out-punch', kind: 'out', submission_id: 'closing', occurred_at: new Date().toISOString() }];
    }
    return [];
  };
  const handler = createHandler(() => sql, crypto.createHash, crypto.randomBytes, crypto.scryptSync, crypto.timingSafeEqual, buildMonthlyReport, getMonthBounds, []);
  const res = { statusCode: null, data: null, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } };
  await handler({ method: 'POST', query: { action: 'checkout' }, headers: { cookie: 'leli_session=test-session' }, body }, res);
  return { res, writes };
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
  assert.equal(writes.length, 0);
});
