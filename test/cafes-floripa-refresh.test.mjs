import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [review, cityCatalog, refreshScript, packageJson] = await Promise.all([
  readFile(new URL('data/cafes-floripa-refresh.json', root), 'utf8').then(JSON.parse),
  readFile(new URL('scripts/apply-city-rankings.mjs', root), 'utf8'),
  readFile(new URL('scripts/apply-cafes-floripa-refresh.mjs', root), 'utf8'),
  readFile(new URL('package.json', root), 'utf8').then(JSON.parse),
]);

test('the curated Florianópolis café ranking has exactly 20 unique options', () => {
  assert.equal(review.reviewKey, '20260901_cafes_floripa_refresh');
  assert.equal(review.rankingId, 'cafes-floripa');
  assert.equal(review.question, 'Qual é o melhor café de Florianópolis?');
  assert.equal(review.options.length, 20);
  assert.equal(new Set(review.options).size, 20);

  for (const label of review.options) {
    assert.ok(cityCatalog.includes(`'${label.replaceAll("'", "\\'")}'`));
  }
});

test('the café refresh archives the old list and fully resets its participation', () => {
  assert.match(refreshScript, /option_relevance_review_archive/);
  assert.match(refreshScript, /DELETE FROM votes/);
  assert.match(refreshScript, /DELETE FROM user_double_votes/);
  assert.match(refreshScript, /DELETE FROM user_vote_history/);
  assert.match(refreshScript, /DELETE FROM ranking_duel_rounds/);
  assert.match(refreshScript, /DELETE FROM ranking_top3_selections/);
  assert.match(refreshScript, /DELETE FROM ranking_comments/);
  assert.match(refreshScript, /DELETE FROM ranking_options/);
  assert.match(refreshScript, /baseline_votes = 0/);
  assert.equal(
    packageJson.scripts['db:cafes-floripa-refresh'],
    'node scripts/apply-cafes-floripa-refresh.mjs',
  );
});
