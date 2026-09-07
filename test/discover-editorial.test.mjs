import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DISCOVER_RANKINGS } from '../discover-rankings.js';
import { renderDiscoverPage } from '../page.js';

const root = new URL('../', import.meta.url);
const [template, appSource, cssSource, vercelConfig] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('app.js', root), 'utf8'),
  readFile(new URL('editorial-clean.css', root), 'utf8'),
  readFile(new URL('vercel.json', root), 'utf8'),
]);

test('Descobrir is a distinct primary experience after TOPO LOCAL', () => {
  assert.match(
    template,
    /data-experience="local"[\s\S]*data-experience="discover" href="\/descobrir">DESCOBRIR<\/a>/,
  );
  assert.match(vercelConfig, /"src": "\/descobrir\/\?"/);
  assert.match(vercelConfig, /"src": "\/descobrir\/\(\[\^\/\]\+\)\/\?"/);
  assert.match(appSource, /experience = discover \? 'discover'/);
});

test('the home introduces editorial rankings after TOPO LOCAL', () => {
  assert.match(appSource, /\$\{popLocalCalloutHTML\(\)\}\$\{discoverHomeCalloutHTML\(\)\}/);
  assert.match(appSource, /RANKINGS PARA LER/);
  assert.match(appSource, /Informação clara, números reais, data e fonte — sem votação\./);
  assert.match(appSource, /30 PUBLICADOS/);
  assert.doesNotMatch(appSource, /Os primeiros temas entram aqui em breve/);
  assert.doesNotMatch(appSource, /MAIS PARA DESCOBRIR|PARA DESCOBRIR/);
});

test('the editorial collection publishes all 30 rankings without voting controls', () => {
  const html = renderDiscoverPage(template);
  assert.match(html, /<body class="popElectric homePage discoverPage">/);
  assert.match(html, /<h1 id="discover-page-title">Descobrir<\/h1>/);
  assert.match(html, /name="robots" content="index,follow/);
  assert.equal((html.match(/class="discoverCard/g) || []).length, 30);
  assert.match(html, /Pessoas mais ricas do mundo/);
  assert.match(html, /US\$ 892 bi/);
  assert.doesNotMatch(html, /class="react|data-duel|VOTAR|VOTE AGORA/);
});

test('each editorial detail has a top 10, values, period and source', () => {
  const html = renderDiscoverPage(template, 'pessoas-mais-ricas-do-mundo');
  assert.match(html, /<body class="popElectric homePage discoverPage discoverDetailPage">/);
  assert.match(html, /<h1>Pessoas mais ricas do mundo<\/h1>/);
  assert.equal((html.match(/class="discoverRankPosition"/g) || []).length, 10);
  assert.match(html, /Elon Musk/);
  assert.match(html, /US\$ 892 bi/);
  assert.match(html, /1º de setembro de 2026/);
  assert.match(html, /Forbes · forbes\.com/);
  assert.match(html, /class="discoverPodium"/);
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

test('Descobrir has responsive desktop and mobile styling', () => {
  assert.match(cssSource, /\.discoverHomeCallout/);
  assert.match(cssSource, /\.discoverPageHero/);
  assert.match(cssSource, /\.discoverGrid/);
  assert.match(cssSource, /\.discoverRankingSheet/);
  assert.match(cssSource, /\.discoverPodium/);
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
