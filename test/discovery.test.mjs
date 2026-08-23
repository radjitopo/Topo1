import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');

assert.doesNotMatch(source, /portalLeadText|categoryRankLeader/, 'the first place must not be repeated next to ranking titles');
assert.match(source, /Top 3 agora/, 'the dedicated Top 3 preview must remain visible');

const wanted = [
  'const foldText=',
  'function searchSingular(',
  'function searchTerms(',
  'function searchMatches(',
  'function rankingSearchText(',
  'const groupOverrides=',
  'function groupOf(',
  'function belongsToGroup(',
  'function visibleRankings(',
  'function categorySortedRankings(',
  'const relatedStopWords=',
  'const strongRelatedWords=',
  'function relatedTokens(',
  'function relatedPlace(',
  'function relatedScore('
];
const selected = source.split('\n').filter((line) =>
  wanted.some((prefix) => line.startsWith(prefix))
);

assert.equal(selected.length, wanted.length, 'discovery functions must remain testable');

const context = vm.createContext({ Date });
vm.runInContext(`
let rankings=[];
let activeGroup='Todos';
let homeSearch='';
let categorySort='priority';
function categoryPriorityRankings(list){return [...list]}
${selected.join('\n')}
globalThis.setDiscoveryState=(next)=>{rankings=next.rankings;activeGroup=next.activeGroup;homeSearch=next.homeSearch;categorySort=next.categorySort||'priority'};
globalThis.visibleRankingsForTest=visibleRankings;
globalThis.groupOfForTest=groupOf;
globalThis.relatedScoreForTest=relatedScore;
globalThis.categorySortedRankingsForTest=categorySortedRankings;
`, context);

const cinema = { id: 'filmes', cat: 'Cinema', q: 'Os melhores filmes', opts: [] };
const sushi = { id: 'sushi-floripa', cat: 'Florianópolis', q: 'Os melhores sushis de Florianópolis', opts: [{ label: 'Sushi A' }] };
context.setDiscoveryState({ rankings: [cinema, sushi], activeGroup: 'Cinema', homeSearch: 'sushi' });
assert.deepEqual(
  context.visibleRankingsForTest().map((ranking) => ranking.id),
  ['sushi-floripa'],
  'search must use the full catalog even after selecting a category'
);

context.setDiscoveryState({ rankings: [cinema, sushi], activeGroup: 'Cinema', homeSearch: '' });
assert.deepEqual(
  context.visibleRankingsForTest().map((ranking) => ranking.id),
  ['filmes'],
  'category browsing must remain scoped when there is no search'
);

const bakerySingular = { id: 'padaria-floripa', cat: 'Florianópolis', q: 'Qual padaria merece o topo em Florianópolis?', opts: [] };
const bakeryPlural = { id: 'padarias-sp', cat: 'São Paulo', q: 'As melhores padarias de São Paulo', opts: [] };
const hotelPlural = { id: 'hoteis-rio', cat: 'Rio de Janeiro', q: 'Os melhores hotéis do Rio de Janeiro', opts: [] };
context.setDiscoveryState({ rankings: [bakerySingular, hotelPlural], activeGroup: 'Todos', homeSearch: 'padarias' });
assert.deepEqual(context.visibleRankingsForTest().map((ranking) => ranking.id), ['padaria-floripa'], 'plural searches must find singular ranking titles');
context.setDiscoveryState({ rankings: [bakeryPlural, hotelPlural], activeGroup: 'Todos', homeSearch: 'padaria' });
assert.deepEqual(context.visibleRankingsForTest().map((ranking) => ranking.id), ['padarias-sp'], 'singular searches must find plural ranking titles');
context.setDiscoveryState({ rankings: [bakeryPlural, hotelPlural], activeGroup: 'Todos', homeSearch: 'hotel' });
assert.deepEqual(context.visibleRankingsForTest().map((ranking) => ranking.id), ['hoteis-rio'], 'accented irregular plurals must be normalized');

assert.equal(context.groupOfForTest({ id: 'influencers-brasil', cat: 'Diversão' }), 'Famosos');
assert.equal(context.groupOfForTest({ id: 'jogos-celular', cat: 'Tecnologia' }), 'Jogos');
assert.equal(context.groupOfForTest({ id: 'animes', cat: 'Diversão' }), 'TV & Séries');
assert.equal(context.groupOfForTest({ id: 'desculpas-atraso', cat: 'Diversão' }), 'Vida');

const sushiSp = { id: 'sushi-sp', cat: 'São Paulo', q: 'Os melhores sushis de São Paulo', votes: 0 };
const bakeryFloripa = { id: 'padarias-floripa', cat: 'Florianópolis', q: 'As melhores padarias de Florianópolis', votes: 0 };
const unrelated = { id: 'piores-empregos', cat: 'Diversão', q: 'Os piores empregos', votes: 1000 };
assert.ok(context.relatedScoreForTest(sushi, sushiSp, []) > context.relatedScoreForTest(sushi, unrelated, []));
assert.ok(context.relatedScoreForTest(sushi, bakeryFloripa, []) > context.relatedScoreForTest(sushi, unrelated, []));

context.setDiscoveryState({ rankings: [], activeGroup: 'Todos', homeSearch: '', categorySort: 'random' });
assert.equal(
  context.categorySortedRankingsForTest([sushi, cinema]).map((ranking) => ranking.id).join(','),
  'sushi-floripa,filmes',
  'random mode must preserve the freshly shuffled catalog order'
);

console.log('Discovery test passed: global search, clearer groups and related ranking relevance.');
