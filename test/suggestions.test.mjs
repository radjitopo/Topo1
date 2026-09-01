import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compactSource } from './source-helpers.mjs';

const [api, app, style, migration, migrationScript] = await Promise.all([
  readFile(new URL('../api.js', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../style.css', import.meta.url), 'utf8'),
  readFile(new URL('../migrations/20260823_suggestions.sql', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/apply-suggestions.mjs', import.meta.url), 'utf8'),
]);
const compactApi = compactSource(api);
const compactApp = compactSource(app);
const compactStyle = compactSource(style);

assert.match(
  migration,
  /CREATE TABLE IF NOT EXISTS ranking_option_suggestions/,
  'option suggestions need a durable table',
);
assert.match(
  migration,
  /CREATE TABLE IF NOT EXISTS ranking_topic_suggestions/,
  'ranking ideas need a durable table',
);
assert.match(
  migration,
  /WHERE status = 'pending'/,
  'duplicate pending suggestions must be prevented',
);
assert.match(
  migration,
  /duplicate_option_id bigint/,
  'duplicate reviews must point to the existing ranking option',
);
assert.match(migration, /'duplicate'/, 'option suggestions need a distinct already-exists status');
assert.match(
  migration,
  /jsonb_array_length\(example_options\) BETWEEN 3 AND 20/,
  'approved ranking ideas must support up to 20 reviewed options',
);
assert.match(
  migrationScript,
  /20260823_suggestions\.sql/,
  'the suggestion migration must have an application script',
);

assert.match(
  api,
  /const OPTION_SUGGESTION_DAILY_LIMIT = 3;/,
  'option suggestions must be limited to three per day',
);
assert.match(
  api,
  /!isModerator\(user\)[\s\S]*OPTION_SUGGESTION_DAILY_LIMIT/,
  'moderators must be exempt from the option suggestion limit during testing',
);
assert.match(
  api,
  /const TOPIC_SUGGESTION_WEEKLY_LIMIT = 1;/,
  'ranking ideas must be limited to one per week',
);
assert.match(
  api,
  /const PENDING_RANKING_CATEGORY = 'A definir';/,
  'people must not choose a category while suggesting a ranking',
);
assert.match(
  api,
  /const category = PENDING_RANKING_CATEGORY;/,
  'the server must assign ranking preparation to the editorial team',
);
assert.match(
  api,
  /const exampleOptions = \[\.\.\.PENDING_RANKING_EXAMPLES\];/,
  'the server must ignore user-supplied ranking options',
);
assert.match(api, /TOPO_MODERATOR_EMAILS/, 'moderator access must use an explicit email allowlist');
assert.match(
  api,
  /BUILT_IN_MODERATOR_EMAIL_HASHES/,
  'the preview moderator must be enabled without exposing the email address',
);
assert.match(
  api,
  /function isModerator\(user\)/,
  'moderation routes must verify the signed-in user',
);
assert.match(
  api,
  /async function mySuggestions\(req, res\)/,
  'people must be able to retrieve their suggestion history',
);
assert.match(api, /async function moderationQueue\(req, res\)/, 'moderators need a central queue');
assert.match(
  api,
  /async function moderateSuggestion\(req, res, body\)/,
  'moderators need an approval route',
);
assert.match(
  api,
  /possibleOptionDuplicate\(label, existingOptionRows\)/,
  'similar option names must be flagged for review',
);
assert.match(
  api,
  /decision === 'duplicate'/,
  'moderators must be able to mark an option as already existing',
);
assert.match(
  api,
  /duplicate_option_id = existing\.id/,
  'already-existing decisions must retain their target option',
);
assert.match(
  api,
  /SET label = \$4,[\s\S]*normalized_label = \$5/,
  'moderators must be able to correct an option before approval',
);
assert.match(
  api,
  /async function publishRankingSuggestion\(res, user, body, id, moderationNote\)/,
  'approved ideas need a separate publication route',
);
assert.match(
  api,
  /INSERT INTO ranking_options \(ranking_id, label, position, baseline_score\)/,
  'approved options must enter the ranking',
);
assert.match(
  api,
  /SELECT ranking_id, \$4, next_position, 0/,
  'approved options must start at the bottom with zero points',
);
assert.match(
  api,
  /const PUBLISHED_RANKING_OPTION_LIMIT = 20;/,
  'published rankings must support up to 20 reviewed options',
);
assert.match(
  compactApi,
  /constapprovedRankingTitle=kind==='ranking'&&decision==='approve'/,
  'ranking approval must receive the final title',
);
assert.match(
  compactApi,
  /constapprovedRankingCategory=kind==='ranking'&&decision==='approve'/,
  'ranking approval must receive the editorial category',
);
assert.match(
  api,
  /SET title = \$3,[\s\S]*normalized_title = \$4,[\s\S]*category = \$5,[\s\S]*status = 'approved'/,
  'manual approval must save title and category together',
);
assert.doesNotMatch(
  api,
  /decision === 'generate'/,
  'manual mode must not expose an unavailable AI generation action',
);
assert.match(
  api,
  /INSERT INTO rankings \([\s\S]*FROM ranking_topic_suggestions[\s\S]*status = 'approved'/,
  'publication must only create a ranking from an approved idea',
);
assert.match(
  api,
  /status = 'published',[\s\S]*published_ranking_id = \$7/,
  'publication must connect the idea to its new ranking',
);
assert.match(
  compactApi,
  /\],\{isolationLevel:'Serializable',?\},?\);/,
  'ranking and options must be published in one serializable transaction',
);
assert.match(
  api,
  /new URL\('\/moderacao', moderationOrigin\(req\)\)/,
  'email notifications must open the protected panel on the current safe deployment',
);
assert.match(api, /idempotency-key': `topo-suggestion-/, 'moderation emails must be idempotent');
assert.match(
  api,
  /Nenhuma decisão é tomada diretamente pelo e-mail/,
  'email scanners must not be able to approve suggestions',
);

assert.match(
  app,
  /function rankingOptionSuggestionHTML\(r\)/,
  'each ranking must offer an option suggestion form',
);
assert.match(
  app,
  /Sugestões ilimitadas durante o teste\./,
  'moderators must see that their test suggestions are unlimited',
);
assert.match(
  compactApp,
  /functionprofileSuggestionCenterHTML\(data=/,
  'the profile must offer ranking ideas and history',
);
const rankingForm = app.slice(
  app.indexOf('function profileSuggestionCenterHTML'),
  app.indexOf('function bindProfileSuggestionForm'),
);
assert.doesNotMatch(rankingForm, /name="category"/, 'people must not choose the ranking category');
assert.doesNotMatch(rankingForm, /name="options"/, 'people must not create the ranking options');
assert.match(
  rankingForm,
  /O restante fica por nossa conta/,
  'the form must explain the editorial workflow',
);
assert.match(
  compactApp,
  /JSON\.stringify\(\{kind:'ranking',title:/,
  'ranking suggestions must send only the title',
);
assert.match(app, /Minhas sugestões/, 'the profile must expose suggestion statuses');
assert.match(
  app,
  /Em preparação/,
  'approved ranking ideas must show that publication is still pending',
);
assert.match(app, /function renderModeration\(\)/, 'the private moderation page must render');
assert.match(app, /data-option-label/, 'pending option names must be editable before approval');
assert.match(
  app,
  /data-duplicate-target/,
  'moderators must choose the existing option for duplicate reviews',
);
assert.match(
  app,
  /Já existe/,
  'duplicate decisions must be explained in the interface and profile',
);
assert.match(
  app,
  /function moderationRankingReviewHTML\(item\)/,
  'ranking ideas must expose a focused editorial approval form',
);
assert.match(
  app,
  /data-ranking-title/,
  'moderators must be able to adjust the final ranking title',
);
assert.match(
  app,
  /data-ranking-category/,
  'moderators must choose the ranking category before approval',
);
assert.match(app, /Aprovar nome e categoria/, 'the approval action must describe its exact scope');
assert.match(app, /Prontos para criação/, 'approved ideas must enter the manual creation queue');
assert.match(
  app,
  /Você não precisa montar nem revisar a lista/,
  'the queue must explain that the team handles the remaining work',
);
const moderationRender = app.slice(
  app.indexOf('async function renderModeration'),
  app.indexOf('async function boot'),
);
assert.doesNotMatch(
  moderationRender,
  /bindModerationDrafts|bindModerationPublishForms/,
  'opening moderation must not trigger unavailable automatic generation',
);
assert.match(app, /portalIdeaCalloutHTML/, 'the home page must invite ranking ideas');
assert.match(
  app,
  /fetch\('\/api\?action=suggestions'/,
  'forms must use the protected suggestions API',
);
assert.match(
  app,
  /fetch\('\/api\?action=moderation'/,
  'the panel must use the protected moderation API',
);

assert.match(compactStyle, /\.rankingSuggestion\{/, 'the ranking suggestion form must be styled');
assert.match(
  compactStyle,
  /\.profileSuggestionCenter\{/,
  'the profile suggestion center must be styled',
);
assert.match(compactStyle, /\.moderationCard\{/, 'moderation cards must be styled');
assert.match(
  compactStyle,
  /\.moderationDuplicateHint\{/,
  'possible duplicate warnings must be styled',
);
assert.match(
  compactStyle,
  /\.moderationRankingReview\{/,
  'manual title and category review must be styled',
);
assert.match(
  compactStyle,
  /\.moderationCreationReady\{/,
  'the manual creation queue state must be styled',
);
assert.match(
  compactStyle,
  /\.moderationHero\{[^}]*display:block;[^}]*height:auto/,
  'the moderation hero must not inherit the compact global header layout',
);

console.log('Suggestion and moderation checks passed.');
