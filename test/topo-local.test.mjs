import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

await import(new URL('../topo-local.js', import.meta.url));
const local = globalThis.TopoLocal;

const rankings = [
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
  {
    id: 'pizza-sp',
    cat: 'São Paulo',
    q: 'Qual pizzaria é a cara de São Paulo?',
  },
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

test('commercial city rankings go to Topo Local without swallowing general place rankings', () => {
  assert.deepEqual(
    rankings.filter(local.isLocalRanking).map((ranking) => ranking.id),
    ['sushi-floripa', 'padarias-bc', 'pizza-sp', 'hoteis-rio'],
  );
  assert.equal(local.groupForRanking(rankings[0]), 'Restaurantes');
  assert.equal(local.groupForRanking(rankings[1]), 'Padarias');
  assert.equal(local.groupForRanking(rankings[2]), 'Pizzarias');
  assert.equal(local.groupForRanking(rankings[3]), 'Hotéis');
});

test('manual city wins, then detected city, then the launch default', () => {
  assert.deepEqual(local.availableCities(rankings), [
    'Florianópolis',
    'Balneário Camboriú',
    'São Paulo',
    'Rio de Janeiro',
  ]);
  assert.equal(local.resolvePreferredCity(rankings, 'São Paulo', 'Rio de Janeiro'), 'São Paulo');
  assert.equal(local.resolvePreferredCity(rankings, '', 'Sao Paulo'), 'São Paulo');
  assert.equal(local.resolvePreferredCity(rankings, '', 'Curitiba'), 'Florianópolis');
});

test('the chosen city is prioritized without hiding other cities', () => {
  const ordered = local.prioritizeRankings(rankings.filter(local.isLocalRanking), 'Rio');
  assert.equal(ordered[0].id, 'hoteis-rio');
  assert.equal(ordered.length, 4);
  assert.deepEqual(
    ordered.slice(1).map((ranking) => ranking.id),
    ['sushi-floripa', 'padarias-bc', 'pizza-sp'],
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
  assert.match(index, /topo-local\.js\?v=20260824-1/);
  assert.match(index, /app\.js\?v=20260824-18/);
  assert.match(api, /x-vercel-ip-city/);
  assert.match(api, /location: \{ city: geolocationCity\(req\) \}/);
  assert.match(page, /TOPO LOCAL — rankings da sua cidade/);
  assert.match(vercel, /"src": "\/local\/\?"/);
  assert.match(sitemap, /'\/local'/);
  assert.match(css, /\.homePage \.accountEnter\s*\{[^}]*font-size: 13px/s);
  assert.match(app, /homePortal = !isLocalRoute\(\)/);
  assert.match(app, /if \(local \|\| !homePortal\) \{\s*renderCategoryHome\(visible\)/);
  assert.match(app, /Rankings em \$\{selectedCity\}/);
  assert.match(app, /class="categoryCityDivider"/);
  assert.match(css, /\.localCatalogHead\s*\{/);
  assert.match(css, /\.categoryCityDivider\s*\{/);
});
