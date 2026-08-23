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
assert.match(app, /function previewReact\(b\)/, 'preview arrows must have a dedicated vote-and-open flow');
assert.match(app, /weight:1/, 'preview voting must never activate a double vote by accident');
assert.match(app, /openPreviewRanking\(rankingId/, 'a successful preview vote must open the full ranking');
assert.match(app, /Ver ranking completo — \$\{total\} opções/, 'the first ten must offer the complete ranking');
assert.match(app, /const visibleLimit=allItemsOpen\?r\.opts\.length:Math\.min\(10,r\.opts\.length\)/, 'the full view must not impose a display-only cap');
assert.match(app, /function rankingEvaluationProgressHTML\(r\)/, 'the ranking must show progress through its options');

assert.match(style, /\.categoryVoteOption\{[^}]*grid-template-columns:20px minmax\(0,1fr\) auto/, 'category cards must leave room for quick-vote arrows');
assert.match(style, /\.rankingEvaluationProgress\{/, 'evaluation progress must be styled');

console.log('Ranking voting flow passed: 20 evaluations, preview voting and complete list.');
