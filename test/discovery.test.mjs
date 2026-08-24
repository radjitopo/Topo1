import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { extractTopLevelDeclaration } from './source-helpers.mjs';

await import(new URL('../topo-local.js', import.meta.url));
const topoLocal = globalThis.TopoLocal;
const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');

assert.doesNotMatch(
  source,
  /portalLeadText|categoryRankLeader/,
  'the first place must not be repeated next to ranking titles',
);
assert.doesNotMatch(
  source,
  /relatedLead/,
  'related ranking cards must not reveal the current leader',
);
assert.match(source, /Top 3 agora/, 'the dedicated Top 3 preview must remain visible');

const wanted = [
  'homeContextOnlyRankingIds',
  'foldText',
  'searchSingular',
  'searchTerms',
  'searchMatches',
  'rankingSearchText',
  'groupOverrides',
  'groupOf',
  'experienceGroupOf',
  'experienceRankings',
  'localRankingsForSelectedCity',
  'belongsToGroup',
  'visibleRankings',
  'homeEligibleRankings',
  'cityPriorityDelta',
  'sortForExperience',
  'categorySortedRankings',
  'relatedStopWords',
  'strongRelatedWords',
  'relatedTokens',
  'relatedPlace',
  'relatedScore',
  'rankingsInSameExperience',
];
const selected = wanted.map((name) => extractTopLevelDeclaration(source, name));

assert.ok(selected.every(Boolean), 'discovery functions must remain testable');

const context = vm.createContext({ Date, topoLocal });
vm.runInContext(
  `
let rankings=[];
let activeGroup='Todos';
let homeSearch='';
let categorySort='priority';
let selectedCity='';
let localExperience=false;
function isLocalExperience(){return localExperience}
function categoryPriorityRankings(list){return [...list]}
${selected.join('\n')}
globalThis.setDiscoveryState=(next)=>{rankings=next.rankings;activeGroup=next.activeGroup;homeSearch=next.homeSearch;categorySort=next.categorySort||'priority';localExperience=Boolean(next.localExperience);selectedCity=next.selectedCity||''};
globalThis.visibleRankingsForTest=visibleRankings;
globalThis.homeEligibleRankingsForTest=homeEligibleRankings;
globalThis.homeContextOnlyCountForTest=homeContextOnlyRankingIds.size;
globalThis.groupOfForTest=groupOf;
globalThis.relatedScoreForTest=relatedScore;
globalThis.rankingsInSameExperienceForTest=rankingsInSameExperience;
globalThis.categorySortedRankingsForTest=categorySortedRankings;
`,
  context,
);

const cinema = { id: 'filmes', cat: 'Cinema', q: 'Os melhores filmes', opts: [] };
const sushi = {
  id: 'sushi-floripa',
  cat: 'Florianópolis',
  q: 'Os melhores sushis de Florianópolis',
  opts: [{ label: 'Sushi A' }],
};
context.setDiscoveryState({
  rankings: [cinema, sushi],
  activeGroup: 'Cinema',
  homeSearch: 'sushi',
});
assert.deepEqual(
  context.visibleRankingsForTest().map((ranking) => ranking.id),
  [],
  'the general search must not mix in commercial city rankings',
);

context.setDiscoveryState({
  rankings: [cinema, sushi],
  activeGroup: 'Todos',
  homeSearch: 'sushi',
  localExperience: true,
  selectedCity: 'Florianópolis',
});
assert.deepEqual(
  context.visibleRankingsForTest().map((ranking) => ranking.id),
  ['sushi-floripa'],
  'Topo Local search must find commercial city rankings',
);

context.setDiscoveryState({
  rankings: [cinema, sushi],
  activeGroup: 'Cinema',
  homeSearch: '',
  localExperience: false,
});
assert.deepEqual(
  context.visibleRankingsForTest().map((ranking) => ranking.id),
  ['filmes'],
  'category browsing must remain scoped when there is no search',
);

const bakerySingular = {
  id: 'padaria-floripa',
  cat: 'Florianópolis',
  q: 'Qual padaria merece o topo em Florianópolis?',
  opts: [],
};
const bakeryPlural = {
  id: 'padarias-sp',
  cat: 'São Paulo',
  q: 'As melhores padarias de São Paulo',
  opts: [],
};
const hotelPlural = {
  id: 'hoteis-rio',
  cat: 'Rio de Janeiro',
  q: 'Os melhores hotéis do Rio de Janeiro',
  opts: [],
};
context.setDiscoveryState({
  rankings: [bakerySingular, hotelPlural],
  activeGroup: 'Todos',
  homeSearch: 'padarias',
  localExperience: true,
  selectedCity: 'Florianópolis',
});
assert.deepEqual(
  context.visibleRankingsForTest().map((ranking) => ranking.id),
  ['padaria-floripa'],
  'plural searches must find singular ranking titles',
);
context.setDiscoveryState({
  rankings: [bakeryPlural, hotelPlural],
  activeGroup: 'Todos',
  homeSearch: 'padaria',
  localExperience: true,
  selectedCity: 'São Paulo',
});
assert.deepEqual(
  context.visibleRankingsForTest().map((ranking) => ranking.id),
  ['padarias-sp'],
  'singular searches must find plural ranking titles',
);
context.setDiscoveryState({
  rankings: [bakeryPlural, hotelPlural],
  activeGroup: 'Todos',
  homeSearch: 'hotel',
  localExperience: false,
});
assert.deepEqual(
  context.visibleRankingsForTest().map((ranking) => ranking.id),
  ['hoteis-rio'],
  'accented irregular plurals must be normalized in the main TOPO',
);

assert.equal(context.groupOfForTest({ id: 'influencers-brasil', cat: 'Diversão' }), 'Famosos');
assert.equal(context.groupOfForTest({ id: 'jogos-celular', cat: 'Tecnologia' }), 'Jogos');
assert.equal(context.groupOfForTest({ id: 'animes', cat: 'Diversão' }), 'TV & Séries');
assert.equal(context.groupOfForTest({ id: 'desculpas-atraso', cat: 'Diversão' }), 'Vida');
assert.equal(
  context.groupOfForTest({ id: 'celebridades-amadas-brasil', cat: 'Famosos' }),
  'Famosos',
);

const sushiSp = {
  id: 'sushi-sp',
  cat: 'São Paulo',
  q: 'Os melhores sushis de São Paulo',
  votes: 0,
};
const bakeryFloripa = {
  id: 'padarias-floripa',
  cat: 'Florianópolis',
  q: 'As melhores padarias de Florianópolis',
  votes: 0,
};
const unrelated = { id: 'piores-empregos', cat: 'Diversão', q: 'Os piores empregos', votes: 1000 };
const fluminensePlayers = {
  id: 'melhores-jogadores-fluminense',
  cat: 'Esporte',
  q: 'Quais foram os melhores jogadores do Fluminense de todos os tempos?',
  votes: 0,
};
const biggestBrazilianClub = {
  id: 'maiores-times-brasil',
  cat: 'Esporte',
  q: 'Qual é o maior time de futebol do Brasil?',
  votes: 0,
};

assert.equal(context.homeContextOnlyCountForTest, 20);
assert.deepEqual(
  context
    .homeEligibleRankingsForTest([fluminensePlayers, biggestBrazilianClub])
    .map((ranking) => ranking.id),
  ['maiores-times-brasil'],
  'team-specific rankings must stay out of the random Home pool',
);
context.setDiscoveryState({
  rankings: [fluminensePlayers, biggestBrazilianClub],
  activeGroup: 'Esporte',
  homeSearch: '',
});
assert.deepEqual(
  context.visibleRankingsForTest().map((ranking) => ranking.id),
  ['melhores-jogadores-fluminense', 'maiores-times-brasil'],
  'team-specific rankings must remain visible inside the Esporte category',
);
context.setDiscoveryState({
  rankings: [fluminensePlayers, biggestBrazilianClub],
  activeGroup: 'Todos',
  homeSearch: 'Fluminense',
});
assert.deepEqual(
  context.visibleRankingsForTest().map((ranking) => ranking.id),
  ['melhores-jogadores-fluminense'],
  'team-specific rankings must remain searchable',
);

context.setDiscoveryState({
  rankings: [sushi, sushiSp, bakeryFloripa, unrelated],
  activeGroup: 'Todos',
  homeSearch: 'sushi',
  localExperience: true,
  selectedCity: 'Florianópolis',
});
assert.deepEqual(
  context.visibleRankingsForTest().map((ranking) => ranking.id),
  ['sushi-floripa'],
  'Topo Local search must stay inside the chosen city',
);
assert.deepEqual(
  context.rankingsInSameExperienceForTest(sushi).map((ranking) => ranking.id),
  ['sushi-floripa', 'padarias-floripa'],
  'related local rankings must stay inside the ranking city',
);

assert.ok(
  context.relatedScoreForTest(sushi, sushiSp, []) >
    context.relatedScoreForTest(sushi, unrelated, []),
);
assert.ok(
  context.relatedScoreForTest(sushi, bakeryFloripa, []) >
    context.relatedScoreForTest(sushi, unrelated, []),
);

context.setDiscoveryState({
  rankings: [],
  activeGroup: 'Todos',
  homeSearch: '',
  categorySort: 'random',
});
assert.equal(
  context
    .categorySortedRankingsForTest([sushi, cinema])
    .map((ranking) => ranking.id)
    .join(','),
  'sushi-floripa,filmes',
  'random mode must preserve the freshly shuffled catalog order',
);

console.log('Discovery test passed: global search, clearer groups and related ranking relevance.');
