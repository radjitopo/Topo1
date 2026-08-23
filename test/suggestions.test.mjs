import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [api, app, style, migration, migrationScript] = await Promise.all([
  readFile(new URL('../api.js', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../style.css', import.meta.url), 'utf8'),
  readFile(new URL('../migrations/20260823_suggestions.sql', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/apply-suggestions.mjs', import.meta.url), 'utf8')
]);

assert.match(migration, /CREATE TABLE IF NOT EXISTS ranking_option_suggestions/, 'option suggestions need a durable table');
assert.match(migration, /CREATE TABLE IF NOT EXISTS ranking_topic_suggestions/, 'ranking ideas need a durable table');
assert.match(migration, /WHERE status = 'pending'/, 'duplicate pending suggestions must be prevented');
assert.match(migration, /jsonb_array_length\(example_options\) BETWEEN 3 AND 10/, 'ranking ideas must include 3 to 10 starter options');
assert.match(migrationScript, /20260823_suggestions\.sql/, 'the suggestion migration must have an application script');

assert.match(api, /const OPTION_SUGGESTION_DAILY_LIMIT = 3;/, 'option suggestions must be limited to three per day');
assert.match(api, /const TOPIC_SUGGESTION_WEEKLY_LIMIT = 1;/, 'ranking ideas must be limited to one per week');
assert.match(api, /TOPO_MODERATOR_EMAILS/, 'moderator access must use an explicit email allowlist');
assert.match(api, /function isModerator\(user\)/, 'moderation routes must verify the signed-in user');
assert.match(api, /async function mySuggestions\(req, res\)/, 'people must be able to retrieve their suggestion history');
assert.match(api, /async function moderationQueue\(req, res\)/, 'moderators need a central queue');
assert.match(api, /async function moderateSuggestion\(req, res, body\)/, 'moderators need an approval route');
assert.match(api, /INSERT INTO ranking_options \(ranking_id, label, position, baseline_score\)/, 'approved options must enter the ranking');
assert.match(api, /SELECT ranking_id, label, next_position, 0/, 'approved options must start at the bottom with zero points');
assert.match(api, /new URL\('\/moderacao', moderationOrigin\(req\)\)/, 'email notifications must open the protected panel on the current safe deployment');
assert.match(api, /idempotency-key': `topo-suggestion-/, 'moderation emails must be idempotent');
assert.match(api, /Nenhuma decisão é tomada diretamente pelo e-mail/, 'email scanners must not be able to approve suggestions');

assert.match(app, /function rankingOptionSuggestionHTML\(r\)/, 'each ranking must offer an option suggestion form');
assert.match(app, /function profileSuggestionCenterHTML\(data=/, 'the profile must offer ranking ideas and history');
assert.match(app, /Minhas sugestões/, 'the profile must expose suggestion statuses');
assert.match(app, /function renderModeration\(\)/, 'the private moderation page must render');
assert.match(app, /portalIdeaCalloutHTML/, 'the home page must invite ranking ideas');
assert.match(app, /fetch\('\/api\?action=suggestions'/, 'forms must use the protected suggestions API');
assert.match(app, /fetch\('\/api\?action=moderation'/, 'the panel must use the protected moderation API');

assert.match(style, /\.rankingSuggestion\{/, 'the ranking suggestion form must be styled');
assert.match(style, /\.profileSuggestionCenter\{/, 'the profile suggestion center must be styled');
assert.match(style, /\.moderationCard\{/, 'moderation cards must be styled');

console.log('Suggestion and moderation checks passed.');
