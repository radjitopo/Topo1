import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [api, app, style] = await Promise.all([
  readFile(new URL('../api.js', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../style.css', import.meta.url), 'utf8')
]);

assert.match(api, /const RANKING_LIMIT = 20;/, 'the API must allow all 20 standard options to be evaluated');
assert.match(app, /rankingLimit:20/, 'the interface fallback must match the API limit');
assert.match(app, /function previewVoteActionsHTML\(r,o,wrapperClass=/, 'ranking previews must render vote arrows');
assert.match(app, /data-preview-ranking=/, 'preview arrows must retain the ranking destination');
assert.match(app, /function previewReact\(b\)/, 'preview arrows must have a dedicated open-and-highlight flow');
const previewFlow = app.match(/function previewReact\(b\)\{([\s\S]*?)\}\nasync function react/);
assert.ok(previewFlow, 'the preview navigation flow must be identifiable');
assert.doesNotMatch(previewFlow[1], /fetch\(/, 'preview arrows must not send a vote');
assert.match(previewFlow[1], /openPreviewRanking\(rankingId,optionId,direction,label\)/, 'preview arrows must open the full ranking with the selected option');
assert.match(app, /topo_preview_vote_intent/, 'the intended option and direction must survive navigation');
assert.match(app, /previewVotePrompt/, 'the ranking must explain that the vote still needs confirmation');
assert.match(app, /data-option-id=/, 'the selected option must be addressable for highlighting');
assert.match(app, /Ver ranking completo — \$\{total\} opções/, 'the first ten must offer the complete ranking');
assert.match(app, /const visibleLimit=allItemsOpen\?r\.opts\.length:Math\.min\(10,r\.opts\.length\)/, 'the full view must not impose a display-only cap');
assert.match(app, /function rankingEvaluationProgressHTML\(r\)/, 'the ranking must show progress through its options');

assert.match(style, /\.categoryVoteOption\{[^}]*grid-template-columns:20px minmax\(0,1fr\) auto/, 'category cards must leave room for quick-vote arrows');
assert.match(style, /\.rankingEvaluationProgress\{/, 'evaluation progress must be styled');

console.log('Ranking voting flow passed: 20 evaluations, preview intent and complete list.');
