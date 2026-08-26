import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compactSource } from './source-helpers.mjs';

const root = new URL('../', import.meta.url);

test('ranking editor has durable image storage and an audit trail', async () => {
  const [migration, script, packageJson] = await Promise.all([
    readFile(new URL('migrations/20260826_ranking_editor.sql', root), 'utf8'),
    readFile(new URL('scripts/apply-ranking-editor.mjs', root), 'utf8'),
    readFile(new URL('package.json', root), 'utf8'),
  ]);

  assert.match(migration, /ADD COLUMN IF NOT EXISTS content_updated_at/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS ranking_images/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS ranking_content_edits/);
  assert.match(migration, /moderator_user_id uuid NOT NULL REFERENCES users\(id\)/);
  assert.match(migration, /UPDATE rankings AS ranking[\s\S]*FROM \(VALUES/);
  assert.match(script, /20260826_ranking_editor\.sql/);
  assert.match(packageJson, /"db:ranking-editor"/);
});

test('ranking content changes require a verified moderator on the server', async () => {
  const api = await readFile(new URL('api.js', root), 'utf8');
  const compact = compactSource(api);
  const editor = api.slice(
    api.indexOf('async function updateRankingContent'),
    api.indexOf('async function moderationQueue'),
  );

  assert.match(editor, /const user = await sessionUser\(req\)/);
  assert.match(editor, /if \(!isModerator\(user\)\)/);
  assert.match(editor, /ranking_options_changed/);
  assert.match(editor, /duplicate_ranking_option/);
  assert.match(editor, /UPDATE ranking_options SET label/);
  assert.doesNotMatch(editor, /DELETE FROM ranking_options/);
  assert.match(editor, /INSERT INTO ranking_content_edits/);
  assert.match(compact, /action==='ranking-content'\)\{returnupdateRankingContent/);
});

test('uploaded ranking photos are validated and served outside the catalog payload', async () => {
  const api = await readFile(new URL('api.js', root), 'utf8');

  assert.match(api, /const RANKING_IMAGE_MAX_BYTES = 1500000/);
  assert.match(api, /function rankingImageUpload\(value\)/);
  assert.ok(api.includes('image\\/(?:jpeg|png|webp)'));
  assert.match(api, /validSignature/);
  assert.match(api, /async function rankingImage\(req, res\)/);
  assert.match(api, /CDN-Cache-Control/);
  assert.match(api, /action === 'ranking-image'/);
});

test('moderators can edit title, photo and every option in place', async () => {
  const [app, style] = await Promise.all([
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('editorial-clean.css', root), 'utf8'),
  ]);
  const compactApp = compactSource(app);
  const compactStyle = compactSource(style);

  assert.match(app, /function beginRankingEdit\(r\)/);
  assert.match(app, /if \(!viewer\.isModerator\) return/);
  assert.match(app, /function rankingEditorHTML\(r, categoryPath\)/);
  assert.match(app, /Escolher foto do aparelho/);
  assert.match(app, /data-ranking-editor-option/);
  assert.match(app, /A posição, os votos e o histórico das opções serão preservados/);
  assert.match(app, /fetch\('\/api\?action=ranking-content'/);
  assert.match(compactApp, /if\(viewer\.isModerator\).*moderatorRankingBarHTML/);
  assert.match(compactStyle, /\.rankingModeratorBar\{/);
  assert.match(compactStyle, /\.rankingEditorSaveBar\{[^}]*position:sticky/);
});

test('SEO modification dates include moderator content updates', async () => {
  const page = await readFile(new URL('page.js', root), 'utf8');
  assert.match(page, /ranking\.content_updated_at/);
  assert.match(page, /COALESCE\(ranking\.content_updated_at, ranking\.created_at\)/);
});
