import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [review, cityCatalog, refreshScript, rankingTitles, packageJson, expansion] =
  await Promise.all([
    readFile(new URL('data/vegan-floripa-refresh.json', root), 'utf8').then(JSON.parse),
    readFile(new URL('scripts/apply-city-rankings.mjs', root), 'utf8'),
    readFile(new URL('scripts/apply-vegan-floripa-refresh.mjs', root), 'utf8'),
    readFile(new URL('ranking-titles.js', root), 'utf8'),
    readFile(new URL('package.json', root), 'utf8').then(JSON.parse),
    readFile(new URL('data/public-option-expansion.json', root), 'utf8').then(JSON.parse),
  ]);

test('the curated vegan/vegetarian Florianópolis ranking has 20 unique options', () => {
  assert.equal(review.reviewKey, '20260901_vegan_floripa_refresh');
  assert.equal(review.rankingId, 'restaurantes-veganos-floripa');
  assert.equal(
    review.question,
    'Qual é o melhor restaurante/lanchonete vegano ou vegetariano de Florianópolis?',
  );
  assert.equal(review.options.length, 20);
  assert.equal(new Set(review.options).size, 20);
  assert.equal(review.removedOptions.length, 4);
  assert.equal(review.newOptions.length, 4);

  for (const label of review.options) {
    assert.ok(cityCatalog.includes(`'${label.replaceAll("'", "\\'")}'`), label);
  }
  assert.ok(cityCatalog.includes(review.question));
  assert.ok(rankingTitles.includes(review.question));
});

test('known mixed or retired places cannot be reintroduced by editorial expansion', () => {
  const expanded = expansion.local[review.rankingId] || [];
  for (const label of review.excludedLabels) {
    assert.equal(expanded.includes(label), false, label);
  }
});

test('the refresh archives removals while preserving participation for retained options', () => {
  assert.match(refreshScript, /option_relevance_review_archive/);
  assert.match(refreshScript, /change_kind = 'rename'/);
  assert.match(refreshScript, /archive\.live_votes/);
  assert.match(refreshScript, /archive\.duel_entries/);
  assert.match(refreshScript, /DELETE FROM ranking_options/);
  assert.doesNotMatch(refreshScript, /DELETE FROM votes/);
  assert.equal(
    packageJson.scripts['db:vegan-floripa-refresh'],
    'node scripts/apply-vegan-floripa-refresh.mjs',
  );
});
