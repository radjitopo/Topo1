import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compactSource } from './source-helpers.mjs';

const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const style = await readFile(new URL('../style.css', import.meta.url), 'utf8');
const compactApp = compactSource(app);
const compactStyle = compactSource(style);

assert.match(compactApp, /functionnextRankingFor\(r\)/, 'ranking pages must choose a next ranking');
assert.match(
  compactApp,
  /unvoted=available\.filter\(\(candidate\)=>myVoteCount\(candidate\)===0\)/,
  'next ranking must prefer rankings without a vote',
);
assert.match(
  compactApp,
  /sameCategory=pool\.filter\(\(candidate\)=>candidate\.cat===r\.cat\)/,
  'next ranking must prefer the same category',
);
assert.match(
  compactApp,
  /functionrandomRankingFor\(r\)/,
  'ranking pages must offer a random ranking',
);
assert.match(
  compactApp,
  /\$\{rankingContinuationHTML\(r\)\}\$\{commentsShellHTML\(\)\}/,
  'continuation must appear immediately after the ranking and before comments',
);
assert.match(compactApp, /Rankingsrelacionados/, 'continuation must keep related rankings visible');
assert.match(
  compactApp,
  /data-ranking-image/,
  'ranking images must opt in to a graceful error fallback',
);
assert.match(
  compactApp,
  /replaceBrokenRankingImage/,
  'broken ranking images must be replaced without exposing browser error text',
);

assert.match(
  compactStyle,
  /\.portalHeroCopy\{[^}]*width:min\(72%,500px\)[^}]*padding:14px18px15px/,
  'desktop hero strip must be compact',
);
assert.match(
  compactStyle,
  /\.portalHeroCopyh1\{font:900clamp\(26px,2\.4vw,38px\)/,
  'hero title must be smaller',
);
assert.match(compactStyle, /\.rankingContinuation\{/, 'ranking continuation must be styled');
assert.match(compactStyle, /\.rankingFlowActions\{/, 'next and random actions must be styled');

console.log('Engagement flow checks passed.');
