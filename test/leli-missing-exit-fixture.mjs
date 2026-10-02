import * as crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { buildMonthlyReport, getMonthBounds } from '../leli-report.js';

export const employeeId = '00000000-0000-4000-8000-000000000001';
export const otherEmployeeId = '00000000-0000-4000-8000-000000000002';
export const adminId = '00000000-0000-4000-8000-000000000003';
export const now = new Date('2026-10-02T12:00:00Z');

export async function createMissingExitFixture() {
  const { PGlite } = await import(process.env.LELI_PGLITE_MODULE || '@electric-sql/pglite');
  const db = new PGlite();
  const source = (await readFile(new URL('../leli-api.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '')
    .replace('export default async function handler', 'async function handler');
  const factory = new Function('neon', 'createHash', 'randomBytes', 'scryptSync', 'timingSafeEqual', 'buildMonthlyReport', 'getMonthBounds', 'defaultRecipes', 'Date', source + '\nreturn handler;');
  class TestDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now.getTime(); }
  }
  function query(parts, values) { return { text: parts.map((part, i) => part + (i < values.length ? '$' + (i + 1) : '')).join(''), values }; }
  const sql = async (parts, ...values) => {
    const command = query(parts, values);
    return (await db.query(command.text, command.values)).rows;
  };
  sql.transaction = (createQueries) => db.transaction(async (tx) => {
    const tag = (parts, ...values) => ({
      then(resolve, reject) {
        const command = query(parts, values);
        tx.query(command.text, command.values).then(result => resolve(result.rows), reject);
      },
    });
    const rows = [];
    for (const command of createQueries(tag)) rows.push(await command);
    return rows;
  });
  const handler = factory(() => sql, crypto.createHash, crypto.randomBytes, crypto.scryptSync, crypto.timingSafeEqual, input => buildMonthlyReport({ ...input, now }), getMonthBounds, [], TestDate);
  async function request(action, method = 'GET', body = {}, role = 'employee', query = {}) {
    const res = { headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } };
    const token = role === 'admin' ? 'admin-session' : role === 'other' ? 'other-session' : role === 'anonymous' ? '' : 'employee-session';
    await handler({ method, query: { action, ...query }, body, headers: { cookie: token ? 'leli_session=' + token : '' } }, res);
    return res;
  }
  const ready = await request('health');
  if (ready.statusCode !== 200) throw new Error('Test schema failed: ' + JSON.stringify(ready.data));
  async function reset() {
    await db.exec('TRUNCATE leli_users CASCADE');
    for (const [id, name, role, token] of [[employeeId, 'Laura Teste', 'employee', 'employee-session'], [otherEmployeeId, 'Outra Pessoa', 'employee', 'other-session'], [adminId, 'ADM Teste', 'admin', 'admin-session']]) {
      await db.query("INSERT INTO leli_users(id,name,role,email,unit) VALUES($1,$2,$3,$4,'Pão da Leli Café')", [id, name, role, id + '@teste.invalid']);
      await db.query("INSERT INTO leli_sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 day')", [id, crypto.createHash('sha256').update(token).digest('hex')]);
    }
    await seedDay('2026-10-01');
  }
  async function seedDay(date, userId = employeeId, kinds = ['in', 'breakOut', 'breakIn']) {
    const clocks = { in: '09:00', breakOut: '12:00', breakIn: '13:00', out: '17:00' };
    for (const kind of kinds) await db.query('INSERT INTO leli_punches(user_id,kind,work_date,occurred_at) VALUES($1,$2,$3,($3::date+$4::time) AT TIME ZONE \'America/Sao_Paulo\')', [userId, kind, date, clocks[kind]]);
  }
  await reset();
  return { db, request, reset, seedDay };
}
