import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  DISCOVER_CATEGORIES,
  DISCOVER_RANKINGS,
  discoverRankingsForCategory,
} from '../discover-rankings.js';
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
  assert.match(appSource, /110 PUBLICADOS/);
  assert.doesNotMatch(appSource, /Os primeiros temas entram aqui em breve/);
  assert.doesNotMatch(appSource, /MAIS PARA DESCOBRIR|PARA DESCOBRIR/);
});

test('the editorial collection publishes all 110 rankings without voting controls', () => {
  const html = renderDiscoverPage(template);
  assert.match(html, /<body class="popElectric homePage discoverPage">/);
  assert.match(html, /<h1 id="discover-page-title">Rankings<\/h1>/);
  assert.match(html, /rel="canonical" href="https:\/\/somostopo\.com\.br\/rankings"/);
  assert.match(html, /110 rankings editoriais com Top 10/);
  assert.match(html, /name="robots" content="index,follow/);
  assert.equal((html.match(/class="discoverCard/g) || []).length, 110);
  assert.match(html, /Pessoas mais ricas do mundo/);
  assert.match(html, /US\$ 892 bi/);
  assert.doesNotMatch(html, /class="react|data-duel|VOTAR|VOTE AGORA/);
});

test('Todos reveals the editorial collection in blocks of 20 rankings', () => {
  const allHtml = renderDiscoverPage(template);
  const categoryHtml = renderDiscoverPage(template, '', 'brasil');
  assert.match(allHtml, /data-discover-pagination data-page-size="20" hidden/);
  assert.match(allHtml, /data-discover-load-more[^>]*>Ver mais 20 rankings<\/button>/);
  assert.match(allHtml, /data-discover-progress[^>]*>20 de 110 rankings<\/span>/);
  assert.doesNotMatch(categoryHtml, /data-discover-pagination/);
  assert.match(appSource, /const DISCOVER_PAGE_SIZE = 20/);
  assert.match(appSource, /visibleCount = Math\.min\(visibleCount \+ pageSize, cards\.length\)/);
  assert.match(appSource, /button\.hidden = remaining === 0/);
  assert.match(cssSource, /\.discoverCard\[hidden\]/);
  assert.match(cssSource, /\.discoverLoadMore button:focus-visible/);
});

test('Todos shuffles the rankings on each visit before revealing the first 20', () => {
  assert.match(appSource, /Math\.floor\(Math\.random\(\) \* \(current \+ 1\)\)/);
  assert.match(
    appSource,
    /\[cards\[current\], cards\[target\]\] = \[cards\[target\], cards\[current\]\]/,
  );
  assert.match(appSource, /card\.classList\.toggle\('featured', index === 0\)/);
  assert.match(appSource, /number\.textContent = String\(index \+ 1\)\.padStart\(2, '0'\)/);
  assert.match(appSource, /grid\.append\(card\)/);
});

test('Rankings offers useful categories and filters the collection on the server', () => {
  const allHtml = renderDiscoverPage(template);
  assert.match(allHtml, /aria-label="Categorias dos rankings"/);
  assert.match(allHtml, /href="\/rankings#categorias"[^>]*aria-current="page">Todos<\/a>/);
  assert.match(allHtml, /href="\/rankings\?categoria=cinema-tv#categorias">Cinema e TV<\/a>/);

  const sportsHtml = renderDiscoverPage(template, '', 'esportes');
  assert.equal((sportsHtml.match(/class="discoverCard/g) || []).length, 10);
  assert.match(sportsHtml, /Maiores torcidas de futebol do Brasil/);
  assert.match(sportsHtml, /Maiores artilheiros da história da Copa do Mundo/);
  assert.match(sportsHtml, /Classificação da Fórmula 1 2026/);
  assert.match(sportsHtml, /Tenistas com mais semanas como número 1 da ATP/);
  assert.match(sportsHtml, /Franquias com mais títulos da NBA/);
  assert.match(sportsHtml, /Países com mais medalhas em Paris 2024/);
  assert.match(sportsHtml, /Lutadores ativos com mais vitórias no UFC/);
  assert.doesNotMatch(sportsHtml, /Atletas mais bem pagos do mundo/);
  assert.doesNotMatch(sportsHtml, /Pessoas mais ricas do mundo/);
  assert.match(sportsHtml, /class="discoverCategoryButton active"[^>]*>Esportes<\/a>/);
  assert.match(sportsHtml, /<h2 id="discover-list-title">10 rankings de Esportes<\/h2>/);
  assert.match(
    sportsHtml,
    /rel="canonical" href="https:\/\/somostopo\.com\.br\/rankings\?categoria=esportes"/,
  );
});

test('Dinheiro gathers the 10 wealth rankings without duplicates', () => {
  const moneyRankings = discoverRankingsForCategory('dinheiro');
  const moneyHtml = renderDiscoverPage(template, '', 'dinheiro');
  assert.equal(moneyRankings.length, 10);
  assert.equal(new Set(moneyRankings.map(({ slug }) => slug)).size, 10);
  assert.equal((moneyHtml.match(/class="discoverCard/g) || []).length, 10);
  assert.match(moneyHtml, /Pessoas mais ricas do mundo/);
  assert.match(moneyHtml, /Brasileiros mais ricos/);
  assert.match(moneyHtml, /Mulheres mais ricas do mundo/);
  assert.match(moneyHtml, /Famílias mais ricas do mundo/);
  assert.match(moneyHtml, /Empresas mais valiosas do mundo/);
  assert.match(moneyHtml, /Marcas mais valiosas do mundo/);
  assert.match(moneyHtml, /Países com maior PIB/);
  assert.match(moneyHtml, /Países com maior PIB por habitante/);
  assert.match(moneyHtml, /Cidades com mais bilionários/);
  assert.match(moneyHtml, /Atletas mais bem pagos do mundo/);
  assert.match(moneyHtml, /<h2 id="discover-list-title">10 rankings de Dinheiro<\/h2>/);
});

test('Celebridades gathers 10 current and sourced rankings without duplicates', () => {
  const celebrityRankings = discoverRankingsForCategory('celebridades');
  const celebrityHtml = renderDiscoverPage(template, '', 'celebridades');
  assert.equal(celebrityRankings.length, 10);
  assert.equal(new Set(celebrityRankings.map(({ slug }) => slug)).size, 10);
  assert.equal((celebrityHtml.match(/class="discoverCard/g) || []).length, 10);
  assert.match(celebrityHtml, /Celebridades mais seguidas no Instagram/);
  assert.match(celebrityHtml, /Brasileiros mais seguidos no Instagram/);
  assert.match(celebrityHtml, /Celebridades mais seguidas no TikTok/);
  assert.match(celebrityHtml, /Streamers mais seguidos na Twitch/);
  assert.match(celebrityHtml, /Criadores de conteúdo mais poderosos do mundo/);
  assert.match(celebrityHtml, /Atores mais bem pagos de Hollywood/);
  assert.match(celebrityHtml, /Músicos mais bem pagos do mundo/);
  assert.match(celebrityHtml, /Atores de maior bilheteria da história/);
  assert.match(celebrityHtml, /Rappers com mais Grammys/);
  assert.match(celebrityHtml, /Artistas com mais ouvintes mensais no Spotify/);
  assert.match(celebrityHtml, /<h2 id="discover-list-title">10 rankings de Celebridades<\/h2>/);
});

test('Esportes gathers 10 varied and sourced rankings without duplicates', () => {
  const sportsRankings = discoverRankingsForCategory('esportes');
  const sportsHtml = renderDiscoverPage(template, '', 'esportes');
  assert.equal(sportsRankings.length, 10);
  assert.equal(new Set(sportsRankings.map(({ slug }) => slug)).size, 10);
  assert.equal((sportsHtml.match(/class="discoverCard/g) || []).length, 10);
  assert.ok(sportsRankings.some(({ category }) => category === 'Futebol'));
  assert.ok(sportsRankings.some(({ category }) => category === 'Esporte'));
  assert.match(sportsHtml, /Kylian Mbappé/);
  assert.match(sportsHtml, /Kimi Antonelli/);
  assert.match(sportsHtml, /Novak Djokovic/);
  assert.match(sportsHtml, /Boston Celtics/);
  assert.match(sportsHtml, /Estados Unidos/);
  assert.match(sportsHtml, /Jim Miller/);
});

test('Mundo & Geografia gathers 16 varied and sourced rankings without duplicates', () => {
  const worldRankings = discoverRankingsForCategory('mundo');
  const worldHtml = renderDiscoverPage(template, '', 'mundo');
  assert.equal(worldRankings.length, 16);
  assert.equal(new Set(worldRankings.map(({ slug }) => slug)).size, 16);
  assert.equal((worldHtml.match(/class="discoverCard/g) || []).length, 16);
  assert.ok(worldRankings.some(({ category }) => category === 'Mundo'));
  assert.ok(worldRankings.some(({ category }) => category === 'Educação'));
  assert.match(worldHtml, /Países mais felizes do mundo/);
  assert.match(worldHtml, /Maiores países do mundo por área terrestre/);
  assert.match(worldHtml, /Cidades mais populosas do mundo/);
  assert.match(worldHtml, /Montanhas mais altas do mundo/);
  assert.match(worldHtml, /Maiores ilhas do mundo/);
  assert.match(worldHtml, /Países com mais patrimônios mundiais da UNESCO/);
  assert.match(worldHtml, /Coleções estranhas gigantescas registradas pelo Guinness/);
  assert.match(worldHtml, /Estados americanos com mais relatos de OVNIs/);
  assert.match(worldHtml, /Estados americanos com mais relatos de Bigfoot/);
  assert.match(worldHtml, /Animais que passam mais horas do dia dormindo/);
  assert.match(worldHtml, /Formatos de OVNI mais relatados/);
  assert.match(worldHtml, /alienígenas disfarçados de humanos/);
  assert.match(worldHtml, /class="discoverCategoryButton active"[^>]*>Mundo &amp; Geografia<\/a>/);
  assert.match(
    worldHtml,
    /<h2 id="discover-list-title">16 rankings de Mundo &amp; Geografia<\/h2>/,
  );
});

test('the NUFORC ranking uses report counts and clearly states their limits', () => {
  const ranking = DISCOVER_RANKINGS.find(
    ({ slug }) => slug === 'estados-americanos-mais-relatos-ovnis',
  );
  assert.ok(ranking);
  assert.equal(ranking.source, 'National UFO Reporting Center (NUFORC)');
  assert.equal(ranking.items.length, 10);
  assert.deepEqual(
    ranking.items.map(({ name, value }) => [name, value]),
    [
      ['Califórnia', '17.384 relatos'],
      ['Flórida', '9.012 relatos'],
      ['Washington', '7.708 relatos'],
      ['Texas', '6.827 relatos'],
      ['Nova York', '6.443 relatos'],
      ['Pensilvânia', '5.462 relatos'],
      ['Arizona', '5.415 relatos'],
      ['Ohio', '4.800 relatos'],
      ['Illinois', '4.570 relatos'],
      ['Carolina do Norte', '3.975 relatos'],
    ],
  );
  assert.match(ranking.note, /observações autodeclaradas/);
  assert.match(ranking.note, /não significam ocorrências extraterrestres verificadas/);
});

test('the Bigfoot ranking preserves BFRO report counts without presenting them as proof', () => {
  const ranking = DISCOVER_RANKINGS.find(
    ({ slug }) => slug === 'estados-americanos-mais-relatos-bigfoot',
  );
  assert.ok(ranking);
  assert.equal(ranking.source, 'Bigfoot Field Researchers Organization (BFRO)');
  assert.deepEqual(
    ranking.items.map(({ name, value }) => [name, value]),
    [
      ['Washington', '732 relatos'],
      ['Califórnia', '471 relatos'],
      ['Flórida', '348 relatos'],
      ['Ohio', '335 relatos'],
      ['Illinois', '305 relatos'],
      ['Texas', '264 relatos'],
      ['Oregon', '262 relatos'],
      ['Michigan', '227 relatos'],
      ['Missouri', '168 relatos'],
      ['Geórgia', '147 relatos'],
    ],
  );
  assert.match(ranking.note, /relatos catalogados/);
  assert.match(ranking.note, /não comprovam a existência de Bigfoot/);
});

test('the animal sleep ranking keeps the academic table values and ties', () => {
  const ranking = DISCOVER_RANKINGS.find(({ slug }) => slug === 'animais-que-mais-dormem');
  assert.ok(ranking);
  assert.equal(ranking.source, 'University of Washington — Neuroscience for Kids');
  assert.deepEqual(
    ranking.items.map(({ rank, name, value }) => [rank, name, value]),
    [
      ['1', 'Morcego-marrom', '19,9 horas'],
      ['2', 'Gambá-norte-americano', '19,4 horas'],
      ['3', 'Tatu-canastra', '18,1 horas'],
      ['4', 'Píton', '18,0 horas'],
      ['5', 'Macaco-da-noite', '17,0 horas'],
      ['6', 'Tigre', '15,8 horas'],
      ['6', 'Musaranho-arborícola', '15,8 horas'],
      ['8', 'Esquilo', '14,9 horas'],
      ['9', 'Sapo-ocidental', '14,6 horas'],
      ['10', 'Furão', '14,5 horas'],
    ],
  );
  assert.match(ranking.note, /animais não humanos/);
  assert.match(ranking.note, /adaptada de fontes científicas/);
});

test('the instant noodle ranking uses WINA 2025 demand estimates', () => {
  const ranking = DISCOVER_RANKINGS.find(
    ({ slug }) => slug === 'paises-mais-consomem-macarrao-instantaneo',
  );
  assert.ok(ranking);
  assert.equal(ranking.category, 'Gastronomia');
  assert.equal(ranking.source, 'World Instant Noodles Association (WINA)');
  assert.deepEqual(
    ranking.items.map(({ name, value }) => [name, value]),
    [
      ['China e Hong Kong', '43.268 milhões de porções'],
      ['Indonésia', '14.540 milhões de porções'],
      ['Índia', '9.601 milhões de porções'],
      ['Vietnã', '8.231 milhões de porções'],
      ['Japão', '5.952 milhões de porções'],
      ['Estados Unidos', '5.227 milhões de porções'],
      ['Filipinas', '4.337 milhões de porções'],
      ['Tailândia', '4.195 milhões de porções'],
      ['Coreia do Sul', '4.061 milhões de porções'],
      ['Nigéria', '3.115 milhões de porções'],
    ],
  );
  assert.match(ranking.note, /China e Hong Kong aparecem juntas/);
});

test('the UFO shape ranking excludes non-shape buckets and explains the reports', () => {
  const ranking = DISCOVER_RANKINGS.find(({ slug }) => slug === 'formatos-ovni-mais-relatados');
  assert.ok(ranking);
  assert.equal(ranking.source, 'National UFO Reporting Center (NUFORC)');
  assert.deepEqual(
    ranking.items.map(({ name, value }) => [name, value]),
    [
      ['Luz', '29.408 relatos'],
      ['Círculo', '16.193 relatos'],
      ['Triângulo', '14.404 relatos'],
      ['Bola de fogo', '10.203 relatos'],
      ['Disco', '9.644 relatos'],
      ['Orbe', '8.391 relatos'],
      ['Esfera', '8.336 relatos'],
      ['Oval', '6.959 relatos'],
      ['Formação', '5.210 relatos'],
      ['Forma variável', '4.719 relatos'],
    ],
  );
  assert.match(ranking.note, /excluídos “outro”, “desconhecido” e “não especificado”/);
  assert.match(ranking.note, /não significam eventos extraterrestres verificados/);
});

test('the disguised aliens ranking is explicitly framed as a historical belief poll', () => {
  const ranking = DISCOVER_RANKINGS.find(
    ({ slug }) => slug === 'paises-acreditavam-alienigenas-disfarcados-humanos',
  );
  assert.ok(ranking);
  assert.equal(ranking.source, 'Ipsos / Reuters');
  assert.equal(ranking.period, 'Pesquisa realizada entre novembro de 2009 e janeiro de 2010');
  assert.deepEqual(
    ranking.items.map(({ rank, name, value }) => [rank, name, value]),
    [
      ['1', 'Índia', '45%'],
      ['2', 'China', '42%'],
      ['3', 'Japão', '29%'],
      ['4', 'Coreia do Sul', '27%'],
      ['5', 'Itália', '25%'],
      ['6', 'Estados Unidos', '24%'],
      ['6', 'Brasil', '24%'],
      ['8', 'Austrália', '23%'],
      ['9', 'Rússia', '21%'],
      ['9', 'Espanha', '21%'],
    ],
  );
  assert.match(ranking.note, /Pesquisa histórica/);
  assert.match(ranking.note, /24\.077 adultos de 22 países/);
  assert.match(ranking.note, /mede a crença/);
});

test('the Guinness collection ranking is numerical, sourced and explicit about its curation', () => {
  const ranking = DISCOVER_RANKINGS.find(
    ({ slug }) => slug === 'maiores-colecoes-estranhas-guinness',
  );
  assert.ok(ranking);
  assert.equal(ranking.source, 'Guinness World Records');
  assert.equal(ranking.items.length, 10);
  assert.deepEqual(
    ranking.items.map(({ name, value }) => [name, value]),
    [
      ['Guardanapos', '125.866 itens'],
      ['Marcadores de livro', '103.009 itens'],
      ['Objetos relacionados a gatos', '21.321 itens'],
      ['Porta-ovos', '15.485 itens'],
      ['Placas de “Não Perturbe”', '11.570 itens'],
      ['Dados de jogo', '11.097 itens'],
      ['Copos de dose', '9.670 itens'],
      ['Tijolos', '8.882 itens'],
      ['Sacos para enjoo de avião', '6.290 itens'],
      ['Patos de borracha', '5.631 itens'],
    ],
  );
  assert.match(ranking.note, /Seleção editorial/);
  assert.match(ranking.note, /podem ter crescido depois da verificação/);
});

test('the six expanded categories publish their sourced rankings without duplicates', () => {
  const expectedTitles = new Map([
    ['brasil', { count: 10, title: 'Estados mais populosos do Brasil' }],
    ['cinema-tv', { count: 10, title: 'Séries mais bem avaliadas no IMDb' }],
    ['musica', { count: 13, title: 'Álbuns mais ouvidos da história do Spotify' }],
    ['tecnologia', { count: 10, title: 'Navegadores mais usados no mundo' }],
    ['viagens', { count: 10, title: 'Aeroportos mais movimentados do mundo' }],
    ['gastronomia', { count: 11, title: 'Melhores pizzarias do mundo' }],
  ]);

  for (const [slug, { count, title }] of expectedTitles) {
    const rankings = discoverRankingsForCategory(slug);
    const html = renderDiscoverPage(template, '', slug);
    assert.equal(rankings.length, count, slug);
    assert.equal(new Set(rankings.map((ranking) => ranking.slug)).size, count, slug);
    assert.ok(
      rankings.every((ranking) => ranking.sourceUrl && ranking.period),
      slug,
    );
    assert.ok(
      rankings.every((ranking) => ranking.items.length === 10),
      slug,
    );
    assert.equal((html.match(/class="discoverCard/g) || []).length, count, slug);
    assert.match(html, new RegExp(title));
  }
});

test('every published ranking belongs to exactly one visible editorial category', () => {
  assert.deepEqual(
    DISCOVER_CATEGORIES.map((category) => category.label),
    [
      'Todos',
      'Brasil',
      'Mundo & Geografia',
      'Dinheiro',
      'Celebridades',
      'Esportes',
      'Cinema e TV',
      'Música',
      'Tecnologia & Internet',
      'Viagens',
      'Gastronomia',
    ],
  );
  const appearances = new Map(DISCOVER_RANKINGS.map((ranking) => [ranking.slug, 0]));
  for (const category of DISCOVER_CATEGORIES.filter(({ slug }) => slug !== 'todos')) {
    for (const ranking of discoverRankingsForCategory(category.slug)) {
      appearances.set(ranking.slug, appearances.get(ranking.slug) + 1);
    }
  }
  assert.ok([...appearances.values()].every((count) => count === 1));
});

test('editorial URLs use Rankings and keep Descobrir only as a legacy redirect', () => {
  const detail = renderDiscoverPage(template, 'pessoas-mais-ricas-do-mundo');
  assert.match(detail, /href="\/rankings">← VOLTAR AOS RANKINGS<\/a>/);
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
    /class="discoverArticleMeta"[\s\S]*TOP 10[\s\S]*RANKING INFORMATIVO · SEM VOTAÇÃO/,
  );
  assert.match(html, /class="discoverArticleSummary"[\s\S]*CRITÉRIO[\s\S]*RECORTE/);
  assert.match(
    html,
    /class="discoverRankingSheet"[^>]*>\s*<header class="discoverRankingResultHead"><h2[^>]*>Resultado<\/h2><span>TOP 10 · VALOR<\/span><\/header>\s*<ol>/,
  );
  assert.doesNotMatch(html, /class="discoverArticleVisual"/);
  assert.equal((html.match(/class="discoverRankPosition"/g) || []).length, 10);
  assert.match(html, /Elon Musk/);
  assert.match(html, /US\$ 892 bi/);
  assert.match(html, /1º de setembro de 2026/);
  assert.match(html, /Forbes · forbes\.com/);
  assert.doesNotMatch(html, /class="discoverPodium"/);
  const rankingSheet =
    html.match(/<section class="discoverRankingSheet"[\s\S]*?<\/section>/)?.[0] || '';
  assert.match(rankingSheet, /medal-gold/);
  assert.match(rankingSheet, /medal-silver/);
  assert.match(rankingSheet, /medal-bronze/);
  assert.doesNotMatch(rankingSheet, /OURO|PRATA|BRONZE/);
  assert.equal((html.match(/class="discoverMedalRank"/g) || []).length, 9);
  assert.doesNotMatch(html, /class="react|data-duel/);
  assert.match(
    appSource,
    /feed\.querySelector\('\.discoverArticle'\)[\s\S]*window\.scrollTo\(\{ top: 0, left: 0, behavior: 'auto' \}\)/,
  );
});

test('Ranking Topo publishes the three editorial consensus lists with its seal', () => {
  const rankings = [
    ['maiores-bandas-rock-todos-tempos', 'The Beatles', '93 pontos'],
    ['maiores-idolos-pop-todos-tempos', 'The Beatles', '40 pontos'],
    ['maiores-guitarristas-todos-tempos', 'Jimi Hendrix', '60 pontos'],
  ];

  for (const [slug, leader, points] of rankings) {
    const ranking = DISCOVER_RANKINGS.find((item) => item.slug === slug);
    assert.ok(ranking, slug);
    assert.equal(ranking.topoRanking, true);
    assert.equal(ranking.source, 'Ranking Topo');
    assert.equal(ranking.items.length, 10);
    assert.equal(ranking.items[0].name, leader);
    assert.equal(ranking.items[0].value, points);

    const html = renderDiscoverPage(template, slug);
    assert.equal((html.match(/class="discoverTopoBadge"/g) || []).length, 1);
    assert.match(html, />Ranking Topo<\/strong>/);
  }
});

test('the editorial catalog keeps 110 complete and sourced rankings', () => {
  assert.equal(DISCOVER_RANKINGS.length, 110);
  assert.equal(new Set(DISCOVER_RANKINGS.map(({ slug }) => slug)).size, 110);
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
  assert.match(cssSource, /\.discoverCategoryRail/);
  assert.match(cssSource, /\.discoverCategoryButton\.active/);
  assert.match(cssSource, /\.discoverRankingSheet/);
  assert.match(cssSource, /\.discoverArticleSummary/);
  assert.match(cssSource, /\.discoverTopoBadge/);
  assert.match(cssSource, /Rankings informativos — mesma linguagem das páginas do TOPO/);
  assert.match(
    cssSource,
    /body\.popElectric\.discoverDetailPage \.feed \{[\s\S]*?width: min\(860px, calc\(100% - 48px\)\)/,
  );
  assert.match(
    cssSource,
    /body\.popElectric\.discoverDetailPage \.discoverRankingSheet li,[\s\S]*?grid-template-columns: 34px minmax\(0, 1fr\) auto/,
  );
  assert.match(cssSource, /\.discoverCard\.featured \{[\s\S]*?background: var\(--clean-paper\);/);
  assert.match(cssSource, /\.discoverCard\.featured > a \{[\s\S]*?color: var\(--clean-ink\);/);
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
    /@media \(max-width: 700px\)[\s\S]*body\.popElectric\.discoverDetailPage \.discoverRankingSheet li,[\s\S]*grid-template-columns: 30px minmax\(0, 1fr\)/,
  );
  assert.match(template, /editorial-clean\.css\?[^"']*rankings-topo-layout/);
  assert.match(cssSource, /localMode \.experienceInner \{[\s\S]*?flex-wrap: wrap/);
});
