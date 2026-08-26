import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { compactSource, extractTopLevelDeclaration } from './source-helpers.mjs';

const [api, app, style, editorial, page] = await Promise.all([
  readFile(new URL('../api.js', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../style.css', import.meta.url), 'utf8'),
  readFile(new URL('../editorial-clean.css', import.meta.url), 'utf8'),
  readFile(new URL('../page.js', import.meta.url), 'utf8'),
]);
const compactApp = compactSource(app);
const compactStyle = compactSource(style);
const compactEditorial = compactSource(editorial);
const compactPage = compactSource(page);

assert.match(
  api,
  /const RANKING_LIMIT = 20;/,
  'the API must allow all 20 standard options to be evaluated',
);
assert.match(compactApp, /rankingLimit:20/, 'the interface fallback must match the API limit');
assert.match(
  compactApp,
  /functioncategoryVoteActionsHTML\(o\)/,
  'ranking previews must render their own vote controls',
);
assert.match(
  compactApp,
  /class="reactup[^>]*data-mine=/,
  'preview arrows must use the same direct-vote state as full rankings',
);
assert.match(
  compactApp,
  /aria-pressed="\$\{upSelected\}"/,
  'preview arrows must expose their selected state to assistive technology',
);
const voteList = extractTopLevelDeclaration(app, 'categoryVoteListHTML');
assert.ok(voteList, 'the three-item voting preview must remain testable');
assert.match(
  compactSource(voteList),
  /\(r\.opts\|\|\[\]\)\.slice\(0,3\)/,
  'each discovery card must expose exactly the first three ranking items',
);
assert.doesNotMatch(
  compactApp,
  /previewVoteIntent|topo_preview_vote_intent|data-preview-ranking/,
  'card votes must no longer be deferred through a navigation intent',
);

const bindVotes = extractTopLevelDeclaration(app, 'bindVotes');
assert.ok(bindVotes, 'vote binding must remain testable');
assert.match(
  compactSource(bindVotes),
  /querySelectorAll\('\.react'\).*react\(b\)/,
  'every preview arrow must submit through the direct vote flow',
);

const reactFlow = extractTopLevelDeclaration(app, 'react');
assert.ok(reactFlow, 'the direct vote toggle must remain testable');
assert.match(
  compactSource(reactFlow),
  /direction=mine===clicked\?0:clicked/,
  'tapping a selected arrow again must remove that vote',
);
const voteContext = vm.createContext({ Number });
vm.runInContext(
  `
function submitVoteChange(button, payload) { globalThis.lastVote = payload; }
${reactFlow}
globalThis.voteFromCard = react;
`,
  voteContext,
);
voteContext.voteFromCard({ dataset: { id: '42', mine: '0', dir: '1' } });
assert.deepEqual(
  { ...voteContext.lastVote },
  { optionId: 42, direction: 1, weight: 1, showHelp: true },
  'an unselected up arrow must submit a positive vote immediately',
);
voteContext.voteFromCard({ dataset: { id: '42', mine: '1', dir: '1' } });
assert.equal(voteContext.lastVote.direction, 0, 'a selected arrow must submit vote removal');

const previewRefresh = extractTopLevelDeclaration(app, 'updateRankingPreviewCards');
assert.ok(previewRefresh, 'targeted preview updates must remain testable');
assert.match(
  compactSource(previewRefresh),
  /card\.replaceWith\(template\.content\.firstElementChild\)/,
  'a successful vote must refresh only its ranking card',
);

const resultFlow = extractTopLevelDeclaration(app, 'applyVoteResult');
assert.ok(resultFlow, 'vote result handling must remain testable');
assert.match(
  compactSource(resultFlow),
  /elseif\(!updateRankingPreviewCards\(ranking\)\)renderHome\(\)/,
  'category cards must stay in place after voting instead of re-sorting the full page',
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
assert.doesNotMatch(
  compactApp,
  /rankingEvaluationProgress/,
  'the ranking must not pressure people with completion progress',
);

assert.match(
  compactEditorial,
  /body\.popElectric\.categoryVoteOption\{[^}]*grid-template-columns:24pxminmax\(0,1fr\)auto/,
  'category cards must leave balanced room for direct-vote arrows',
);
assert.match(
  compactEditorial,
  /body\.popElectric\.categoryRankCard\.react\.up\{[^}]*color:var\(--clean-sage\)/,
  'up votes in previews must use the muted sage color',
);
assert.match(
  compactEditorial,
  /body\.popElectric\.categoryRankCard\.react\.down\{[^}]*color:var\(--clean-muted-red\)/,
  'down votes in previews must use the muted red color',
);
assert.doesNotMatch(
  compactStyle,
  /\.rankingEvaluationProgress\{/,
  'the removed evaluation progress must not leave stale styles',
);

assert.match(
  compactPage,
  /\(ranking\.options\|\|\[\]\)\.slice\(0,3\)/,
  'server-rendered discovery cards must include the same three-item preview',
);
assert.match(
  compactPage,
  /\$\{whatsAppShare\(ranking\)\}/,
  'server-rendered discovery cards must preserve WhatsApp sharing',
);

console.log('Ranking voting flow passed: direct card votes, stable previews and complete lists.');
