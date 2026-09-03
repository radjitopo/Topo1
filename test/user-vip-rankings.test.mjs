import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compactSource } from './source-helpers.mjs';

const root = new URL('../', import.meta.url);

test('user VIP rankings store ownership plus custom private controls', async () => {
  const [migration, customMigration, script, customScript, packageJson] = await Promise.all([
    readFile(new URL('migrations/20260827_user_vip_rankings.sql', root), 'utf8'),
    readFile(new URL('migrations/20260827_user_vip_custom_rankings.sql', root), 'utf8'),
    readFile(new URL('scripts/apply-user-vip-rankings.mjs', root), 'utf8'),
    readFile(new URL('scripts/apply-user-vip-custom-rankings.mjs', root), 'utf8'),
    readFile(new URL('package.json', root), 'utf8'),
  ]);

  assert.match(migration, /ADD COLUMN IF NOT EXISTS vip_owner_user_id uuid/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS vip_source_ranking_id text/);
  assert.match(migration, /REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(migration, /REFERENCES rankings\(id\) ON DELETE SET NULL/);
  assert.match(migration, /CHECK \(vip_owner_user_id IS NULL OR is_vip = true\)/);
  assert.match(migration, /rankings_vip_owner_created_idx/);
  assert.match(script, /20260827_user_vip_rankings\.sql/);
  assert.match(script, /splitSqlStatements/);
  assert.match(packageJson, /"db:user-vip-rankings"/);
  assert.match(customMigration, /ADD COLUMN IF NOT EXISTS vip_description text/);
  assert.match(
    customMigration,
    /ADD COLUMN IF NOT EXISTS vip_voting_open boolean NOT NULL DEFAULT true/,
  );
  assert.match(
    customMigration,
    /ADD COLUMN IF NOT EXISTS vip_added_later boolean NOT NULL DEFAULT false/,
  );
  assert.match(customScript, /20260827_user_vip_custom_rankings\.sql/);
  assert.match(packageJson, /"db:user-vip-custom-rankings"/);
});

test('authenticated users create a zeroed private copy from a public ranking', async () => {
  const api = await readFile(new URL('api.js', root), 'utf8');
  const create = api.slice(
    api.indexOf('async function createUserVipRanking'),
    api.indexOf('async function deleteUserVipRanking'),
  );
  const compact = compactSource(api);

  assert.match(create, /const user = await sessionUser\(req\)/);
  assert.match(create, /authentication_required/);
  assert.match(create, /r\.is_vip = false/);
  assert.match(create, /HAVING COUNT\(o\.id\) BETWEEN 3 AND \$2/);
  assert.match(create, /const passwordHash = hashVipPassword\(password\)/);
  assert.match(create, /vip_owner_user_id/);
  assert.match(create, /vip_source_ranking_id/);
  assert.match(create, /baseline_votes/);
  assert.match(create, /SELECT \$1, source_option\.label, source_option\.position, 0/);
  assert.match(create, /USER_VIP_RANKING_LIMIT/);
  assert.match(create, /isolationLevel: 'Serializable'/);
  assert.match(compact, /action==='vip-rankings'\)returncreateUserVipRanking/);
});

test('registered users create a private ranking from a title and their own options', async () => {
  const api = await readFile(new URL('api.js', root), 'utf8');
  const create = api.slice(
    api.indexOf('async function createUserVipRanking'),
    api.indexOf('async function createUserVipRankingCopy'),
  );

  assert.match(create, /const user = await sessionUser\(req\)/);
  assert.match(create, /authentication_required/);
  assert.match(create, /suggestionText\(body\.title, 8, SUGGESTION_TITLE_LIMIT\)/);
  assert.match(create, /publishedRankingOptions\(body\.options\)/);
  assert.match(create, /providedOptionCount !== options\.length/);
  assert.match(create, /duplicate_vip_option/);
  assert.match(create, /invalid_vip_description/);
  assert.match(create, /'Privado'/);
  assert.match(create, /vip_description/);
  assert.match(create, /vip_voting_open/);
  assert.match(create, /vip_added_later/);
  assert.match(create, /rankingImageUpload\(body\.imageData\)/);
  assert.match(create, /INSERT INTO ranking_images/);
  assert.match(create, /image_url AS "imageUrl"/);
  assert.match(create, /jsonb_array_elements_text/);
  assert.match(create, /USER_VIP_RANKING_LIMIT/);
  assert.match(create, /isolationLevel: 'Serializable'/);
});

test('private rankings are listed only for their owner and stay out of public discovery', async () => {
  const api = await readFile(new URL('api.js', root), 'utf8');
  const access = api.slice(
    api.indexOf('function hasVipAccess'),
    api.indexOf('function vipCookieIsSecure'),
  );
  const meta = api.slice(
    api.indexOf('function vipRankingMeta'),
    api.indexOf('async function vipCatalog'),
  );
  const vipCatalog = api.slice(
    api.indexOf('async function vipCatalog'),
    api.indexOf('async function vipRanking'),
  );
  const publicCatalog = api.slice(
    api.indexOf('async function catalog'),
    api.indexOf('function vipRankingMeta'),
  );

  assert.match(access, /String\(user\.id\) === String\(ownerUserId\)/);
  assert.match(vipCatalog, /if \(!user\)/);
  assert.match(vipCatalog, /vip_owner_user_id = \$1::uuid/);
  assert.doesNotMatch(vipCatalog, /vip_owner_user_id IS NULL/);
  assert.match(meta, /owned:/);
  assert.match(publicCatalog, /ranking\.is_vip = false OR ranking\.vip_owner_user_id IS NULL/);
  assert.doesNotMatch(vipCatalog, /vip_password_hash AS/);
});

test('the VIP area is compact and renders only rankings created by the signed-in user', async () => {
  const [app, style] = await Promise.all([
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('editorial-clean.css', root), 'utf8'),
  ]);
  const vipArea = app.slice(
    app.indexOf('async function loadVipArea'),
    app.indexOf('function vipGateErrorText'),
  );

  assert.match(vipArea, /filter\(\(ranking\) => ranking\.owned\)/);
  assert.match(vipArea, /Meus rankings privados/);
  assert.match(vipArea, /Somente o criador encontra os rankings nesta área/);
  assert.match(vipArea, /Meu Topo/);
  assert.match(vipArea, /vipCreatePanelHTML\(createOpen\)/);
  assert.match(vipArea, /personalAreaHeaderHTML\('activity'\)/);
  assert.match(vipArea, /personalActivityHTML\(profileData\)/);
  assert.match(vipArea, /loadProfileLeaderboard\(\)/);
  assert.match(vipArea, /loadProfileSuggestionCenter\(\)/);
  assert.match(vipArea, /bindVipCreateForm\(\)/);
  assert.doesNotMatch(vipArea, /Área VIP/);
  assert.doesNotMatch(vipArea, /Rankings VIP do TOPO/);
  assert.match(style, /900 clamp\(42px, 5vw, 62px\)/);
  assert.match(style, /font-size: 43px/);
  assert.match(
    style,
    /\.vipOwnedGrid \.vipCard\s*\{[^}]*grid-template-columns: 96px minmax\(0, 1fr\)/s,
  );
  assert.match(
    style,
    /\.vipOwnedGrid \.vipCardMedia\s*\{[^}]*width: 96px;[^}]*height: 96px;[^}]*min-height: 0/s,
  );
  assert.match(
    style,
    /\.vipOwnedGrid \.vipOwnerActions\s*\{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/s,
  );
});

test('only the creator can manage a private ranking and Meu Topo exposes the complete flow', async () => {
  const [api, app, style, index] = await Promise.all([
    readFile(new URL('api.js', root), 'utf8'),
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('editorial-clean.css', root), 'utf8'),
    readFile(new URL('index.html', root), 'utf8'),
  ]);
  const remove = api.slice(
    api.indexOf('async function deleteUserVipRanking'),
    api.indexOf('async function unlockVipRanking'),
  );
  const compact = compactSource(api);
  const profileRender = app.slice(
    app.indexOf('async function renderProfile'),
    app.indexOf('async function logout'),
  );

  assert.match(remove, /const user = await sessionUser\(req\)/);
  assert.match(remove, /DELETE FROM rankings/);
  assert.match(remove, /vip_owner_user_id = \$2/);
  assert.match(remove, /\[rankingId, user\.id\]/);
  assert.match(compact, /method==='DELETE'/);
  assert.match(compact, /action==='vip-rankings'\)returndeleteUserVipRanking/);
  assert.match(app, /id="vipCreateForm"/);
  assert.match(app, /id="vipCreateTitle"/);
  assert.match(app, /id="vipCreateDescription"/);
  assert.match(app, /vipCoverEditorHTML\('vipCreate'\)/);
  assert.match(app, /bindVipCoverPicker\('vipCreate'\)/);
  assert.match(app, /id="vipCreateOptions"/);
  assert.match(app, /id="rankings-privados"/);
  assert.match(app, /data-copy-vip/);
  assert.match(app, /data-delete-vip/);
  assert.match(app, /id="vipOwnerEditorForm"/);
  assert.match(app, /class="vipOwnerEditorHead"/);
  assert.match(app, /Foto do topo/);
  assert.match(app, /vipRankingCover/);
  assert.match(app, /vipCoverEditorHTML\('vipOwner'/);
  assert.match(app, /bindVipCoverPicker\('vipOwner'/);
  assert.match(app, /method: 'PATCH'/);
  assert.match(app, /method: 'DELETE'/);
  assert.match(app, /window\.confirm/);
  assert.match(style, /\.vipCreatePanel/);
  assert.match(style, /\.vipOwnerActions/);
  assert.match(style, /\.vipHeroActions/);
  assert.match(style, /\.personalHubTabs/);
  assert.match(style, /\.personalActivityDashboard/);
  assert.match(style, /\.vipOwnerEditor/);
  assert.match(style, /\.vipOwnerEditor > \.vipOwnerEditorHead/);
  assert.match(style, /\.vipRankingCover/);
  assert.doesNotMatch(
    profileRender,
    /Meus rankings privados|vipCreatePanelHTML|profileMetrics|profileRecentSection/,
  );
  assert.match(index, /vip-custom-rankings/);
});

test('owners can correct or remove names while preserving every retained option vote', async () => {
  const [api, app] = await Promise.all([
    readFile(new URL('api.js', root), 'utf8'),
    readFile(new URL('app.js', root), 'utf8'),
  ]);
  const update = api.slice(
    api.indexOf('async function updateUserVipRanking'),
    api.indexOf('async function deleteUserVipRanking'),
  );
  const vote = api.slice(api.indexOf('async function vote'), api.indexOf('export default'));
  const compact = compactSource(api);

  assert.match(update, /vip_owner_user_id = \$2/);
  assert.match(update, /AS has_votes/);
  assert.match(update, /submittedRemovedOptionIds/);
  assert.match(update, /jsonb_array_elements_text\(\$9::jsonb\)/);
  assert.match(update, /DELETE FROM ranking_options option/);
  assert.match(update, /option\.id = removed\.id/);
  assert.match(update, /vip_added_later/);
  assert.match(update, /allowed\.has_votes/);
  assert.match(update, /vip_voting_open = \$5/);
  assert.match(update, /INSERT INTO ranking_images/);
  assert.match(update, /DELETE FROM ranking_images/);
  assert.match(update, /removeImage/);
  assert.match(update, /vip_password_version = ranking\.vip_password_version/);
  assert.doesNotMatch(update, /vip_options_locked/);
  assert.doesNotMatch(update, /allowed\.has_votes = false/);
  assert.match(compact, /method==='PATCH'&&action==='vip-rankings'/);
  assert.match(vote, /ranking_voting_closed/);
  assert.match(vote, /option\.isVip !== true && direction !== 0/);
  assert.match(vote, /viewerFor\(user, deviceId, false, option\.isVip === true\)/);
  assert.match(app, /Os novos nomes entram com zero votos/);
  assert.match(app, /Corrigir mantém os votos/);
  assert.match(app, /data-remove-owner-option/);
  assert.match(app, /removedOptionIds/);
  assert.doesNotMatch(app, /travado/);
  assert.match(app, /vipNewOption/);
  assert.match(app, /Votação encerrada/);
});
