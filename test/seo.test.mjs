import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  renderGeneralCategoryPage,
  renderHomePage,
  renderMissingPage,
  renderRankingPage,
  renderVipRankingPage,
} from '../page.js';
import {
  CLUB_PLAYER_RANKING_IDS,
  FOOTBALL_TEAMS_CATEGORY_PATH,
  generalCategoryBySlug,
  generalCategoryForRanking,
  isClubPlayerRanking,
  localCityBySlug,
  localCollectionPath,
  localGroupBySlug,
  localGroupForRanking,
} from '../seo-taxonomy.js';
import { buildSitemap } from '../sitemap.js';

const root = new URL('../', import.meta.url);
const template = `<!doctype html><html lang="pt-BR"><head><!-- SEO_START --><title>Original</title><!-- SEO_END --></head><body class="popElectric"><main class="wrap feed" id="feed"><div class="loading">carregando rankings…</div></main></body></html>`;
const cinema = {
  id: 'filmes',
  category: 'Cinema',
  question: 'Quais são os melhores filmes de todos os tempos?',
  imageUrl: 'https://images.example/filmes.jpg',
  createdAt: '2026-08-20T12:00:00.000Z',
  updatedAt: '2026-08-25T12:00:00.000Z',
  voteCount: 120,
  options: [
    { id: 1, label: 'O Poderoso Chefão', score: 50 },
    { id: 2, label: 'Central do Brasil', score: 42 },
    { id: 3, label: 'Cidade de Deus', score: 39 },
    { id: 4, label: 'Bacurau', score: 35 },
  ],
};
const local = {
  id: 'sushi-floripa',
  category: 'Florianópolis',
  question: 'Qual é o melhor sushi de Florianópolis?',
  imageUrl: null,
  createdAt: '2026-08-21T12:00:00.000Z',
  updatedAt: '2026-08-24T12:00:00.000Z',
  voteCount: 80,
};
const fluminensePlayers = {
  id: 'melhores-jogadores-fluminense',
  category: 'Futebol',
  question: 'Quais foram os melhores jogadores do Fluminense de todos os tempos?',
  imageUrl: null,
  createdAt: '2026-08-26T12:00:00.000Z',
  updatedAt: '2026-08-27T12:00:00.000Z',
  voteCount: 12,
  options: [{ id: 10, label: 'Castilho', score: 5 }],
};

function structuredData(html) {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match, 'the page must include JSON-LD in the initial HTML');
  return JSON.parse(match[1]);
}

test('SEO taxonomy creates stable category, city and local collection URLs', () => {
  assert.equal(CLUB_PLAYER_RANKING_IDS.length, 20);
  assert.equal(FOOTBALL_TEAMS_CATEGORY_PATH, '/categoria/futebol/times');
  assert.equal(isClubPlayerRanking(fluminensePlayers), true);
  assert.equal(generalCategoryBySlug('tv-e-series')?.label, 'TV & Séries');
  assert.equal(generalCategoryBySlug('nostalgia')?.label, 'Nostalgia');
  assert.equal(generalCategoryBySlug('luxo')?.label, 'Luxo');
  assert.equal(generalCategoryBySlug('compras')?.label, 'Compras');
  assert.equal(generalCategoryBySlug('futebol')?.label, 'Futebol');
  assert.equal(generalCategoryBySlug('animais')?.label, 'Animais');
  assert.equal(generalCategoryBySlug('viagens')?.label, 'Viagens');
  assert.equal(generalCategoryForRanking(cinema)?.slug, 'cinema');
  assert.equal(generalCategoryForRanking({ id: 'futebol', category: 'Futebol' })?.slug, 'futebol');
  assert.equal(
    generalCategoryForRanking({ id: 'brinquedos-nostalgicos', category: 'Nostalgia' })?.slug,
    'nostalgia',
  );
  assert.equal(
    generalCategoryForRanking({ id: 'produto-legado', category: 'Produtos' })?.slug,
    'compras',
  );
  assert.equal(
    generalCategoryForRanking({ id: 'destino-legado', category: 'Viagem' })?.slug,
    'viagens',
  );
  assert.equal(generalCategoryForRanking({ id: 'gatos', category: 'Animais' })?.slug, 'animais');
  assert.equal(localCityBySlug('florianopolis')?.label, 'Florianópolis');
  assert.equal(localGroupForRanking(local)?.slug, 'sushi-japones');
  assert.equal(
    localGroupForRanking({
      id: 'bares-floripa',
      category: 'Florianópolis',
      question: 'Qual é o melhor bar em Florianópolis?',
    })?.slug,
    'bares',
  );
  assert.equal(
    localGroupForRanking({
      id: 'botecos-floripa',
      category: 'Florianópolis',
      question: 'Qual é o melhor boteco em Florianópolis?',
    })?.slug,
    'botecos',
  );
  assert.equal(
    localGroupForRanking({
      id: 'eventos-esportivos-floripa',
      category: 'Florianópolis',
      question: 'Qual tipo de evento esportivo é o favorito em Florianópolis?',
    })?.slug,
    'eventos-esportivos',
  );
  assert.equal(
    localCollectionPath('florianopolis', 'sushi-japones'),
    '/local/florianopolis/sushi-japones',
  );
  const veganGroup = localGroupForRanking({
    id: 'restaurantes-veganos-manaus',
    category: 'Manaus',
    question: 'Qual é o melhor restaurante/lanchonete vegano ou vegetariano em Manaus?',
  });
  assert.equal(veganGroup?.label, 'Restaurante/lanchonete vegano/vegetariano');
  assert.equal(veganGroup?.slug, 'restaurante-lanchonete-vegano-vegetariano');
  assert.equal(localGroupBySlug('restaurante-vegano'), veganGroup);
  assert.equal(
    localCollectionPath('manaus', veganGroup),
    '/local/manaus/restaurante-lanchonete-vegano-vegetariano',
  );
});

test('ranking HTML contains its content, canonical URL, H1 and structured result before JavaScript', () => {
  const html = renderRankingPage(template, {
    ...cinema,
    options: [
      { id: 1, label: 'O Poderoso Chefão', score: 50 },
      { id: 2, label: 'Central do Brasil', score: 42 },
    ],
  });
  assert.match(html, /data-server-rendered="true"/);
  assert.doesNotMatch(html, /carregando rankings/);
  assert.match(html, /<h1>Quais são os melhores filmes de todos os tempos\?<\/h1>/);
  assert.match(html, /O Poderoso Chefão/);
  assert.match(html, /rel="canonical" href="https:\/\/somostopo\.com\.br\/ranking\/filmes"/);
  assert.match(html, /href="\/categoria\/cinema"/);
  const data = structuredData(html);
  assert.ok(data['@graph'].some((entry) => entry['@type'] === 'BreadcrumbList'));
  assert.ok(data['@graph'].some((entry) => entry['@type'] === 'ItemList'));
});

test('home and category pages expose crawlable ranking and category links', () => {
  const vip = { ...cinema, id: 'amigos-vip', isVip: true };
  const home = renderHomePage(template, [cinema, local, vip]);
  assert.match(home, /<h1>Rankings para votar e descobrir<\/h1>/);
  assert.match(home, /href="\/categoria\/cinema"/);
  assert.match(home, /href="\/ranking\/filmes"/);
  assert.doesNotMatch(home, /href="\/ranking\/sushi-floripa"/);
  assert.doesNotMatch(home, /href="\/ranking\/amigos-vip"/);
  assert.match(home, /class="categoryRankOverlay"/);
  assert.match(home, /O Poderoso Chefão/);
  assert.match(home, /Central do Brasil/);
  assert.match(home, /Cidade de Deus/);
  assert.doesNotMatch(home, /Bacurau/);
  assert.match(home, /class="whatsappShare compact"/);
  assert.match(home, /VER RANKING/);

  const category = renderGeneralCategoryPage(template, generalCategoryBySlug('cinema'), [
    cinema,
    local,
  ]);
  assert.equal(category.count, 1);
  assert.match(category.html, /<h1>Cinema<\/h1>/);
  assert.match(category.html, /https:\/\/somostopo\.com\.br\/categoria\/cinema/);

  const generalSport = renderGeneralCategoryPage(template, generalCategoryBySlug('futebol'), [
    fluminensePlayers,
    {
      ...fluminensePlayers,
      id: 'maiores-times-brasil',
      question: 'Qual é o maior time de futebol do Brasil?',
    },
  ]);
  assert.equal(generalSport.count, 1);
  assert.doesNotMatch(generalSport.html, /melhores-jogadores-fluminense/);
  assert.match(generalSport.html, /href="\/categoria\/futebol\/times"/);

  const footballTeams = renderGeneralCategoryPage(
    template,
    generalCategoryBySlug('futebol'),
    [fluminensePlayers],
    '',
    'times',
  );
  assert.equal(footballTeams.count, 1);
  assert.match(footballTeams.html, /<h1>Times<\/h1>/);
  assert.match(footballTeams.html, /href="\/ranking\/melhores-jogadores-fluminense"/);
  assert.match(
    footballTeams.html,
    /rel="canonical" href="https:\/\/somostopo\.com\.br\/categoria\/futebol\/times"/,
  );

  const search = renderHomePage(template, [cinema], 'filmes');
  assert.match(search, /name="robots" content="noindex,follow"/);
  assert.match(search, /Resultados para “filmes”/);
  assert.match(search, /href="\/ranking\/filmes"/);

  const localSearch = renderHomePage(template, [cinema, local], 'sushi', 'Florianópolis');
  assert.match(localSearch, /TOPO \+ TOPO LOCAL · Florianópolis/);
  assert.match(localSearch, /href="\/ranking\/sushi-floripa"/);
});

test('not-found HTML remains a not-found page after the client starts', () => {
  const html = renderMissingPage(template);
  assert.match(html, /<body class="popElectric notFoundPage">/);
  assert.match(html, /<h1>Página não encontrada\.<\/h1>/);
  assert.match(html, /name="robots" content="noindex,follow"/);
});

test('VIP ranking shell is noindex and never renders protected options', () => {
  const html = renderVipRankingPage(template, {
    ...cinema,
    id: 'amigos-vip',
    question: 'Quem é a maior lenda deste grupo?',
    options: [{ id: 99, label: 'Nome protegido', score: 10 }],
  });
  assert.match(html, /name="robots" content="noindex,follow"/);
  assert.match(html, /Meu Topo/);
  assert.match(html, /Quem é a maior lenda deste grupo\?/);
  assert.doesNotMatch(html, /Nome protegido/);
  assert.doesNotMatch(html, /ItemList/);
});

test('sitemap includes canonical category, city, local topic and ranking URLs', () => {
  const xml = buildSitemap([
    {
      id: cinema.id,
      category: cinema.category,
      question: cinema.question,
      created_at: cinema.createdAt,
      updated_at: cinema.updatedAt,
    },
    {
      id: local.id,
      category: local.category,
      question: local.question,
      created_at: local.createdAt,
      updated_at: local.updatedAt,
    },
    {
      id: 'amigos-vip',
      category: 'Vida',
      question: 'Quem é a maior lenda deste grupo?',
      created_at: cinema.createdAt,
      updated_at: cinema.updatedAt,
      is_vip: true,
    },
    {
      id: fluminensePlayers.id,
      category: fluminensePlayers.category,
      question: fluminensePlayers.question,
      created_at: fluminensePlayers.createdAt,
      updated_at: fluminensePlayers.updatedAt,
    },
  ]);
  assert.match(xml, /https:\/\/somostopo\.com\.br\/categoria\/cinema/);
  assert.match(xml, /https:\/\/somostopo\.com\.br\/local\/florianopolis/);
  assert.match(xml, /https:\/\/somostopo\.com\.br\/local\/florianopolis\/sushi-japones/);
  assert.match(xml, /https:\/\/somostopo\.com\.br\/ranking\/filmes/);
  assert.match(xml, /https:\/\/somostopo\.com\.br\/categoria\/futebol\/times/);
  assert.doesNotMatch(xml, /amigos-vip/);
  assert.doesNotMatch(xml, /\/perfil|\/entrar|\/moderacao/);
});

test('Vercel routes every public collection and private account shell through SEO-aware HTML', async () => {
  const [vercel, robots, app, index, editorialCss] = await Promise.all([
    readFile(new URL('vercel.json', root), 'utf8').then(JSON.parse),
    readFile(new URL('robots.txt', root), 'utf8'),
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('editorial-clean.css', root), 'utf8'),
  ]);
  assert.ok(
    vercel.routes.some((route) => route.src === '/' && route.dest === '/page.js?view=home'),
  );
  assert.ok(vercel.routes.some((route) => route.src.includes('/categoria/')));
  assert.ok(
    vercel.routes.some(
      (route) =>
        route.src === '/categoria/futebol/times/?' &&
        route.dest === '/page.js?view=category&category=futebol&section=times',
    ),
  );
  assert.ok(vercel.routes.some((route) => route.src.includes('/local/([^/]+)/([^/]+)')));
  assert.ok(vercel.routes.some((route) => route.dest === '/page.js?view=private&kind=$1'));
  assert.equal(vercel.routes.at(-1).dest, '/page.js?view=not-found');
  assert.match(robots, /Disallow: \/api/);
  assert.match(robots, /Sitemap: https:\/\/somostopo\.com\.br\/sitemap\.xml/);
  assert.match(app, /feed\.dataset\.serverRendered !== 'true'/);
  assert.match(index, /classList\.add\('clientBooting'\)/);
  assert.match(
    index,
    /setTimeout\(\(\)=>document\.documentElement\.classList\.remove\('clientBooting'\),8000\)/,
  );
  assert.match(
    index,
    /\/app\.js\?v=20260827-1-vip-area-[^"']*-navigation-loading-search-city-search-submit-city/,
  );
  assert.match(index, /\/topo-local\.js\?v=20260903-1-bars-botecos/);
  assert.match(index, /id="searchCity" name="cidade" type="hidden"/);
  assert.doesNotMatch(index, /vote · veja · continue/);
  assert.match(editorialCss, /html\.clientBooting #feed\[data-server-rendered='true'\]/);
  assert.match(
    app,
    /function revealClientPage\(\)[\s\S]*?removeAttribute\('data-server-rendered'\)/,
  );
  assert.match(app, /renderHome\(\);[\s\S]*?revealClientPage\(\);/);
  assert.match(app, /document\.body\.classList\.contains\('notFoundPage'\)/);
  assert.match(app, /if \(kind === 'not-found'\) \{[\s\S]*?revealClientPage\(\);[\s\S]*?return;/);
  assert.match(app, /searchCityInput\.defaultValue = city/);
  assert.match(app, /location\.assign\(`\/\?\$\{params\}`\)/);
  assert.match(app, /href="\$\{escapeHTML\(groupPath\(g\)\)\}"/);
});
