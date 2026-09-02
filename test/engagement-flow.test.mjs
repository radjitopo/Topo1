import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compactSource } from './source-helpers.mjs';

const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const api = await readFile(new URL('../api.js', import.meta.url), 'utf8');
const style = await readFile(new URL('../style.css', import.meta.url), 'utf8');
const editorialStyle = await readFile(new URL('../editorial-clean.css', import.meta.url), 'utf8');
const compactApp = compactSource(app);
const compactApi = compactSource(api);
const compactStyle = compactSource(style);
const compactEditorialStyle = compactSource(editorialStyle);

assert.match(compactApp, /functionnextRankingFor\(r\)/, 'ranking pages must choose a next ranking');
assert.match(
  compactApp,
  /functionrankingNeedsParticipation\(r\)\{returnmyVoteCount\(r\)===0&&r\?\.duelCompleted!==true;/,
  'continuation must exclude both voted rankings and completed duels',
);
assert.match(
  compactApp,
  /laterInCurrentGroup=currentGroupRankings\.slice\(currentIndex\+1\)\.filter\(eligible\)/,
  'next ranking must continue forward inside the current category',
);
assert.match(
  compactApp,
  /functionrandomRankingFor\(r\)/,
  'ranking pages must offer a random ranking',
);
assert.match(
  compactApp,
  /functionrandomRankingFor\(r\)\{[^}]*!isClubPlayerRanking\(candidate\)/,
  'the random ranking action must always exclude club-player rankings',
);
assert.match(
  compactApp,
  /eligible=\(candidate\)=>candidate\.id!==r\.id&&!isClubPlayerRanking\(candidate\)&&rankingNeedsParticipation\(candidate\)/,
  'the next ranking action must always exclude club-player rankings',
);
assert.match(
  compactApi,
  /COALESCE\(mds\.completed,false\)ASduel_completed/,
  'the catalog must tell the client which duels this viewer completed',
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
  compactApp,
  /DEFAULT_ANONYMOUS_LIMIT=10/,
  'signed-out visitors must receive ten free votes in the client',
);
assert.match(
  compactApi,
  /ANONYMOUS_LIMIT=10/,
  'the API must enforce the same ten-vote registration threshold',
);
assert.match(
  compactApp,
  /\$\{viewer\.anonymousLimit\|\|DEFAULT_ANONYMOUS_LIMIT\}votosusados/,
  'the registration prompt must always show the configured anonymous limit',
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
assert.match(
  compactEditorialStyle,
  /body\.popElectric\.rankingPage\.rank\.rankingMain\{margin:0;/,
  'the ranking and its continuation must not be split by empty space',
);
assert.match(
  compactEditorialStyle,
  /body\.popElectric\.rankingPage\.rankFoot\{[^}]*border-bottom:0;[^}]*padding:0;/,
  'the free-vote footer must not add a decorative divider',
);
assert.match(
  compactEditorialStyle,
  /body\.popElectric\.rankingPage\.rankingSuggestion\{[^}]*border-top:0;[^}]*padding:0;/,
  'the suggestion form must follow the results without another divider',
);
assert.match(
  compactEditorialStyle,
  /body\.popElectric\.rankingPage\.rankingContinuation\{[^}]*border:0;[^}]*padding:0;/,
  'related rankings must join the suggestion area without a thick divider',
);

console.log('Engagement flow checks passed.');
