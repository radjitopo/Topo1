import assert from 'node:assert/strict';
import { neon } from '@neondatabase/serverless';
import handler from '../api.js';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const sql = neon(process.env.DATABASE_URL);
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const deviceId = `topo-api-test-${stamp}`;

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

async function request({ method = 'GET', action = '', query = {}, body } = {}) {
  const req = {
    method,
    query: { ...query, ...(action ? { action } : {}) },
    headers: {},
    body,
  };
  const res = new MockResponse();
  await handler(req, res);
  return res;
}

async function cleanup() {
  await sql.transaction([
    sql.query('DELETE FROM votes WHERE device_id = $1', [deviceId]),
    sql.query('DELETE FROM anonymous_usage WHERE device_id = $1', [deviceId]),
  ]);
}

try {
  await cleanup();

  const bootstrap = await request({ query: { device_id: deviceId } });
  assert.equal(bootstrap.statusCode, 200);
  assert.ok(bootstrap.body.rankings.length > 0);
  assert.equal(bootstrap.body.community.rankings, bootstrap.body.rankings.length);
  assert.equal(
    bootstrap.body.community.votes,
    bootstrap.body.rankings.reduce((total, ranking) => total + Number(ranking.votes || 0), 0),
  );
  assert.equal(bootstrap.body.viewer.registered, false);
  assert.equal(bootstrap.body.viewer.anonymousLimit, 30);
  assert.equal(bootstrap.body.viewer.rankingLimit, 20);
  assert.ok(bootstrap.body.rankings.every((ranking) => ranking.opts.length >= 3));

  const ranking = bootstrap.body.rankings.find((item) => item.opts.length >= 2);
  const option = ranking.opts[0];
  const initialCommunityVotes = bootstrap.body.community.votes;

  const firstVote = await request({
    method: 'POST',
    body: { device_id: deviceId, option_id: option.id, direction: 1 },
  });
  assert.equal(firstVote.statusCode, 200);
  assert.equal(firstVote.body.rankingId, ranking.id);
  assert.equal(firstVote.body.direction, 1);
  assert.equal(firstVote.body.viewer.anonymousUsed, 1);
  assert.equal(firstVote.body.communityVotes, initialCommunityVotes + 1);
  assert.ok(Number.isFinite(firstVote.body.score));
  assert.ok(Number.isFinite(firstVote.body.rankingVotes));
  assert.ok(Number.isFinite(firstVote.body.todayVotes));

  const removedVote = await request({
    method: 'POST',
    body: { device_id: deviceId, option_id: option.id, direction: 0 },
  });
  assert.equal(removedVote.statusCode, 200);
  assert.equal(removedVote.body.direction, 0);
  assert.equal(removedVote.body.viewer.anonymousUsed, 1);
  assert.equal(removedVote.body.communityVotes, initialCommunityVotes);

  const profile = await request({ action: 'profile', query: { device_id: deviceId } });
  assert.equal(profile.statusCode, 401);

  for (const action of ['signup', 'login', 'request-password-reset', 'reset-password']) {
    const legacy = await request({ method: 'POST', action, body: {} });
    assert.equal(legacy.statusCode, 410);
  }

  const logout = await request({ method: 'POST', action: 'logout', body: {} });
  assert.equal(logout.statusCode, 200);
  assert.match(String(logout.headers.get('set-cookie')), /Max-Age=0/);

  console.log('API integration passed: catalog, anonymous voting and active auth contract.');
} finally {
  await cleanup();
}
