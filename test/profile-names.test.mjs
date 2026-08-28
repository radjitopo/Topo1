import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compactSource } from './source-helpers.mjs';
import {
  defaultDisplayName,
  displayNameChangeState,
  validateDisplayName,
} from '../profile-names.js';

test('profile names accept normal public names and preserve accents', () => {
  assert.deepEqual(validateDisplayName('  João  da Silva  '), { value: 'João da Silva' });
  assert.deepEqual(validateDisplayName("D'Ávila"), { value: "D'Ávila" });
  assert.deepEqual(validateDisplayName('Ana-Maria'), { value: 'Ana-Maria' });
});

test('profile names reject unsafe, reserved and offensive identities', () => {
  for (const value of [
    'TOPO Oficial',
    'admin123',
    'www.exemplo.com',
    'nome@email.com',
    'c4r4lh0',
    'filha da puta',
    '<script>',
    'A',
    'a'.repeat(25),
  ]) {
    assert.ok(validateDisplayName(value).error, `${value} should be rejected`);
  }
  assert.equal(validateDisplayName('Nome Bloqueado', 'bloqueado').error, 'offensive');
});

test('new accounts receive a neutral name instead of an e-mail prefix', () => {
  assert.equal(defaultDisplayName('1234abcd-0000-0000-0000-000000000000'), 'Pessoa do TOPO 1234');
});

test('the first name change is immediate and later changes wait 30 days', () => {
  assert.deepEqual(displayNameChangeState(null), { canChange: true, availableAt: null });
  const changedAt = '2026-08-01T12:00:00.000Z';
  assert.deepEqual(displayNameChangeState(changedAt, new Date('2026-08-15T12:00:00.000Z')), {
    canChange: false,
    availableAt: '2026-08-31T12:00:00.000Z',
  });
  assert.equal(
    displayNameChangeState(changedAt, new Date('2026-09-01T12:00:00.000Z')).canChange,
    true,
  );
});

test('profile name API, reporting and moderation stay wired', async () => {
  const [api, app, migration] = await Promise.all([
    readFile(new URL('../api.js', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../migrations/20260824_profile_names.sql', import.meta.url), 'utf8'),
  ]);

  assert.match(api, /display_name_updated_at/);
  assert.match(api, /display_name_cooldown/);
  assert.match(api, /async function createNameReport/);
  assert.match(api, /user_name_reports/);
  assert.match(app, /Escolha seu nome no TOPO/);
  const profileRender = app.slice(
      app.indexOf('async function renderProfile'),
      app.indexOf('async function logout'),
    ),
    compactProfileRender = compactSource(profileRender);
  assert.match(
    compactProfileRender,
    /profileGameHero[\s\S]*profileHeroIntro[\s\S]*profileMetrics[\s\S]*<\/section><divclass="profileDashboard"/,
    'profile participation should follow the compact identity header without duplicating Meu Topo',
  );
  assert.match(profileRender, /href="#perfil-publico">Editar perfil/);
  assert.match(profileRender, /profileSettingsGrid">\$\{profileNameEditorHTML\(p\.user\)\}/);
  assert.doesNotMatch(profileRender, /Meus rankings privados|vipCreatePanelHTML/);
  assert.doesNotMatch(profileRender, /profileBadges|profileProgressText|profileEmail/);
  assert.match(app, /data-report-name/);
  assert.match(migration, /user_name_reports_pending_unique_idx/);
});
