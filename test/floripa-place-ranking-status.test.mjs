import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { inactiveTopoRankingIds, isInactiveTopoRanking } from '../ranking-status-policy.js';

const root = new URL('../', import.meta.url);
const [migration, runner, catalogImporter, cityImporter, packageJson] = await Promise.all([
  readFile(new URL('migrations/20260908_deactivate_floripa_place_rankings.sql', root), 'utf8'),
  readFile(new URL('scripts/apply-floripa-place-ranking-status.mjs', root), 'utf8'),
  readFile(new URL('scripts/apply-catalog.mjs', root), 'utf8'),
  readFile(new URL('scripts/apply-city-rankings.mjs', root), 'utf8'),
  readFile(new URL('package.json', root), 'utf8').then(JSON.parse),
]);

const remainingPlaceIds = ['bairros-floripa', 'hoteis-floripa', 'praias'];
const allFloripaGeneralIds = [
  'bandas-ilha-da-magia',
  'bandas-rock-ilha-da-magia',
  ...remainingPlaceIds,
];

test('the three remaining Florianópolis place rankings are deactivated safely', () => {
  for (const rankingId of remainingPlaceIds) {
    assert.match(migration, new RegExp(`\\('${rankingId}'\\)`));
    assert.match(runner, new RegExp(`'${rankingId}'`));
  }

  assert.match(migration, /category <> 'Florianópolis'/);
  assert.match(migration, /is_vip <> false/);
  assert.match(migration, /COUNT\(\*\)[\s\S]*<> 3/);
  assert.match(migration, /is_active = false/);
  assert.match(migration, /'reversible', true/);
  assert.doesNotMatch(migration, /DELETE\s+FROM/i);
});

test('future catalog imports keep all five local-only rankings out of TOPO', () => {
  assert.deepEqual(inactiveTopoRankingIds, allFloripaGeneralIds);
  assert.ok(allFloripaGeneralIds.every(isInactiveTopoRanking));
  assert.match(catalogImporter, /inactiveTopoRankingIds/);
  assert.match(catalogImporter, /isInactiveTopoRanking/);
  assert.match(catalogImporter, /is_active = false/);
  assert.match(cityImporter, /isInactiveTopoRanking/);
  assert.match(cityImporter, /is_active = EXCLUDED\.is_active/);
});

test('the new migration has a transactional runner', () => {
  assert.match(runner, /SET TRANSACTION ISOLATION LEVEL SERIALIZABLE/);
  assert.match(runner, /sql\.transaction/);
  assert.equal(
    packageJson.scripts['db:floripa-place-ranking-status'],
    'node scripts/apply-floripa-place-ranking-status.mjs',
  );
});
