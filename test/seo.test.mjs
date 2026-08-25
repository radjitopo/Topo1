import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { renderGeneralCategoryPage, renderHomePage, renderRankingPage } from '../page.js';
import {
  generalCategoryBySlug,
  generalCategoryForRanking,
  localCityBySlug,
  localCollectionPath,
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

function structuredData(html) {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match, 'the page must include JSON-LD in the initial HTML');
  return JSON.parse(match[1]);
}

test('SEO taxonomy creates stable category, city and local collection URLs', () => {
  assert.equal(generalCategoryBySlug('tv-e-series')?.label, 'TV & Séries');
  assert.equal(generalCategoryForRanking(cinema)?.slug, 'cinema');
  assert.equal(localCityBySlug('florianopolis')?.label, 'Florianópolis');
  assert.equal(localGroupForRanking(local)?.slug, 'sushi-japones');
  assert.equal(
    localCollectionPath('florianopolis', 'sushi-japones'),
    '/local/florianopolis/sushi-japones',
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
  const home = renderHomePage(template, [cinema, local]);
  assert.match(home, /<h1>Rankings para votar e descobrir<\/h1>/);
  assert.match(home, /href="\/categoria\/cinema"/);
  assert.match(home, /href="\/ranking\/filmes"/);
  assert.doesNotMatch(home, /href="\/ranking\/sushi-floripa"/);

  const category = renderGeneralCategoryPage(template, generalCategoryBySlug('cinema'), [
    cinema,
    local,
  ]);
  assert.equal(category.count, 1);
  assert.match(category.html, /<h1>Cinema<\/h1>/);
  assert.match(category.html, /https:\/\/somostopo\.com\.br\/categoria\/cinema/);

  const search = renderHomePage(template, [cinema], 'filmes');
  assert.match(search, /name="robots" content="noindex,follow"/);
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
  ]);
  assert.match(xml, /https:\/\/somostopo\.com\.br\/categoria\/cinema/);
  assert.match(xml, /https:\/\/somostopo\.com\.br\/local\/florianopolis/);
  assert.match(xml, /https:\/\/somostopo\.com\.br\/local\/florianopolis\/sushi-japones/);
  assert.match(xml, /https:\/\/somostopo\.com\.br\/ranking\/filmes/);
  assert.doesNotMatch(xml, /\/perfil|\/entrar|\/moderacao/);
});

test('Vercel routes every public collection and private account shell through SEO-aware HTML', async () => {
  const [vercel, robots, app] = await Promise.all([
    readFile(new URL('vercel.json', root), 'utf8').then(JSON.parse),
    readFile(new URL('robots.txt', root), 'utf8'),
    readFile(new URL('app.js', root), 'utf8'),
  ]);
  assert.ok(
    vercel.routes.some((route) => route.src === '/' && route.dest === '/page.js?view=home'),
  );
  assert.ok(vercel.routes.some((route) => route.src.includes('/categoria/')));
  assert.ok(vercel.routes.some((route) => route.src.includes('/local/([^/]+)/([^/]+)')));
  assert.ok(vercel.routes.some((route) => route.dest === '/page.js?view=private&kind=$1'));
  assert.equal(vercel.routes.at(-1).dest, '/page.js?view=not-found');
  assert.match(robots, /Disallow: \/api/);
  assert.match(robots, /Sitemap: https:\/\/somostopo\.com\.br\/sitemap\.xml/);
  assert.match(app, /feed\.dataset\.serverRendered !== 'true'/);
  assert.match(app, /href="\$\{escapeHTML\(groupPath\(g\)\)\}"/);
});
