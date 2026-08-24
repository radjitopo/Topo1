import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compactSource, extractTopLevelDeclaration } from './source-helpers.mjs';

const [api, app, style] = await Promise.all([
  readFile(new URL('../api.js', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../style.css', import.meta.url), 'utf8'),
]);
const compactApp = compactSource(app);
const compactStyle = compactSource(style);

assert.match(
  api,
  /const RANKING_LIMIT = 20;/,
  'the API must allow all 20 standard options to be evaluated',
);
assert.match(compactApp, /rankingLimit:20/, 'the interface fallback must match the API limit');
assert.match(
  compactApp,
  /functionpreviewVoteActionsHTML\(r,o,wrapperClass=/,
  'ranking previews must render vote arrows',
);
assert.match(
  compactApp,
  /data-preview-ranking=/,
  'preview arrows must retain the ranking destination',
);
assert.match(
  compactApp,
  /functionpreviewReact\(b\)/,
  'preview arrows must have a dedicated open-and-highlight flow',
);
const previewFlow = extractTopLevelDeclaration(app, 'previewReact');
assert.ok(previewFlow, 'the preview navigation flow must be identifiable');
assert.doesNotMatch(previewFlow, /fetch\(/, 'preview arrows must not send a vote');
assert.match(
  compactSource(previewFlow),
  /openPreviewRanking\(rankingId,optionId,direction,label\)/,
  'preview arrows must open the full ranking with the selected option',
);
assert.match(
  compactApp,
  /topo_preview_vote_intent/,
  'the intended option and direction must survive navigation',
);
assert.match(
  compactApp,
  /previewVotePrompt/,
  'the ranking must explain that the vote still needs confirmation',
);
assert.match(
  compactApp,
  /data-option-id=/,
  'the selected option must be addressable for highlighting',
);
assert.match(
  compactApp,
  /Verrankingcompleto—\$\{total\}opções/,
  'the first ten must offer the complete ranking',
);
assert.match(
  compactApp,
  /constvisibleLimit=allItemsOpen\?r\.opts\.length:Math\.min\(10,r\.opts\.length\)/,
  'the full view must not impose a display-only cap',
);
assert.match(
  compactApp,
  /functionrankingEvaluationProgressHTML\(r\)/,
  'the ranking must show progress through its options',
);

assert.match(
  compactStyle,
  /\.categoryVoteOption\{[^}]*grid-template-columns:20pxminmax\(0,1fr\)auto/,
  'category cards must leave room for quick-vote arrows',
);
assert.match(compactStyle, /\.rankingEvaluationProgress\{/, 'evaluation progress must be styled');

console.log('Ranking voting flow passed: 20 evaluations, preview intent and complete list.');
