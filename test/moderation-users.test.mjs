import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compactSource, extractTopLevelDeclaration } from './source-helpers.mjs';

const [api, app, css, index] = await Promise.all([
  readFile(new URL('../api.js', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../editorial-clean.css', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
]);

const moderationUsers = extractTopLevelDeclaration(api, 'moderationUsers');
const compactApi = compactSource(api);
const compactApp = compactSource(app);
const compactCss = compactSource(css);

assert.match(moderationUsers, /authentication_required/);
assert.match(moderationUsers, /if \(!isModerator\(moderator\)\)/);
assert.match(moderationUsers, /FROM users u/);
assert.match(moderationUsers, /LEFT JOIN user_vote_history/);
assert.match(moderationUsers, /COUNT\(DISTINCT option\.ranking_id\)/);
assert.doesNotMatch(moderationUsers, /password_hash/);
assert.match(compactApi, /action==='moderation-users'\)returnmoderationUsers\(req,res\)/);

assert.match(app, /Usuários cadastrados/);
assert.match(app, /Buscar por nome ou e-mail/);
assert.match(app, /function bindModerationUserSearch\(\)/);
assert.match(compactApp, /activeTab==='users'\?'moderation-users':'moderation'/);
assert.match(compactApp, /queryParams\.get\('aba'\)==='usuarios'/);

assert.match(compactCss, /\.moderationPanelTabs/);
assert.match(compactCss, /\.moderationUserRow/);
assert.match(compactCss, /\.moderationUserRow\[hidden\]\{display:none/);
assert.match(index, /20260827-1-vip-area-moderation-users/);

console.log('Moderation users test passed: private list, search and responsive UI are wired.');
