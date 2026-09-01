import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import test from 'node:test';
import { RANKING_COVER_REVIEW, RANKING_COVER_REVIEW_KEY } from '../ranking-cover-review.js';

const execFileAsync = promisify(execFile);

test('cover review emits an idempotent, moderator-safe SQL transaction', async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ['scripts/apply-ranking-cover-review.mjs', '--sql'],
    { cwd: new URL('../', import.meta.url), maxBuffer: 8 * 1024 * 1024 },
  );
  const statements = JSON.parse(stdout);
  const sql = statements.join('\n');

  assert.equal(RANKING_COVER_REVIEW_KEY, '20260901_cover_relevance');
  assert.equal(RANKING_COVER_REVIEW.length, 42);
  assert.match(sql, /ranking_cover_review_state/);
  assert.match(sql, /ranking_cover_review_archive/);
  assert.match(sql, /ranking_cover_matches/);
  assert.match(sql, /rejectedAsset/);
  assert.match(sql, /preservedModeratorChoices/);
  assert.match(sql, /WHERE ranking\.id = match\.ranking_id/);
  assert.doesNotMatch(sql, /UPDATE rankings\s+SET image_url[^]*WHERE\s*;/);
});

test('original covers are included in the Vercel deployment', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.ok(
    config.builds.some(
      (build) => build.src === 'covers/**/*.svg' && build.use === '@vercel/static',
    ),
  );
});

test('original cover copy stays inside the centered square crop', async () => {
  const originals = RANKING_COVER_REVIEW.filter(({ license }) => license === 'Arte original TOPO');

  assert.equal(originals.length, 23);

  for (const { replacement } of originals) {
    const pathname = new URL(replacement).pathname;
    const svg = await readFile(new URL(`..${pathname}`, import.meta.url), 'utf8');
    const textPositions = [...svg.matchAll(/<text x="(\d+)"/g)].map((match) => Number(match[1]));

    assert.equal(textPositions.length, 4, pathname);
    assert.ok(
      textPositions.every((position) => position === 285),
      pathname,
    );
  }
});
