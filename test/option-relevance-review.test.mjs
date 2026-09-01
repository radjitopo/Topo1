import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const review = JSON.parse(
  await readFile(new URL('data/option-relevance-review.json', root), 'utf8'),
);

test('editorial relevance review defines complete, unique Top 10 sets', () => {
  assert.equal(review.reviewKey, '20260901_option_relevance');
  assert.equal(Object.keys(review.top10).length, 13);
  assert.equal(review.replacements.length, 33);
  assert.equal(review.renames.length, 18);
  assert.equal(review.questions.length, 5);

  for (const [rankingId, labels] of Object.entries(review.top10)) {
    assert.equal(labels.length, 10, `${rankingId} must have ten reviewed labels`);
    assert.equal(new Set(labels).size, 10, `${rankingId} must not repeat labels`);
    assert.ok(labels.every((label) => label.trim() === label && label.length > 1));
  }
});

test('every semantic replacement is sourced and represented in the final set', () => {
  const keys = new Set();
  for (const change of review.replacements) {
    const key = `${change.rankingId}\u0000${change.oldLabel}`;
    assert.ok(!keys.has(key), `duplicate replacement: ${key}`);
    keys.add(key);
    assert.notEqual(change.oldLabel, change.newLabel);
    assert.ok(
      change.source === 'editorial' || review.sources[change.source],
      `${key} has no source`,
    );
    assert.ok(review.top10[change.rankingId].includes(change.newLabel));
    assert.ok(!review.top10[change.rankingId].includes(change.oldLabel));
  }
});

test('review tooling archives affected interactions and preserves public Top 10', async () => {
  const [script, migration, importer] = await Promise.all([
    readFile(new URL('scripts/apply-option-relevance-review.mjs', root), 'utf8'),
    readFile(new URL('migrations/20260901_option_relevance_review.sql', root), 'utf8'),
    readFile(new URL('scripts/apply-catalog.mjs', root), 'utf8'),
  ]);

  assert.match(migration, /option_relevance_review_archive/);
  assert.match(migration, /live_votes integer NOT NULL/);
  assert.match(script, /DELETE FROM votes/);
  assert.match(script, /DELETE FROM ranking_duel_rounds/);
  assert.match(script, /HAVING COUNT\(option\.id\) <> 10/);
  assert.match(importer, /option-relevance-review\.json/);
  assert.match(importer, /reviewedLabels/);
});
