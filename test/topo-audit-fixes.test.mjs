import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = new URL('../', import.meta.url);

test('audit repair restores the approved café set and the two missing covers', async () => {
  const [cafes, fixes] = await Promise.all([
    readFile(new URL('data/cafes-floripa-refresh.json', root), 'utf8').then(JSON.parse),
    readFile(new URL('data/topo-audit-fixes-20260915.json', root), 'utf8').then(JSON.parse),
  ]);

  assert.equal(cafes.options.length, 20);
  assert.ok(cafes.options.includes('BrodDo'));
  assert.ok(cafes.options.includes('Family Coffee'));
  assert.equal(fixes.unexpectedCafeOptions.length, 6);
  assert.equal(fixes.covers.length, 2);
  assert.deepEqual(fixes.covers.map(({ rankingId }) => rankingId).sort(), [
    'melhores-sobremesas',
    'tarefas-mais-sinistras-em-casa',
  ]);
});

test('audit repair SQL is idempotent and preserves participation on retained cafés', async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ['scripts/apply-topo-audit-fixes-20260915.mjs', '--sql'],
    { cwd: root, maxBuffer: 8 * 1024 * 1024 },
  );
  const sql = JSON.parse(stdout).join('\n');

  assert.match(sql, /20260915_cafes_floripa_cleanup/);
  assert.match(sql, /cafes_kept_participation/);
  assert.match(sql, /A participação dos 18 cafés preservados foi alterada/);
  assert.match(sql, /DELETE FROM ranking_options option\s+USING cafes_options_to_remove/);
  assert.match(sql, /INSERT INTO ranking_options/);
  assert.match(sql, /ranking_cover_review_archive/);
  assert.match(sql, /COALESCE\(ranking\.image_url, ''\) = ''/);
  assert.doesNotMatch(sql, /DELETE FROM votes/);
  assert.doesNotMatch(sql, /DELETE FROM ranking_options\s+WHERE ranking_id/);
});
