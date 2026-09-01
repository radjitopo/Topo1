import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { auditRankingImages } from '../scripts/audit-ranking-images.mjs';

const audit = await readFile(
  new URL('../scripts/audit-ranking-images.mjs', import.meta.url),
  'utf8',
);
const catalog = await readFile(new URL('../scripts/apply-catalog.mjs', import.meta.url), 'utf8');
const batch4 = await readFile(new URL('../data/rankings-batch-4.json', import.meta.url), 'utf8');
const batch5 = await readFile(new URL('../data/rankings-batch-5.json', import.meta.url), 'utf8');
const batch6 = await readFile(new URL('../data/rankings-batch-6.json', import.meta.url), 'utf8');
const batch7 = await readFile(new URL('../data/rankings-batch-7.json', import.meta.url), 'utf8');
const batch8 = await readFile(new URL('../data/rankings-batch-8.json', import.meta.url), 'utf8');
const batch9 = await readFile(new URL('../data/rankings-batch-9.json', import.meta.url), 'utf8');
const batch10 = await readFile(new URL('../data/rankings-batch-10.json', import.meta.url), 'utf8');
const batch11 = await readFile(new URL('../data/rankings-batch-11.json', import.meta.url), 'utf8');
const batch12 = await readFile(new URL('../data/rankings-batch-12.json', import.meta.url), 'utf8');
const batch13 = await readFile(new URL('../data/rankings-batch-13.json', import.meta.url), 'utf8');
const cityScript = await readFile(
  new URL('../scripts/apply-city-rankings.mjs', import.meta.url),
  'utf8',
);
const migration = await readFile(
  new URL('../migrations/20260823_ranking_cover_fixes.sql', import.meta.url),
  'utf8',
);

assert.match(audit, /imageRequest\(image, 'HEAD'\)/, 'image audit must try a cheap HEAD probe');
assert.match(audit, /imageRequest\(image, 'GET'\)/, 'image audit must retry with a ranged GET');
assert.match(audit, /bytes=0-2047/, 'fallback GET must avoid downloading the complete image');
assert.match(
  audit,
  /contentType\.toLowerCase\(\)\.startsWith\('image\/'\)/,
  'image audit must reject non-image responses',
);
assert.match(audit, /altura solicitada baixa/, 'image audit must flag overly shallow crops');
assert.match(audit, /duplicatePhotoGroups/, 'image audit must flag repeated editorial photos');
assert.match(
  catalog,
  /await auditRankingImages\(newRankings\)/,
  'catalog application must run the image audit automatically',
);
assert.match(
  catalog,
  /imageAudit\.duplicates\.length/,
  'catalog application must surface repeated covers for editorial review',
);

for (const source of [
  batch4,
  batch5,
  batch6,
  batch7,
  batch8,
  batch9,
  batch10,
  batch11,
  batch12,
  batch13,
  cityScript,
]) {
  assert.doesNotMatch(
    source,
    /photo-1569783721854-33a99b4c66c5/,
    'broken dinosaur cover must not return',
  );
  assert.doesNotMatch(
    source,
    /photo-1523050854058-8df90110c9f1/,
    'broken school cover must not return',
  );
  assert.doesNotMatch(source, /[?&]h=(210|420)(&|')/, 'low-height cover requests must not return');
}
for (const id of [
  'dinossauros-irados',
  'piores-dia-aula',
  'jogadoras-futebol',
  'ferias-mais-legais',
  'lanches-recreio',
  'mundos-games-morar',
  'jogos-roblox',
  'desastres-date',
]) {
  assert.ok(migration.includes(`('${id}',`), `cover migration must include ${id}`);
}

console.log('Image audit checks passed.');

test('image audit resolves internal URLs, retries HEAD failures and deduplicates probes', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method, range: options.headers?.range || '' });
    if (options.method === 'HEAD') {
      return new Response(null, { status: 500, headers: { 'content-type': 'text/plain' } });
    }
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 206,
      headers: { 'content-type': 'image/jpeg' },
    });
  };

  try {
    const report = await auditRankingImages(
      [
        { id: 'internal-one', image: '/api?action=ranking-image&ranking_id=one' },
        { id: 'internal-two', image: '/api?action=ranking-image&ranking_id=one' },
      ],
      { concurrency: 1 },
    );
    assert.equal(report.checked, 2);
    assert.equal(report.broken.length, 0);
    assert.equal(calls.length, 2, 'the same image asset should be probed only once');
    assert.equal(calls[0].url, 'https://somostopo.com.br/api?action=ranking-image&ranking_id=one');
    assert.equal(calls[0].method, 'HEAD');
    assert.equal(calls[1].method, 'GET');
    assert.equal(calls[1].range, 'bytes=0-2047');
  } finally {
    global.fetch = originalFetch;
  }
});
