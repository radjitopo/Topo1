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
assert.match(migration, /duplicate_option_id bigint/, 'duplicate reviews must point to the existing ranking option');
assert.match(migration, /'duplicate'/, 'option suggestions need a distinct already-exists status');
assert.match(migration, /jsonb_array_length\(example_options\) BETWEEN 3 AND 20/, 'approved ranking ideas must support up to 20 reviewed options');
assert.match(migrationScript, /20260823_suggestions\.sql/, 'the suggestion migration must have an application script');

assert.match(api, /const OPTION_SUGGESTION_DAILY_LIMIT = 3;/, 'option suggestions must be limited to three per day');
assert.match(api, /const TOPIC_SUGGESTION_WEEKLY_LIMIT = 1;/, 'ranking ideas must be limited to one per week');
assert.match(api, /TOPO_MODERATOR_EMAILS/, 'moderator access must use an explicit email allowlist');
assert.match(api, /BUILT_IN_MODERATOR_EMAIL_HASHES/, 'the preview moderator must be enabled without exposing the email address');
assert.match(api, /function isModerator\(user\)/, 'moderation routes must verify the signed-in user');
assert.match(api, /async function mySuggestions\(req, res\)/, 'people must be able to retrieve their suggestion history');
assert.match(api, /async function moderationQueue\(req, res\)/, 'moderators need a central queue');
assert.match(api, /async function moderateSuggestion\(req, res, body\)/, 'moderators need an approval route');
assert.match(api, /possibleOptionDuplicate\(label, existingOptionRows\)/, 'similar option names must be flagged for review');
assert.match(api, /decision === 'duplicate'/, 'moderators must be able to mark an option as already existing');
assert.match(api, /duplicate_option_id = existing\.id/, 'already-existing decisions must retain their target option');
assert.match(api, /SET label = \$4,[\s\S]*normalized_label = \$5/, 'moderators must be able to correct an option before approval');
assert.match(api, /async function publishRankingSuggestion\(res, user, body, id, moderationNote\)/, 'approved ideas need a separate publication route');
assert.match(api, /INSERT INTO ranking_options \(ranking_id, label, position, baseline_score\)/, 'approved options must enter the ranking');
assert.match(api, /SELECT ranking_id, \$4, next_position, 0/, 'approved options must start at the bottom with zero points');
assert.match(api, /const PUBLISHED_RANKING_OPTION_LIMIT = 20;/, 'published rankings must support up to 20 reviewed options');
assert.match(api, /INSERT INTO rankings \([\s\S]*FROM ranking_topic_suggestions[\s\S]*status = 'approved'/, 'publication must only create a ranking from an approved idea');
assert.match(api, /status = 'published',[\s\S]*published_ranking_id = \$7/, 'publication must connect the idea to its new ranking');
assert.match(api, /\], \{ isolationLevel: 'Serializable' \}\);/, 'ranking and options must be published in one serializable transaction');
assert.match(api, /new URL\('\/moderacao', moderationOrigin\(req\)\)/, 'email notifications must open the protected panel on the current safe deployment');
assert.match(api, /idempotency-key': `topo-suggestion-/, 'moderation emails must be idempotent');
assert.match(api, /Nenhuma decisão é tomada diretamente pelo e-mail/, 'email scanners must not be able to approve suggestions');

assert.match(app, /function rankingOptionSuggestionHTML\(r\)/, 'each ranking must offer an option suggestion form');
assert.match(app, /function profileSuggestionCenterHTML\(data=/, 'the profile must offer ranking ideas and history');
assert.match(app, /Minhas sugestões/, 'the profile must expose suggestion statuses');
assert.match(app, /Em preparação/, 'approved ranking ideas must show that publication is still pending');
assert.match(app, /function renderModeration\(\)/, 'the private moderation page must render');
assert.match(app, /data-option-label/, 'pending option names must be editable before approval');
assert.match(app, /data-duplicate-target/, 'moderators must choose the existing option for duplicate reviews');
assert.match(app, /Já existe/, 'duplicate decisions must be explained in the interface and profile');
assert.match(app, /Preparar para publicar/, 'approved ideas need a preparation section before publication');
assert.match(app, /data-publish-form/, 'the preparation section must provide an editable publication form');
assert.match(app, /decision:'publish'/, 'the final button must explicitly request publication');
assert.match(app, /Foto carregada\. Confira o corte\./, 'the cover photo must be previewed before publication');
assert.match(app, /portalIdeaCalloutHTML/, 'the home page must invite ranking ideas');
assert.match(app, /fetch\('\/api\?action=suggestions'/, 'forms must use the protected suggestions API');
assert.match(app, /fetch\('\/api\?action=moderation'/, 'the panel must use the protected moderation API');

assert.match(style, /\.rankingSuggestion\{/, 'the ranking suggestion form must be styled');
assert.match(style, /\.profileSuggestionCenter\{/, 'the profile suggestion center must be styled');
assert.match(style, /\.moderationCard\{/, 'moderation cards must be styled');
assert.match(style, /\.moderationDuplicateHint\{/, 'possible duplicate warnings must be styled');
assert.match(style, /\.moderationPrepareForm\{/, 'the publication preparation form must be styled');
assert.match(style, /\.moderationImagePreview\{/, 'the cover preview must be styled');
assert.match(style, /\.moderationHero\{[^}]*display:block;[^}]*height:auto/, 'the moderation hero must not inherit the compact global header layout');

console.log('Suggestion and moderation checks passed.');
