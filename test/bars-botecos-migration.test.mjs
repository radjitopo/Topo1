import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const scriptUrl = new URL('../scripts/apply-bars-botecos.mjs', import.meta.url);

const [{ stdout: statementOutput }, { stdout: preflightSql }, { stdout: validationSql }] =
  await Promise.all([
    execFileAsync(process.execPath, [scriptUrl.pathname, '--sql'], {
      maxBuffer: 4 * 1024 * 1024,
    }),
    execFileAsync(process.execPath, [scriptUrl.pathname, '--preflight-sql'], {
      maxBuffer: 4 * 1024 * 1024,
    }),
    execFileAsync(process.execPath, [scriptUrl.pathname, '--validation-sql'], {
      maxBuffer: 4 * 1024 * 1024,
    }),
  ]);

const statements = JSON.parse(statementOutput);
const migration = statements.join('\n');

test('the split migration has an exact, idempotent scope', () => {
  assert.match(migration, /local-bars-botecos-2026-09-v1/);
  assert.match(migration, /COUNT\(\*\) FROM bars_botecos_desired_rankings\) <> 42/);
  assert.match(migration, /COUNT\(DISTINCT city\).*<> 21/);
  assert.match(migration, /COUNT\(\*\) FROM bars_botecos_desired_options\) <> 840/);
  assert.match(migration, /option_relevance_review_state/);
  assert.match(migration, /bars_botecos_run_guard/);
});

test('the migration refuses to discard votes and preserves personal score events', () => {
  assert.match(migration, /Há votos, seleções ou comentários novos/);
  assert.match(migration, /user_score_events/);
  assert.match(migration, /bars_botecos_score_guard/);
  assert.match(migration, /preserved_score_events/);
  assert.match(migration, /proteção da pontuação das pessoas/);
  assert.doesNotMatch(migration, /DELETE FROM user_score_events/);
});

test('the migration archives old bars, resets stale duels and creates both categories', () => {
  assert.match(migration, /INSERT INTO option_relevance_review_archive/);
  assert.match(migration, /DELETE FROM ranking_duel_rounds/);
  assert.match(migration, /DELETE FROM ranking_duel_sessions/);
  assert.match(migration, /DELETE FROM ranking_options/);
  assert.match(migration, /INSERT INTO rankings/);
  assert.match(migration, /INSERT INTO ranking_options/);
  assert.match(migration, /botecos-/);
});

test('preflight and validation expose structure, participation and score counters', () => {
  for (const sql of [preflightSql, validationSql]) {
    for (const counter of [
      'direct_votes',
      'double_votes',
      'vote_history',
      'top3_selections',
      'duel_rounds',
      'duel_entries',
      'duel_sessions',
      'comments',
      'preserved_score_events',
      'preserved_score_points',
    ]) {
      assert.match(sql, new RegExp(counter), counter);
    }
  }
  assert.match(preflightSql, /existing_bars/);
  assert.match(preflightSql, /existing_botecos/);
  assert.match(validationSql, /valid_rankings/);
  assert.match(validationSql, /option_mismatches/);
});
