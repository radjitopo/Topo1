import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const [{ default: handler }] = await Promise.all([
  import('../api.js')
]);
const sql = neon(process.env.DATABASE_URL);

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const email = `topo-password-reset-${stamp}@example.com`;
const deviceId = `topo-password-reset-${stamp}`;
const oldPassword = 'Senha-Antiga-2026!';
const newPassword = 'Senha-Nova-2026!';
const savedResendKey = process.env.RESEND_API_KEY;
const savedEmailFrom = process.env.TOPO_EMAIL_FROM;

class MockResponse {
  constructor() {
    this.headers = new Map();
    this.statusCode = 200;
    this.body = undefined;
  }

  setHeader(name, value) {
    this.headers.set(String(name).toLowerCase(), value);
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  json(value) {
    this.body = value;
    return value;
  }
}

async function request({ method = 'GET', action = '', query = {}, body, cookie = '' } = {}) {
  const req = {
    method,
    query: { ...query, ...(action ? { action } : {}) },
    headers: cookie ? { cookie, host: 'somostopo.com.br' } : { host: 'somostopo.com.br' },
    body
  };
  const res = new MockResponse();
  await handler(req, res);
  return res;
}

function sessionCookie(res) {
  return String(res.headers.get('set-cookie') || '').split(';')[0];
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function cleanup() {
  await sql.query(
    'DELETE FROM users WHERE lower(email) = lower($1)',
    [email]
  );
}

try {
  await cleanup();
  delete process.env.RESEND_API_KEY;
  delete process.env.TOPO_EMAIL_FROM;

  const signup = await request({
    method: 'POST',
    action: 'signup',
    body: {
      display_name: 'Teste Recuperação',
      email,
      password: oldPassword,
      device_id: deviceId
    }
  });
  assert.equal(signup.statusCode, 201);
  const oldCookie = sessionCookie(signup);
  assert.match(oldCookie, /^topo_session=/);

  const invalidEmail = await request({
    method: 'POST',
    action: 'request-password-reset',
    body: { email: 'email-invalido' }
  });
  assert.equal(invalidEmail.statusCode, 400);
  assert.equal(invalidEmail.body.error, 'invalid_email');

  const missingEmailService = await request({
    method: 'POST',
    action: 'request-password-reset',
    body: { email }
  });
  assert.equal(missingEmailService.statusCode, 503);
  assert.equal(missingEmailService.body.error, 'email_not_configured');

  const [user] = await sql.query(
    'SELECT id FROM users WHERE lower(email) = lower($1)',
    [email]
  );
  assert.ok(user?.id);

  const expiredToken = randomBytes(32).toString('base64url');
  const validToken = randomBytes(32).toString('base64url');
  await sql.transaction([
    sql.query(`
      INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
      VALUES ($1, $2, now() - interval '1 minute')
    `, [tokenHash(expiredToken), user.id]),
    sql.query(`
      INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
      VALUES ($1, $2, now() + interval '30 minutes')
    `, [tokenHash(validToken), user.id])
  ]);

  const unknownToken = randomBytes(32).toString('base64url');
  const unknown = await request({
    method: 'POST',
    action: 'reset-password',
    body: { token: unknownToken, password: newPassword }
  });
  assert.equal(unknown.statusCode, 400);
  assert.equal(unknown.body.error, 'invalid_or_expired_token');

  const expired = await request({
    method: 'POST',
    action: 'reset-password',
    body: { token: expiredToken, password: newPassword }
  });
  assert.equal(expired.statusCode, 400);
  assert.equal(expired.body.error, 'invalid_or_expired_token');

  const weak = await request({
    method: 'POST',
    action: 'reset-password',
    body: { token: validToken, password: 'curta' }
  });
  assert.equal(weak.statusCode, 400);
  assert.equal(weak.body.error, 'weak_password');

  const reset = await request({
    method: 'POST',
    action: 'reset-password',
    body: { token: validToken, password: newPassword }
  });
  assert.equal(reset.statusCode, 200);
  assert.equal(reset.body.ok, true);
  assert.match(String(reset.headers.get('set-cookie')), /Max-Age=0/);

  const oldSession = await request({
    action: 'profile',
    query: { device_id: deviceId },
    cookie: oldCookie
  });
  assert.equal(oldSession.statusCode, 401);

  const reused = await request({
    method: 'POST',
    action: 'reset-password',
    body: { token: validToken, password: 'Outra-Senha-2026!' }
  });
  assert.equal(reused.statusCode, 400);
  assert.equal(reused.body.error, 'invalid_or_expired_token');

  const oldLogin = await request({
    method: 'POST',
    action: 'login',
    body: { email, password: oldPassword, device_id: deviceId }
  });
  assert.equal(oldLogin.statusCode, 401);

  const newLogin = await request({
    method: 'POST',
    action: 'login',
    body: { email, password: newPassword, device_id: deviceId }
  });
  assert.equal(newLogin.statusCode, 200);
  assert.match(sessionCookie(newLogin), /^topo_session=/);

  console.log('Password reset integration passed: expiry, single use, session revocation and new login.');
} finally {
  if (savedResendKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = savedResendKey;
  if (savedEmailFrom === undefined) delete process.env.TOPO_EMAIL_FROM;
  else process.env.TOPO_EMAIL_FROM = savedEmailFrom;
  await cleanup();
}
