import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [
  api,
  app,
  catalog,
  cityCatalog,
  localCatalogBuilder,
  localCatalog,
  batch13,
  expansion,
  historicalMigration,
  migration,
  runner,
  packageJson,
] = await Promise.all([
  readFile(new URL('api.js', root), 'utf8'),
  readFile(new URL('app.js', root), 'utf8'),
  readFile(new URL('scripts/apply-catalog.mjs', root), 'utf8'),
  readFile(new URL('scripts/apply-city-rankings.mjs', root), 'utf8'),
  readFile(new URL('scripts/build-local-catalog.mjs', root), 'utf8'),
  readFile(new URL('data/local-catalog.json', root), 'utf8').then(JSON.parse),
  readFile(new URL('data/rankings-batch-13.json', root), 'utf8').then(JSON.parse),
  readFile(new URL('data/public-option-expansion.json', root), 'utf8').then(JSON.parse),
  readFile(new URL('migrations/20260901_public_top10.sql', root), 'utf8'),
  readFile(new URL('migrations/20260901_public_option_targets.sql', root), 'utf8'),
  readFile(new URL('scripts/apply-public-option-targets.mjs', root), 'utf8'),
  readFile(new URL('package.json', root), 'utf8'),
]);

test('public rankings use up to 20 verified Local options and 14 general options', () => {
  assert.match(api, /const GENERAL_PUBLIC_OPTION_COUNT = 14;/);
  assert.match(api, /options\.length !== GENERAL_PUBLIC_OPTION_COUNT/);
  assert.match(catalog, /const GENERAL_PUBLIC_OPTION_COUNT = 14;/);
  assert.match(cityCatalog, /const LOCAL_PUBLIC_OPTION_COUNT = 20;/);
  assert.match(localCatalogBuilder, /const LOCAL_PUBLIC_MINIMUM_OPTION_COUNT = 5;/);
  assert.match(localCatalogBuilder, /curatedLabels\.length >= LOCAL_PUBLIC_MINIMUM_OPTION_COUNT/);
  assert.ok(Object.keys(expansion.general).length >= 50);
  assert.ok(Object.values(expansion.general).every((labels) => labels.length >= 4));
  assert.ok(
    batch13.every(
      (ranking) =>
        new Set([...ranking.opts.map(({ label }) => label), ...expansion.general[ranking.id]])
          .size >= 14,
    ),
  );
  assert.ok(localCatalog.every((ranking) => ranking.opts.length >= 5 && ranking.opts.length <= 20));
  assert.ok(
    localCatalog
      .filter((ranking) => ranking.city !== 'Florianópolis' && ranking.localCategoryKey !== 'vegan')
      .every((ranking) => ranking.opts.length === 20),
  );
  assert.match(app, /visibleOptionCount = 10/);
  assert.match(app, /Ver mais \$\{next\}/);
  assert.match(api, /COALESCE\(MAX\(ranking_options\.position\), 0\) \+ 1 AS next_position/);
});

test('the historical reduction remains recoverable and the new migration restores its archive', () => {
  assert.match(historicalMigration, /public_top10_option_archive/);
  assert.match(historicalMigration, /public_top10_ranking_archive/);
  assert.match(historicalMigration, /DELETE FROM ranking_options option/);
  assert.match(migration, /FROM public_top10_option_archive archive/);
  assert.match(migration, /archive\.current_score/);
  assert.match(migration, /'top10_archive'/);
  assert.match(migration, /target_count = 20/);
  assert.match(migration, /ELSE 14/);
  assert.match(migration, /archive\.action = 'deactivated_underfilled'/);
  assert.doesNotMatch(migration, /DELETE FROM ranking_options/);
});

test('the direct-vote cap covers the largest public ranking and the migration is validated', () => {
  assert.match(api, /const RANKING_LIMIT = 20;/);
  assert.match(app, /rankingLimit: 20/);
  assert.match(runner, /20260901_public_option_targets\.sql/);
  assert.match(runner, /local_below_target/);
  assert.match(runner, /general_below_target/);
  assert.match(packageJson, /"db:public-option-targets"/);
});
