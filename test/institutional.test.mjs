import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import handler, { pages, footerHtml } from '../institutional.js';

const expectedSlugs = [
  'sobre',
  'como-funciona',
  'imprensa',
  'anuncie',
  'contato',
  'denuncie',
  'regras',
  'seguranca',
  'privacidade',
  'termos',
  'cookies',
  'direitos-autorais',
];

const expectedLinks = expectedSlugs.map((slug) => `href="/${slug}"`);
const footer = footerHtml();
assert.deepEqual(
  Object.keys(pages),
  expectedSlugs,
  'the institutional catalog must remain complete and ordered',
);
for (const link of expectedLinks) assert.ok(footer.includes(link), `footer must include ${link}`);
assert.match(footer, /© 2026 TOPO — Tudo vira ranking\./);

function responseMock() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    },
  };
}

for (const slug of expectedSlugs) {
  const res = responseMock();
  handler({ query: { slug } }, res);
  assert.equal(res.statusCode, 200, `${slug} must render successfully`);
  assert.equal(res.headers['Content-Type'], 'text/html; charset=utf-8');
  assert.match(
    res.body,
    new RegExp(`<link rel="canonical" href="https://somostopo\\.com\\.br/${slug}">`),
  );
  assert.ok(res.body.includes('/style.css?v=20260824-7'));
  assert.ok(
    res.body.includes('conta@somostopo.com.br') ||
      !['contato', 'denuncie', 'privacidade'].includes(slug),
  );
  assert.ok(res.body.length > 4000, `${slug} must contain substantive copy`);
  assert.doesNotMatch(res.body, /TODO|Lorem ipsum|undefined/);
  for (const link of expectedLinks)
    assert.ok(res.body.includes(link), `${slug} footer must include ${link}`);
}

const missing = responseMock();
handler({ query: { slug: 'nao-existe' } }, missing);
assert.equal(missing.statusCode, 302);
assert.equal(missing.headers.Location, '/');

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const vercel = await readFile(new URL('../vercel.json', import.meta.url), 'utf8');
const sitemap = await readFile(new URL('../sitemap.js', import.meta.url), 'utf8');
for (const link of expectedLinks)
  assert.ok(index.includes(link), `home footer must include ${link}`);
for (const slug of expectedSlugs) {
  assert.ok(vercel.includes(slug), `routing must include ${slug}`);
  assert.ok(sitemap.includes(`'/${slug}'`), `sitemap must include ${slug}`);
}

console.log('Institutional test passed: complete footer, routes, SEO and substantive pages.');
