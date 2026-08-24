import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import handler from '../api.js';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const sql = neon(process.env.DATABASE_URL);
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const users = [1, 2, 3].map((number) => ({
  id: randomUUID(),
  name: `Comentarista ${number}`,
  email: `topo-comments-${number}-${stamp}@example.com`,
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
  await sql.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [users.map((user) => user.id)]);
}

try {
  await cleanup();

  const [ranking] = await sql.query(`
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
  assert.ok(ranking, 'the integration test needs one ranking without comments');

  const options = await sql.query(
    `
      SELECT id
      FROM ranking_options
      WHERE ranking_id = $1
      ORDER BY position
      LIMIT 3
    `,
    [ranking.id],
  );
  assert.equal(options.length, 3);

  const setup = [];
  for (const [index, user] of users.entries()) {
    setup.push(
      sql.query(
        `
          INSERT INTO users (id, email, display_name, password_hash)
          VALUES ($1, $2, $3, $4)
        `,
        [user.id, user.email, user.name, `integration-test-${stamp}`],
      ),
      sql.query(
        `
          INSERT INTO ranking_comments (
            ranking_id, user_id, option_id, body, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, now() - ($5::int * interval '1 minute'), now())
        `,
        [
          ranking.id,
          user.id,
          options[index].id,
          `A defesa pública número ${index + 1}.`,
          3 - index,
        ],
      ),
    );
  }
  await sql.transaction(setup);

  const anonymousWrite = await request({
    method: 'POST',
    action: 'comments',
    body: {
      ranking_id: ranking.id,
      option_id: options[0].id,
      body: 'Sem cadastro não deve publicar.',
    },
  });
  assert.equal(anonymousWrite.statusCode, 401);
  assert.equal(anonymousWrite.body.error, 'authentication_required');

  const latest = await request({ action: 'comments', query: { ranking_id: ranking.id } });
  assert.equal(latest.statusCode, 200);
  assert.equal(latest.body.total, 3);
  assert.equal(latest.body.comments.length, 2);
  assert.deepEqual(
    latest.body.comments.map((comment) => comment.name),
    [users[2].name, users[1].name],
  );
  assert.equal(latest.body.mine, null);
  assert.ok(
    latest.body.comments.every((comment) => !('userId' in comment) && !('email' in comment)),
  );

  const all = await request({
    action: 'comments',
    query: { ranking_id: ranking.id, view: 'all', page: '0' },
  });
  assert.equal(all.statusCode, 200);
  assert.equal(all.body.comments.length, 3);
  assert.equal(all.body.hasMore, false);

  console.log('Comments integration passed: public feed, privacy and anonymous protection.');
} finally {
  await cleanup();
}
