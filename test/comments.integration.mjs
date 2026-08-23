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
const password = 'Teste-Comentarios-2026!';
const users = [1, 2, 3].map((number) => ({
  name: `Comentarista ${number}`,
  email: `topo-comments-${number}-${stamp}@example.com`,
  deviceId: `topo-comments-${number}-${stamp}`,
  cookie: ''
}));

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
  await sql.query(
    'DELETE FROM users WHERE email = ANY($1::text[])',
    [users.map((user) => user.email)]
  );
}

async function signup(user) {
  const response = await request({
    method: 'POST',
    action: 'signup',
    body: {
      display_name: user.name,
      email: user.email,
      password,
      device_id: user.deviceId
    }
  });
  assert.equal(response.statusCode, 201);
  user.cookie = sessionCookie(response);
  assert.match(user.cookie, /^topo_session=/);
}

try {
  await cleanup();

  const bootstrap = await request({
    query: { device_id: `topo-comments-anon-${stamp}` }
  });
  assert.equal(bootstrap.statusCode, 200);
  const [emptyRanking] = await sql.query(`
    SELECT r.id
    FROM rankings r
    LEFT JOIN ranking_comments c
      ON c.ranking_id = r.id
      AND c.status = 'published'
    WHERE r.is_active = true
    GROUP BY r.id
    HAVING COUNT(c.id) = 0
    ORDER BY r.id
    LIMIT 1
  `);
  const ranking = bootstrap.body.rankings.find(
    (item) => item.id === emptyRanking?.id
  );
  assert.ok(ranking);
  assert.ok(ranking.opts.length >= 3);

  const anonymousWrite = await request({
    method: 'POST',
    action: 'comments',
    body: {
      ranking_id: ranking.id,
      option_id: ranking.opts[0].id,
      body: 'Sem cadastro não deve publicar.'
    }
  });
  assert.equal(anonymousWrite.statusCode, 401);
  assert.equal(anonymousWrite.body.error, 'authentication_required');

  await Promise.all(users.map(signup));

  const firstComment = await request({
    method: 'POST',
    action: 'comments',
    cookie: users[0].cookie,
    body: {
      ranking_id: ranking.id,
      option_id: ranking.opts[0].id,
      body: 'x'.repeat(200)
    }
  });
  assert.equal(firstComment.statusCode, 201);
  assert.equal(firstComment.body.comment.body.length, 200);
  assert.equal(firstComment.body.comment.isMine, true);
  assert.equal(firstComment.body.comment.edited, false);

  const duplicate = await request({
    method: 'POST',
    action: 'comments',
    cookie: users[0].cookie,
    body: {
      ranking_id: ranking.id,
      option_id: ranking.opts[1].id,
      body: 'Uma segunda defesa não pode entrar.'
    }
  });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.body.error, 'comment_exists');

  const overLimit = await request({
    method: 'PATCH',
    action: 'comments',
    cookie: users[0].cookie,
    body: {
      ranking_id: ranking.id,
      option_id: ranking.opts[1].id,
      body: '🍫'.repeat(201)
    }
  });
  assert.equal(overLimit.statusCode, 400);
  assert.equal(overLimit.body.error, 'invalid_comment');
  assert.equal(overLimit.body.limit, 200);

  const edited = await request({
    method: 'PATCH',
    action: 'comments',
    cookie: users[0].cookie,
    body: {
      ranking_id: ranking.id,
      option_id: ranking.opts[1].id,
      body: 'Mudei de ideia: este chocolate merece o topo.'
    }
  });
  assert.equal(edited.statusCode, 200);
  assert.equal(edited.body.comment.optionId, ranking.opts[1].id);
  assert.equal(edited.body.comment.edited, true);

  for (let index = 1; index < users.length; index += 1) {
    const response = await request({
      method: 'POST',
      action: 'comments',
      cookie: users[index].cookie,
      body: {
        ranking_id: ranking.id,
        option_id: ranking.opts[index].id,
        body: `A defesa pública número ${index + 1}.`
      }
    });
    assert.equal(response.statusCode, 201);
  }

  const publicComments = await request({
    action: 'comments',
    query: { ranking_id: ranking.id }
  });
  assert.equal(publicComments.statusCode, 200);
  assert.equal(publicComments.body.total, 3);
  assert.equal(publicComments.body.comments.length, 2);
  assert.deepEqual(
    publicComments.body.comments.map((comment) => comment.name),
    [users[2].name, users[1].name]
  );
  assert.equal(publicComments.body.mine, null);
  assert.equal(publicComments.body.limit, 200);
  assert.equal(publicComments.body.pageSize, 2);
  assert.equal(publicComments.body.hasMore, true);
  assert.ok(
    publicComments.body.comments.every(
      (comment) => !('userId' in comment) && !('email' in comment)
    )
  );

  const firstUserView = await request({
    action: 'comments',
    query: { ranking_id: ranking.id },
    cookie: users[0].cookie
  });
  assert.equal(firstUserView.statusCode, 200);
  assert.equal(firstUserView.body.comments.length, 2);
  assert.equal(firstUserView.body.mine.body, 'Mudei de ideia: este chocolate merece o topo.');
  assert.equal(firstUserView.body.mine.optionId, ranking.opts[1].id);
  assert.equal(firstUserView.body.mine.isMine, true);

  const allComments = await request({
    action: 'comments',
    query: { ranking_id: ranking.id, view: 'all', page: '0' }
  });
  assert.equal(allComments.statusCode, 200);
  assert.equal(allComments.body.total, 3);
  assert.equal(allComments.body.comments.length, 3);
  assert.equal(allComments.body.page, 0);
  assert.equal(allComments.body.pageSize, 20);
  assert.equal(allComments.body.hasMore, false);

  console.log('Comments integration passed: auth, 200 chars, edit, latest two and view all.');
} finally {
  await cleanup();
}
