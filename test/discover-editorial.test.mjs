import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DISCOVER_RANKINGS } from '../discover-rankings.js';
import pageHandler, { renderDiscoverPage } from '../page.js';

const root = new URL('../', import.meta.url);
const [template, appSource, cssSource, vercelConfig, sitemapSource] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('app.js', root), 'utf8'),
  readFile(new URL('editorial-clean.css', root), 'utf8'),
  readFile(new URL('vercel.json', root), 'utf8'),
  readFile(new URL('sitemap.js', root), 'utf8'),
]);

test('the primary navigation clearly separates Rankings, TOPO and TOPO LOCAL', () => {
  assert.match(
    template,
    /data-experience="discover" href="\/rankings">RANKINGS<\/a>[\s\S]*data-experience="topo" href="\/"[\s\S]*data-experience="local" href="\/local"/,
  );
  assert.match(vercelConfig, /"src": "\/rankings\/\?"/);
  assert.match(vercelConfig, /"src": "\/rankings\/\(\[\^\/\]\+\)\/\?"/);
  assert.match(vercelConfig, /view=discover-legacy/);
  assert.match(appSource, /experience = discover \? 'discover'/);
});

test('the home introduces editorial rankings after TOPO LOCAL', () => {
  assert.match(appSource, /\$\{popLocalCalloutHTML\(\)\}\$\{discoverHomeCalloutHTML\(\)\}/);
  assert.match(appSource, /RANKINGS EDITORIAIS/);
  assert.match(appSource, /id="discover-home-title">Rankings<\/h2>/);
  assert.match(appSource, /Informação clara, números reais, data e fonte — sem votação\./);
  assert.match(appSource, /30 PUBLICADOS/);
  assert.doesNotMatch(appSource, /Os primeiros temas entram aqui em breve/);
  assert.doesNotMatch(appSource, /MAIS PARA DESCOBRIR|PARA DESCOBRIR/);
});

test('the editorial collection publishes all 30 rankings without voting controls', () => {
  const html = renderDiscoverPage(template);
  assert.match(html, /<body class="popElectric homePage discoverPage">/);
  assert.match(html, /<h1 id="discover-page-title">Rankings<\/h1>/);
  assert.match(html, /rel="canonical" href="https:\/\/somostopo\.com\.br\/rankings"/);
  assert.match(html, /name="robots" content="index,follow/);
  assert.equal((html.match(/class="discoverCard/g) || []).length, 30);
  assert.match(html, /Pessoas mais ricas do mundo/);
  assert.match(html, /US\$ 892 bi/);
  assert.doesNotMatch(html, /class="react|data-duel|VOTAR|VOTE AGORA/);
});

test('editorial URLs use Rankings and keep Descobrir only as a legacy redirect', () => {
  const detail = renderDiscoverPage(template, 'pessoas-mais-ricas-do-mundo');
  assert.match(detail, /href="\/rankings">← TODOS OS RANKINGS<\/a>/);
  assert.match(
    detail,
    /rel="canonical" href="https:\/\/somostopo\.com\.br\/rankings\/pessoas-mais-ricas-do-mundo"/,
  );
  assert.match(sitemapSource, /addUrl\(urls, '\/rankings'/);
  assert.doesNotMatch(sitemapSource, /addUrl\(urls, '\/descobrir'/);
});

test('old Descobrir links redirect permanently to Rankings', async () => {
  const headers = new Map();
  let statusCode = 0;
  const response = {
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    status(code) {
      statusCode = code;
      return this;
    },
    end() {
      return this;
    },
  };
  await pageHandler(
    { query: { view: 'discover-legacy', slug: 'pessoas-mais-ricas-do-mundo' } },
    response,
  );
  assert.equal(statusCode, 308);
  assert.equal(headers.get('location'), '/rankings/pessoas-mais-ricas-do-mundo');
});

test('each editorial detail has a top 10, values, period and source', () => {
  const html = renderDiscoverPage(template, 'pessoas-mais-ricas-do-mundo');
  assert.match(html, /<body class="popElectric homePage discoverPage discoverDetailPage">/);
  assert.match(html, /<h1>Pessoas mais ricas do mundo<\/h1>/);
  assert.match(
    html,
    /class="discoverArticleVisual" aria-hidden="true"><span>R\$<\/span><small>RANKING 01<\/small>/,
  );
  assert.equal((html.match(/class="discoverRankPosition"/g) || []).length, 10);
  assert.match(html, /Elon Musk/);
  assert.match(html, /US\$ 892 bi/);
  assert.match(html, /1º de setembro de 2026/);
  assert.match(html, /Forbes · forbes\.com/);
  assert.doesNotMatch(html, /class="discoverPodium"/);
  assert.match(html, /medal-gold[\s\S]*OURO/);
  assert.match(html, /medal-silver[\s\S]*PRATA/);
  assert.match(html, /medal-bronze[\s\S]*BRONZE/);
  assert.equal((html.match(/class="discoverMedalRank"/g) || []).length, 9);
  assert.doesNotMatch(html, /class="react|data-duel/);
});

test('the editorial catalog keeps 30 complete and sourced rankings', () => {
  assert.equal(DISCOVER_RANKINGS.length, 30);
  for (const ranking of DISCOVER_RANKINGS) {
    assert.equal(ranking.items.length, 10, ranking.slug);
    assert.match(ranking.sourceUrl, /^https:\/\//, ranking.slug);
    assert.ok(ranking.period, ranking.slug);
    assert.ok(
      ranking.items.every((item) => item.name && item.value && item.rank),
      ranking.slug,
    );
  }
});

test('Rankings has responsive desktop and mobile styling', () => {
  assert.match(cssSource, /\.discoverHomeCallout/);
  assert.match(cssSource, /\.discoverPageHero/);
  assert.match(cssSource, /\.discoverGrid/);
  assert.match(cssSource, /\.discoverRankingSheet/);
  assert.match(cssSource, /\.discoverArticleVisual/);
  assert.match(
    cssSource,
    /\.discoverArticleHero \{[\s\S]*background: var\(--clean-paper\);[\s\S]*color: var\(--clean-ink\);/,
  );
  assert.match(cssSource, /\.medal-gold/);
  assert.match(cssSource, /\.medal-silver/);
  assert.match(cssSource, /\.medal-bronze/);
  assert.match(
    cssSource,
    /\.discoverArticleHero,[\s\S]*\.discoverRankingSheet > header[\s\S]*height: auto/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 700px\)[\s\S]*\.discoverRankingSheet[\s\S]*grid-template-columns: 56px minmax\(0, 1fr\)/,
  );
  assert.match(cssSource, /localMode \.experienceInner \{[\s\S]*?flex-wrap: wrap/);
});
