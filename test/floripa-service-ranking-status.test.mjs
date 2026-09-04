import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [migration, runner, packageJson] = await Promise.all([
  readFile(new URL('migrations/20260904_deactivate_floripa_service_rankings.sql', root), 'utf8'),
  readFile(new URL('scripts/apply-floripa-service-ranking-status.mjs', root), 'utf8'),
  readFile(new URL('package.json', root), 'utf8').then(JSON.parse),
]);

const targetRankingIds = ['barbearias-floripa', 'pet-shops-floripa', 'saloes-beleza-floripa'];

test('only the three requested Florianópolis rankings are targeted', () => {
  for (const rankingId of targetRankingIds) {
    assert.match(migration, new RegExp(`\\('${rankingId}'\\)`));
    assert.match(runner, new RegExp(`'${rankingId}'`));
  }

  assert.match(migration, /category <> 'Florianópolis'/);
  assert.match(migration, /is_vip <> false/);
  assert.match(migration, /COUNT\(\*\)[\s\S]*<> 3/);
});

test('the status change is reversible and does not remove options or participation', () => {
  assert.match(migration, /UPDATE rankings ranking/);
  assert.match(migration, /is_active = false/);
  assert.match(migration, /ranking\.is_active = true/);
  assert.match(migration, /'reversible', true/);
  assert.match(migration, /floripa_service_option_guard/);
  assert.match(migration, /floripa_service_participation_guard/);
  assert.match(migration, /Uma opção foi removida ou alterada/);
  assert.match(migration, /A participação mudou durante a desativação/);

  assert.doesNotMatch(migration, /DELETE\s+FROM\s+ranking_options/i);
  assert.doesNotMatch(migration, /UPDATE\s+ranking_options/i);
  assert.doesNotMatch(
    migration,
    /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:votes|user_double_votes|user_vote_history|ranking_duel_entries|ranking_duel_rounds|ranking_duel_sessions|ranking_top3_selections|ranking_comments)\b/i,
  );
});

test('the runner uses a serializable transaction and validates the saved state', () => {
  assert.match(runner, /SET TRANSACTION ISOLATION LEVEL SERIALIZABLE/);
  assert.match(runner, /sql\.transaction/);
  assert.match(runner, /options_preserved/);
  assert.equal(
    packageJson.scripts['db:floripa-service-ranking-status'],
    'node scripts/apply-floripa-service-ranking-status.mjs',
  );
});
