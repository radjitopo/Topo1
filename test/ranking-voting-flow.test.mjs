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
  'the API must cover all twenty options in the largest public rankings',
);
assert.match(compactApp, /rankingLimit:20/, 'the interface fallback must match the API limit');
assert.match(
  compactApp,
  /functioncategoryVoteActionsHTML\(r,o\)/,
  'ranking previews must render their own navigation controls',
);
assert.match(
  compactApp,
  /categoryPreviewReact"href="\$\{path\}"/,
  'preview arrows must link to the ranking voting area',
);
assert.match(
  compactApp,
  /Abrirorankingpara\$\{upSelected\?'alterarovotoem':`fazer\$\{label\}subir`\}/,
  'preview arrows must explain that voting happens inside the ranking',
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
  'preview navigation must work with ordinary links instead of deferred JavaScript state',
);

const bindVotes = extractTopLevelDeclaration(app, 'bindVotes');
assert.ok(bindVotes, 'vote binding must remain testable');
assert.match(
  compactSource(bindVotes),
  /querySelectorAll\('button\.react'\).*react\(b\)/,
  'only buttons inside a ranking may submit votes',
);
assert.doesNotMatch(
  compactSource(bindVotes),
  /querySelectorAll\('\.react'\)/,
  'preview links must never be intercepted by the direct vote binding',
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
  'an unselected arrow inside the ranking must submit a positive vote immediately',
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
assert.match(compactApp, /Vermais\$\{next\}/, 'the first ten must offer the next batch');
assert.match(
  compactApp,
  /visibleOptionCount=Math\.min\(r\.opts\.length,visibleOptionCount\+10\)/,
  'each plus click must open at most ten more options',
);
assert.match(
  compactApp,
  /constvisibleLimit=Math\.min\(visibleOptionCount,r\.opts\.length\)/,
  'the full view must support any ranking length',
);
assert.doesNotMatch(
  compactApp,
  /rankingEvaluationProgress/,
  'the ranking must not pressure people with completion progress',
);

const promotionLauncher = extractTopLevelDeclaration(app, 'rankingOptionPromotionHTML');
assert.ok(promotionLauncher, 'the automatic option promotion launcher must remain testable');
assert.match(
  compactSource(promotionLauncher),
  /ESTÁNESTERANKING\?/,
  'local rankings must invite listed people and places to promote their option',
);
assert.match(
  compactSource(promotionLauncher),
  /topoLocal\.isLocalRanking\(r\)/,
  'option promotion must be exclusive to Topo Local rankings',
);
assert.match(
  compactSource(promotionLauncher),
  /data-ranking-option-promotion/,
  'the promotion flow must open from a single compact ranking control',
);
assert.match(
  compactApp,
  /rankingPersonalActionsHTML\(r,'mobile'\)\}\$\{rankingOptionPromotionHTML\(r\)\}\$\{rankingVoteModeHTML/,
  'option promotion must stay between the compact personal actions and voting modes',
);

const promotionLauncherContext = vm.createContext({
  topoLocal: { isLocalRanking: (ranking) => ranking.local === true },
});
vm.runInContext(
  `${promotionLauncher}\n` +
    `globalThis.localPromotion = rankingOptionPromotionHTML({ local: true, opts: [{ id: 1 }] });\n` +
    `globalThis.generalPromotion = rankingOptionPromotionHTML({ local: false, opts: [{ id: 1 }] });`,
  promotionLauncherContext,
);
assert.match(
  promotionLauncherContext.localPromotion,
  /data-ranking-option-promotion/,
  'Topo Local rankings must keep the promotion launcher',
);
assert.equal(
  promotionLauncherContext.generalPromotion,
  '',
  'general rankings must keep only their ordinary share actions',
);

const promotionUrl = extractTopLevelDeclaration(app, 'rankingOptionPromotionURL');
const promotionText = extractTopLevelDeclaration(app, 'rankingOptionPromotionText');
assert.ok(promotionUrl && promotionText, 'promotion links and captions must remain testable');
const promotionContext = vm.createContext({
  URL,
  location: { origin: 'https://somostopo.com.br' },
  rankingPath: (id) => `/ranking/${id}`,
});
vm.runInContext(
  `${promotionUrl}\n${promotionText}\n` +
    `globalThis.promotionURL = rankingOptionPromotionURL({ id: 'veganos-floripa' }, { id: 42, label: 'Verde Floripa' });\n` +
    `globalThis.promotionCaption = rankingOptionPromotionText({ id: 'veganos-floripa', q: 'Qual é o melhor restaurante vegano de Floripa?' }, { id: 42, label: 'Verde Floripa' });`,
  promotionContext,
);
assert.equal(
  promotionContext.promotionURL,
  'https://somostopo.com.br/ranking/veganos-floripa?modo=livre&apoiar=42#opcao-42',
  'promotion links must open free voting at the exact represented option',
);
assert.match(
  promotionContext.promotionCaption,
  /Estamos concorrendo no TOPO![\s\S]*Vote em Verde Floripa[\s\S]*somostopo\.com\.br/,
  'the generated caption must be immediately ready to post',
);

const promotionDialog = extractTopLevelDeclaration(app, 'openRankingOptionPromotion');
const compactPromotionDialog = compactSource(promotionDialog);
assert.match(
  compactPromotionDialog,
  /rankingPromotionWhatsApp[\s\S]*rankingPromotionCopy/,
  'the promotion dialog must keep WhatsApp and text-link copying',
);
assert.doesNotMatch(
  compactPromotionDialog,
  /rankingPromotionShare|COMPARTILHARAGORA|rankingPromotionPreview|Instagram/,
  'the promotion dialog must not show image or generic sharing controls',
);
assert.match(
  compactApp,
  /bindRankingOptionPromotion\(r\)/,
  'the automatic card launcher must be active after every ranking render',
);
assert.doesNotMatch(
  compactSource(promotionLauncher),
  /registered|business|entrar|cadastro/,
  'promoting an option must not require a personal or business account',
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
  compactEditorial,
  /body\.popElectric\.rankingPage\.rankingOptionPromotionLauncher\{/,
  'the automatic promotion launcher must have a compact editorial treatment',
);
assert.match(
  compactEditorial,
  /body\.popElectric\.rankingPage\.option\.promotionFocus\{/,
  'a shared option must be visibly highlighted for the arriving voter',
);
assert.match(
  compactEditorial,
  /body\.popElectric\.modalCard\.rankingPromotionModalCard\{[^}]*width:min\(620px,100%\)/,
  'the text-only promotion flow must use a compact modal',
);
assert.doesNotMatch(
  compactEditorial,
  /rankingPromotionPreview|rankingPromotionModalGrid|rankingPromotionHint/,
  'the removed card preview and Instagram hint must not leave stale layout rules',
);
assert.match(
  compactEditorial,
  /body\.popElectric\.rankingPromotionActionsbutton:hover[\s\S]*background:var\(--clean-coral\);color:var\(--clean-paper\)/,
  'promotion actions must use coral instead of lime for emphasis',
);

assert.match(
  compactPage,
  /\(ranking\.options\|\|\[\]\)\.slice\(0,3\)/,
  'server-rendered discovery cards must include the same three-item preview',
);
assert.match(
  compactPage,
  /class="reactupseoPreviewReact"href="\$\{path\}#votar"/,
  'server-rendered preview arrows must also open the ranking voting area',
);
assert.match(
  compactPage,
  /\$\{shareActions\(ranking\)\}/,
  'server-rendered discovery cards must preserve WhatsApp and native sharing',
);

console.log('Ranking voting flow passed: preview navigation, ranking votes and complete lists.');
