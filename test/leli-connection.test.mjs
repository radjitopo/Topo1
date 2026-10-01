import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const clientSource = await readFile(new URL('../pao-da-leli-ponto/api-client.js', import.meta.url), 'utf8');
const workerSource = await readFile(new URL('../pao-da-leli-ponto/sw.js', import.meta.url), 'utf8');

function client(fetch, online = true) {
  const context = vm.createContext({ fetch, navigator: { onLine: online }, URLSearchParams, AbortController,
    setTimeout(fn, delay) { return setTimeout(fn, delay === 400 ? 0 : delay); }, clearTimeout });
  vm.runInContext(clientSource, context);
  return context.leliApi;
}
function json(value, status = 200) { return Response.json(value, { status }); }

test('a read recovers after a transient connection failure and keeps session credentials', async () => {
  let calls = 0;
  const api = client(async (url, options) => {
    calls++;
    assert.equal(url, '/leli-api?action=admin-history&month=2026-10');
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.cache, 'no-store');
    if (calls === 1) throw new TypeError('Failed to fetch');
    return json({ ok: true });
  });
  assert.equal((await api('/leli-api', 'admin-history', 'GET', { month: '2026-10' })).ok, true);
  assert.equal(calls, 2);
});

test('an interrupted response body is also recovered for a read', async () => {
  let calls = 0;
  const api = client(async () => ++calls === 1
    ? { ok: true, status: 200, json: async () => { throw new TypeError('Network interrupted'); } }
    : json({ ok: true }));
  assert.equal((await api('/leli-api', 'health')).ok, true);
  assert.equal(calls, 2);
});

test('a punch is sent only once when its result is uncertain', async () => {
  let calls = 0;
  const api = client(async () => { calls++; throw new TypeError('Failed to fetch'); });
  await assert.rejects(api('/leli-api', 'punch', 'POST', { kind: 'in' }), error =>
    error.code === 'CONNECTION' && /consulte o resultado/.test(error.message) && !/Failed to fetch/.test(error.message));
  assert.equal(calls, 1);
});

test('a rejected login preserves the server error and activation information without retrying', async () => {
  let calls = 0;
  const api = client(async () => { calls++; return json({ error: 'Ative seu acesso.', needsActivation: true }, 403); });
  await assert.rejects(api('/leli-api', 'admin-login', 'POST', {}), error =>
    error.status === 403 && error.data.needsActivation === true && error.message === 'Ative seu acesso.');
  assert.equal(calls, 1);
});

test('an offline login gets a readable connection message with one attempt', async () => {
  let calls = 0;
  const api = client(async () => { calls++; throw new TypeError('Failed to fetch'); }, false);
  await assert.rejects(api('/leli-api', 'admin-login', 'POST', {}), /Confira sua internet/);
  assert.equal(calls, 1);
});

test('a read retries a temporarily unavailable server, but never an expired session', async () => {
  let calls = 0;
  const api = client(async () => ++calls === 1 ? json({}, 503) : json({ ok: true }));
  assert.equal((await api('/leli-api', 'health')).ok, true);
  assert.equal(calls, 2);
  calls = 0;
  const expired = client(async () => { calls++; return json({ error: 'Faça login novamente.' }, 401); });
  await assert.rejects(expired('/leli-api', 'me'), error => error.status === 401);
  assert.equal(calls, 1);
});

test('the worker never intercepts API requests or posts and returns a valid response for uncached assets', async () => {
  const handlers = {};
  const context = vm.createContext({ URL, Response,
    self: { location: { origin: 'https://ponto.paodaleli.com.br', href: 'https://ponto.paodaleli.com.br/sw.js' }, addEventListener(type, fn) { handlers[type] = fn; } },
    fetch: async () => { throw new TypeError('Offline'); },
    caches: { match: async () => undefined } });
  vm.runInContext(workerSource, context);
  for (const [path, method] of [['/leli-api?action=me', 'GET'], ['/leli-api?action=admin-login', 'POST'], ['/other', 'POST']]) {
    handlers.fetch({ request: { url: 'https://ponto.paodaleli.com.br' + path, method }, respondWith() { assert.fail('API or write was intercepted'); } });
  }
  let promise;
  handlers.fetch({ request: { url: 'https://ponto.paodaleli.com.br/uncached.png', method: 'GET' }, respondWith(value) { promise = value; } });
  assert.ok(await promise instanceof Response);
});

test('all screens load the shared client before their application and precache current script versions', async () => {
  for (const [page, script] of [['index.html', 'app-real.js'], ['admin.html', 'admin-real.js'], ['receitas.html', 'receitas-real.js']]) {
    const html = await readFile(new URL('../pao-da-leli-ponto/' + page, import.meta.url), 'utf8');
    const sources = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);
    const helper = sources.findIndex(source => source.startsWith('./api-client.js?'));
    const application = sources.findIndex(source => source.startsWith('./' + script + '?'));
    assert.ok(helper >= 0 && application > helper);
    for (const source of [sources[helper], sources[application]]) assert.ok(workerSource.includes("'" + source + "'"));
  }
});
