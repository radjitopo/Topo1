import assert from 'node:assert/strict';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const [{ default: handler }] = await Promise.all([
  import('../api.js')
]);
const sql = neon(process.env.DATABASE_URL);

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const email = `topo-api-test-${stamp}@example.com`;
const password = 'Teste-Topo-2026!';
const deviceId = `topo-test-${stamp}`;

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
    headers: cookie ? { cookie } : {},
    body
  };
  const res = new MockResponse();
  await handler(req, res);
  return res;
}

function sessionCookie(res) {
  return String(res.headers.get('set-cookie') || '').split(';')[0];
}

async function cleanup() {
  await sql.transaction([
    sql.query('DELETE FROM votes WHERE device_id = $1', [deviceId]),
    sql.query('DELETE FROM anonymous_usage WHERE device_id = $1', [deviceId]),
    sql.query('DELETE FROM users WHERE lower(email) = lower($1)', [email])
  ]);
}

try {
  await cleanup();

  const bootstrap = await request({ query: { device_id: deviceId } });
  assert.equal(bootstrap.statusCode, 200);
  assert.equal(bootstrap.body.rankings.length, 87);
  assert.equal(bootstrap.body.community.rankings, bootstrap.body.rankings.length);
  assert.equal(
    bootstrap.body.community.votes,
    bootstrap.body.rankings.reduce(
      (total, ranking) => total + Number(ranking.votes || 0),
      0
    )
  );
  assert.ok(Number.isInteger(bootstrap.body.community.users));
  assert.ok(bootstrap.body.community.users >= 0);
  assert.equal(bootstrap.body.viewer.registered, false);
  assert.equal(bootstrap.body.viewer.anonymousLimit, 30);
  assert.ok(bootstrap.body.rankings.every((ranking) => ranking.opts.length === 20));
  assert.equal(
    bootstrap.body.rankings.find((ranking) => ranking.id === 'motos')?.q,
    'As motos mais estilosas'
  );

  const newRankings = bootstrap.body.rankings.filter(
    (ranking) => Date.parse(ranking.createdAt) >= Date.parse('2026-08-20T15:24:00Z')
  );
  assert.equal(newRankings.length, 47);
  assert.equal(
    bootstrap.body.rankings.find((ranking) => ranking.id === 'chocolates-brasil')?.q,
    'Qual chocolate você nunca consegue recusar?'
  );

  const [firstRanking, secondRanking, thirdRanking] = bootstrap.body.rankings;
  const firstOption = firstRanking.opts[0];

  const firstVote = await request({
    method: 'POST',
    body: { device_id: deviceId, option_id: firstOption.id, direction: 1 }
  });
  assert.equal(firstVote.statusCode, 200);
  assert.equal(firstVote.body.viewer.anonymousUsed, 1);

  const removedVote = await request({
    method: 'POST',
    body: { device_id: deviceId, option_id: firstOption.id, direction: 0 }
  });
  assert.equal(removedVote.statusCode, 200);
  assert.equal(removedVote.body.viewer.anonymousUsed, 1);

  for (const option of firstRanking.opts.slice(0, 10)) {
    const result = await request({
      method: 'POST',
      body: { device_id: deviceId, option_id: option.id, direction: 1 }
    });
    assert.equal(result.statusCode, 200);
  }

  const rankingLimit = await request({
    method: 'POST',
    body: {
      device_id: deviceId,
      option_id: firstRanking.opts[10].id,
      direction: 1
    }
  });
  assert.equal(rankingLimit.statusCode, 409);
  assert.equal(rankingLimit.body.error, 'ranking_vote_limit');

  for (const option of secondRanking.opts.slice(0, 10)) {
    const result = await request({
      method: 'POST',
      body: { device_id: deviceId, option_id: option.id, direction: -1 }
    });
    assert.equal(result.statusCode, 200);
  }

  for (const option of thirdRanking.opts.slice(0, 9)) {
    const result = await request({
      method: 'POST',
      body: { device_id: deviceId, option_id: option.id, direction: 1 }
    });
    assert.equal(result.statusCode, 200);
  }

  const anonymousWall = await request({
    method: 'POST',
    body: {
      device_id: deviceId,
      option_id: thirdRanking.opts[9].id,
      direction: 1
    }
  });
  assert.equal(anonymousWall.statusCode, 403);
  assert.equal(anonymousWall.body.error, 'registration_required');

  const signup = await request({
    method: 'POST',
    action: 'signup',
    body: {
      display_name: 'Teste TOPO',
      email,
      password,
      device_id: deviceId
    }
  });
  assert.equal(signup.statusCode, 201);
  assert.equal(signup.body.viewer.registered, true);
  let cookie = sessionCookie(signup);
  assert.match(cookie, /^topo_session=/);

  const registeredVote = await request({
    method: 'POST',
    cookie,
    body: {
      device_id: deviceId,
      option_id: thirdRanking.opts[9].id,
      direction: 1
    }
  });
  assert.equal(registeredVote.statusCode, 200);
  assert.equal(registeredVote.body.viewer.registered, true);
  assert.equal(registeredVote.body.viewer.anonymousUsed, 30);

  const registeredRankingLimit = await request({
    method: 'POST',
    cookie,
    body: {
      device_id: deviceId,
      option_id: thirdRanking.opts[10].id,
      direction: 1
    }
  });
  assert.equal(registeredRankingLimit.statusCode, 409);
  assert.equal(registeredRankingLimit.body.error, 'ranking_vote_limit');

  const profile = await request({
    action: 'profile',
    query: { device_id: deviceId },
    cookie
  });
  assert.equal(profile.statusCode, 200);
  assert.equal(profile.body.user.email, email);
  assert.equal(profile.body.stats.votes, 30);
  assert.equal(profile.body.stats.rankings, 3);
  assert.equal(profile.body.stats.upVotes, 20);
  assert.equal(profile.body.stats.downVotes, 10);
  assert.ok(profile.body.recent.length > 0);

  const authenticatedCatalog = await request({
    query: { device_id: deviceId },
    cookie
  });
  assert.equal(authenticatedCatalog.statusCode, 200);
  assert.equal(authenticatedCatalog.body.viewer.registered, true);
  assert.equal(
    authenticatedCatalog.body.rankings
      .flatMap((ranking) => ranking.opts)
      .filter((option) => option.mine !== 0).length,
    30
  );

  const logout = await request({ method: 'POST', action: 'logout', cookie, body: {} });
  assert.equal(logout.statusCode, 200);
  assert.match(String(logout.headers.get('set-cookie')), /Max-Age=0/);

  const loggedOutProfile = await request({
    action: 'profile',
    query: { device_id: deviceId }
  });
  assert.equal(loggedOutProfile.statusCode, 401);

  const wrongLogin = await request({
    method: 'POST',
    action: 'login',
    body: { email, password: 'senha-errada', device_id: deviceId }
  });
  assert.equal(wrongLogin.statusCode, 401);

  const login = await request({
    method: 'POST',
    action: 'login',
    body: { email, password, device_id: deviceId }
  });
  assert.equal(login.statusCode, 200);
  cookie = sessionCookie(login);
  assert.match(cookie, /^topo_session=/);

  const restoredProfile = await request({
    action: 'profile',
    query: { device_id: deviceId },
    cookie
  });
  assert.equal(restoredProfile.statusCode, 200);
  assert.equal(restoredProfile.body.stats.votes, 30);

  console.log('API integration passed: 87 rankings, limits, auth, votes and profile.');
} finally {
  await cleanup();
}
