import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const style = await readFile(new URL('../style.css', import.meta.url), 'utf8');

assert.match(app, /function nextRankingFor\(r\)/, 'ranking pages must choose a next ranking');
assert.match(app, /unvoted=available\.filter\(candidate=>myVoteCount\(candidate\)===0\)/, 'next ranking must prefer rankings without a vote');
assert.match(app, /sameCategory=pool\.filter\(candidate=>candidate\.cat===r\.cat\)/, 'next ranking must prefer the same category');
assert.match(app, /function randomRankingFor\(r\)/, 'ranking pages must offer a random ranking');
assert.match(app, /\$\{rankingContinuationHTML\(r\)\}\$\{commentsShellHTML\(\)\}/, 'continuation must appear immediately after the ranking and before comments');
assert.match(app, /Rankings relacionados/, 'continuation must keep related rankings visible');
assert.match(app, /data-ranking-image/, 'ranking images must opt in to a graceful error fallback');
assert.match(app, /replaceBrokenRankingImage/, 'broken ranking images must be replaced without exposing browser error text');

assert.match(style, /\.portalHeroCopy\{[^}]*width:min\(72%,500px\)[^}]*padding:14px 18px 15px/, 'desktop hero strip must be compact');
assert.match(style, /\.portalHeroCopy h1\{font:900 clamp\(26px,2\.4vw,38px\)/, 'hero title must be smaller');
assert.match(style, /\.rankingContinuation\{/, 'ranking continuation must be styled');
assert.match(style, /\.rankingFlowActions\{/, 'next and random actions must be styled');

console.log('Engagement flow checks passed.');
