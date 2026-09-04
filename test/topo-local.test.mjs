import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

await import(new URL('../topo-local.js', import.meta.url));
const local = globalThis.TopoLocal;

const categoryExamples = [
  ['restaurantes-brasilia', 'Qual é o melhor restaurante em Brasília?', 'Restaurantes em geral'],
  ['pizza-brasilia', 'Qual é a melhor pizzaria em Brasília?', 'Pizza'],
  ['hamburguer-brasilia', 'Quem faz o melhor hambúrguer em Brasília?', 'Hambúrguer'],
  ['sushi-brasilia', 'Qual é o melhor sushi em Brasília?', 'Sushi/Japonês'],
  ['cafes-brasilia', 'Qual é o melhor café em Brasília?', 'Café/Cafeteria'],
  ['sorveterias-brasilia', 'Qual é a melhor sorveteria em Brasília?', 'Sorveteria'],
  ['bares-brasilia', 'Qual é o melhor bar em Brasília?', 'Bares'],
  ['botecos-brasilia', 'Qual é o melhor boteco em Brasília?', 'Botecos'],
  ['saloes-beleza-brasilia', 'Qual é o melhor salão de beleza em Brasília?', 'Salão de beleza'],
  ['barbearias-brasilia', 'Qual é a melhor barbearia em Brasília?', 'Barbearia'],
  ['academias-brasilia', 'Qual é a melhor academia em Brasília?', 'Academia'],
  [
    'eventos-esportivos-brasilia',
    'Qual tipo de evento esportivo é o favorito em Brasília?',
    'Eventos esportivos',
  ],
  ['pet-shops-brasilia', 'Qual é o melhor pet shop em Brasília?', 'Pet shop'],
  [
    'restaurantes-italianos-brasilia',
    'Qual é o melhor restaurante italiano em Brasília?',
    'Restaurante italiano',
  ],
  [
    'frutos-do-mar-brasilia',
    'Qual é o melhor restaurante de frutos do mar em Brasília?',
    'Restaurante de frutos do mar',
  ],
  ['padarias-brasilia', 'Qual é a melhor padaria em Brasília?', 'Padaria'],
  ['quilo-brasilia', 'Qual é o melhor restaurante por quilo em Brasília?', 'Restaurante por quilo'],
  [
    'restaurantes-veganos-brasilia',
    'Qual é o melhor restaurante/lanchonete vegano ou vegetariano em Brasília?',
    'Restaurante/lanchonete vegano/vegetariano',
  ],
  ['brechos-brasilia', 'Qual é o melhor brechó em Brasília?', 'Brechó'],
];

const rankings = [
  ...categoryExamples.map(([id, q]) => ({ id, cat: 'Brasília', q })),
  {
    id: 'sushi-floripa',
    cat: 'Florianópolis',
    q: 'Onde está o melhor sushi de Florianópolis?',
  },
  {
    id: 'padarias-bc',
    cat: 'Balneário Camboriú',
    q: 'Qual padaria é parada obrigatória em Balneário Camboriú?',
  },
  { id: 'pizza-sp', cat: 'São Paulo', q: 'Qual pizzaria é a cara de São Paulo?' },
  {
    id: 'hoteis-rio',
    cat: 'Rio de Janeiro',
    q: 'Qual hotel entrega a melhor experiência no Rio?',
  },
  {
    id: 'praias',
    cat: 'Florianópolis',
    q: 'Qual praia de Florianópolis é impossível não amar?',
  },
  {
    id: 'bairros-floripa',
    cat: 'Florianópolis',
    q: 'Em qual bairro de Florianópolis você moraria?',
  },
  {
    id: 'cafes-supermercado',
    cat: 'Produtos',
    q: 'Qual café de supermercado salva sua manhã?',
  },
];

test('the exact 19 Topo Local categories classify independently', () => {
  assert.deepEqual(local.groupOrder, ['Todos', ...categoryExamples.map(([, , group]) => group)]);
  for (const [id, , expected] of categoryExamples) {
    const ranking = rankings.find((item) => item.id === id);
    assert.equal(local.groupForRanking(ranking), expected, id);
    assert.equal(local.isLocalRanking(ranking), true, id);
  }
  assert.equal(
    local.collectionPath('Manaus', 'Restaurante/lanchonete vegano/vegetariano'),
    '/local/manaus/restaurante-lanchonete-vegano-vegetariano',
  );
  assert.equal(
    local.collectionPath('Florianópolis', 'Restaurante de frutos do mar'),
    '/local/florianopolis/restaurante-de-frutos-do-mar',
  );
});

test('general place rankings stay outside Topo Local', () => {
  assert.equal(
    local.isLocalRanking(rankings.find((ranking) => ranking.id === 'hoteis-rio')),
    false,
  );
  assert.equal(local.isLocalRanking(rankings.find((ranking) => ranking.id === 'praias')), false);
  assert.equal(
    local.isLocalRanking(rankings.find((ranking) => ranking.id === 'bairros-floripa')),
    false,
  );
  assert.equal(
    local.isLocalRanking(rankings.find((ranking) => ranking.id === 'cafes-supermercado')),
    false,
  );
});

test('the selector has the 20 largest cities plus Florianópolis and keeps legacy BC direct-only', () => {
  assert.equal(local.cityOrder.length, 21);
  assert.deepEqual(local.cityOrder, [
    'São Paulo',
    'Rio de Janeiro',
    'Brasília',
    'Fortaleza',
    'Salvador',
    'Belo Horizonte',
    'Manaus',
    'Curitiba',
    'Recife',
    'Goiânia',
    'Belém',
    'Porto Alegre',
    'Guarulhos',
    'Campinas',
    'São Luís',
    'Maceió',
    'Campo Grande',
    'São Gonçalo',
    'Teresina',
    'João Pessoa',
    'Florianópolis',
  ]);
  assert.deepEqual(local.legacyCityOrder, ['Balneário Camboriú']);
  assert.deepEqual(local.availableCities(rankings), ['São Paulo', 'Brasília', 'Florianópolis']);
  assert.equal(
    local.isLocalRanking(rankings.find((ranking) => ranking.id === 'padarias-bc')),
    true,
  );
  assert.equal(local.normalizeCity('Sao-Goncalo'), 'São Gonçalo');
  assert.equal(local.normalizeCity('Floripa'), 'Florianópolis');
});

test('manual city wins, then detected city, then the launch default', () => {
  assert.equal(local.resolvePreferredCity(rankings, 'São Paulo', 'Rio de Janeiro'), 'São Paulo');
  assert.equal(
    local.resolvePreferredCity(rankings, 'Balneário Camboriú', 'Florianópolis'),
    'Balneário Camboriú',
  );
  assert.equal(local.resolvePreferredCity(rankings, '', 'Brasilia'), 'Brasília');
  assert.equal(local.resolvePreferredCity(rankings, '', 'Curitiba'), 'Florianópolis');
});

test('the chosen city becomes a closed local catalog', () => {
  assert.deepEqual(
    local.rankingsForCity(rankings, 'Rio').map((ranking) => ranking.id),
    [],
  );
  assert.deepEqual(
    local.rankingsForCity(rankings, 'Florianópolis').map((ranking) => ranking.id),
    ['sushi-floripa'],
  );
});

test('the public shell, API and routes expose the complete local experience', async () => {
  const [index, app, api, page, vercel, sitemap, css] = await Promise.all(
    ['index.html', 'app.js', 'api.js', 'page.js', 'vercel.json', 'sitemap.js', 'style.css'].map(
      (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8'),
    ),
  );
  assert.match(index, /data-experience="topo"/);
  assert.match(index, /data-experience="local" href="\/local"/);
  assert.match(index, /id="citySelect"/);
  assert.match(index, /topo-local\.js\?v=20260903-1-bars-botecos/);
  assert.match(index, /app\.js\?v=20260827-1-vip-area/);
  assert.match(index, /pop-electric\.css\?v=20260826-13-compact-categories/);
  assert.match(api, /x-vercel-ip-city/);
  assert.match(api, /location: \{ city: geolocationCity\(req\), selectedCity \}/);
  assert.match(page, /TOPO LOCAL — rankings da sua cidade/);
  assert.match(vercel, /"src": "\/local\/\?"/);
  assert.match(sitemap, /'\/local'/);
  assert.match(css, /\.homePage \.accountEnter\s*\{[^}]*font-size: 13px/s);
  assert.match(app, /homePortal = !isLocalRoute\(\)/);
  assert.match(app, /if \(local \|\| !homePortal\) \{\s*renderCategoryHome\(visible\)/);
  assert.match(app, /Rankings em \$\{selectedCity\}/);
  assert.match(app, /localRankingsForSelectedCity/);
  assert.match(app, /Só rankings de \$\{selectedCity\}/);
  assert.match(app, /Explorar outra cidade/);
  assert.match(app, /Overture Maps Foundation/);
  assert.match(app, /rankingsInSameExperience/);
  assert.doesNotMatch(app, /categoryCityDivider|Continue explorando além de/);
  assert.match(css, /\.localCatalogHead\s*\{/);
  assert.match(css, /\.localCatalogFooter\s*\{/);
  assert.match(css, /\.localDataCredit\s*\{/);
  assert.match(css, /\.localCityOptions\s*\{/);
  assert.doesNotMatch(css, /\.categoryCityDivider\s*\{/);
});
