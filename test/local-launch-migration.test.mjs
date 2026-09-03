import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const scriptUrl = new URL('../scripts/apply-local-launch-curation.mjs', import.meta.url);

const [{ stdout: statementOutput }, { stdout: preflightSql }, { stdout: validationSql }] =
  await Promise.all([
    execFileAsync(process.execPath, [scriptUrl.pathname, '--sql'], { maxBuffer: 4 * 1024 * 1024 }),
    execFileAsync(process.execPath, [scriptUrl.pathname, '--preflight-sql'], {
      maxBuffer: 4 * 1024 * 1024,
    }),
    execFileAsync(process.execPath, [scriptUrl.pathname, '--validation-sql'], {
      maxBuffer: 4 * 1024 * 1024,
    }),
  ]);

const statements = JSON.parse(statementOutput);
const migration = statements.join('\n');

test('the launch migration has exact scope and an idempotency key', () => {
  assert.match(migration, /local-launch-curation-2026-09-v2/);
  assert.match(migration, /COUNT\(\*\) FROM local_launch_desired_rankings\) <> 320/);
  assert.match(migration, /COUNT\(DISTINCT city\).*<> 20/);
  assert.match(migration, /city = 'Florianópolis'/);
  assert.match(migration, /ranking\.category = 'Florianópolis'/);
  assert.match(migration, /option_relevance_review_state/);
});

test('the reset covers every participation table tied to replaced options', () => {
  for (const table of [
    'ranking_duel_rounds',
    'ranking_duel_sessions',
    'ranking_comments',
    'ranking_top3_selections',
    'user_double_votes',
    'user_vote_history',
    'votes',
    'public_option_target_additions',
    'ranking_options',
  ]) {
    assert.match(migration, new RegExp(`DELETE FROM ${table}`), table);
  }
  assert.match(migration, /SET question = desired\.question/);
  assert.match(migration, /baseline_votes = 0/);
  assert.match(migration, /INSERT INTO ranking_options/);
});

test('the migration archives removed participation and protects Florianópolis', () => {
  assert.match(migration, /INSERT INTO option_relevance_review_archive/);
  assert.match(migration, /removed_direct_votes/);
  assert.match(migration, /removed_duel_entries/);
  assert.match(migration, /local_launch_floripa_guard/);
  assert.match(migration, /floripa_after IS DISTINCT FROM/);
  assert.match(migration, /cancelou a transação/);
});

test('preflight and validation queries expose all safety counters', () => {
  for (const sql of [preflightSql, validationSql]) {
    assert.match(sql, /direct_votes/);
    assert.match(sql, /double_votes/);
    assert.match(sql, /vote_history/);
    assert.match(sql, /top3_selections/);
    assert.match(sql, /duel_rounds/);
    assert.match(sql, /duel_entries/);
    assert.match(sql, /duel_sessions/);
    assert.match(sql, /comments/);
  }
  assert.match(preflightSql, /floripa_matches/);
  assert.match(preflightSql, /matched_rankings/);
  assert.match(validationSql, /option_mismatches/);
  assert.match(validationSql, /valid_rankings/);
});
