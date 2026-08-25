import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const audit = await readFile(
  new URL('../scripts/audit-ranking-images.mjs', import.meta.url),
  'utf8',
);
const catalog = await readFile(new URL('../scripts/apply-catalog.mjs', import.meta.url), 'utf8');
const batch4 = await readFile(new URL('../data/rankings-batch-4.json', import.meta.url), 'utf8');
const batch5 = await readFile(new URL('../data/rankings-batch-5.json', import.meta.url), 'utf8');
const batch6 = await readFile(new URL('../data/rankings-batch-6.json', import.meta.url), 'utf8');
const batch7 = await readFile(new URL('../data/rankings-batch-7.json', import.meta.url), 'utf8');
const cityScript = await readFile(
  new URL('../scripts/apply-city-rankings.mjs', import.meta.url),
  'utf8',
);
const migration = await readFile(
  new URL('../migrations/20260823_ranking_cover_fixes.sql', import.meta.url),
  'utf8',
);

assert.match(audit, /method: 'HEAD'/, 'image audit must probe the real remote file');
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

for (const source of [batch4, batch5, batch6, batch7, cityScript]) {
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
