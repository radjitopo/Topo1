import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { rankingQuestion } from './ranking-titles.js';
import {
  GENERAL_CATEGORIES,
  LOCAL_CITIES,
  generalCategoryBySlug,
  generalCategoryForRanking,
  generalCategoryPath,
  isSeoLocalRanking,
  localCityByLabel,
  localCityBySlug,
  localCollectionPath,
  localGroupBySlug,
  localGroupForRanking,
} from './seo-taxonomy.js';

const templatePromise = readFile(new URL('./index.html', import.meta.url), 'utf8');
const BASE_URL = 'https://somostopo.com.br';
let sqlClient;

function database() {
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
}

export function escapeHtml(value) {
  return String(value || '').replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  );
}

function truncate(value, limit) {
  const text = String(value || '').trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(1, limit - 1)).trimEnd()}…`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

function queryValue(req, key) {
  const value = req.query?.[key];
  return String(Array.isArray(value) ? value[0] || '' : value || '');
}

function safeImageUrl(value) {
  if (!value) return `${BASE_URL}/og-topo-v2.png`;
  try {
    const url = new URL(String(value), BASE_URL);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported_image_protocol');
    if (url.hostname === 'images.unsplash.com') {
      url.searchParams.set('auto', 'format');
      url.searchParams.set('fit', 'crop');
      url.searchParams.set('w', '1200');
      url.searchParams.set('h', '630');
      url.searchParams.set('q', '82');
    }
    return url.toString();
  } catch {
    return `${BASE_URL}/og-topo-v2.png`;
  }
}

function schemaScript(value) {
  if (!value) return '';
  const json = JSON.stringify(value).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${json}</script>`;
}

function schemaGraph(nodes) {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes.filter(Boolean),
  };
}

function breadcrumbSchema(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function seoBlock({
  title,
  description,
  canonical,
  image,
  index = true,
  type = 'website',
  structuredData = null,
}) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeCanonical = escapeHtml(canonical);
  const safeImage = escapeHtml(safeImageUrl(image));

  return `<!-- SEO_START -->
<title>${safeTitle}</title>
<meta name="description" content="${safeDescription}">
<link rel="canonical" href="${safeCanonical}">
<link rel="alternate" hreflang="pt-BR" href="${safeCanonical}">
<link rel="alternate" hreflang="x-default" href="${safeCanonical}">
<meta name="robots" content="${index ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' : 'noindex,follow'}">
<meta property="og:locale" content="pt_BR">
<meta property="og:type" content="${escapeHtml(type)}">
<meta property="og:site_name" content="TOPO">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDescription}">
<meta property="og:url" content="${safeCanonical}">
<meta property="og:image" content="${safeImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${safeTitle}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeDescription}">
<meta name="twitter:image" content="${safeImage}">
<meta name="twitter:image:alt" content="${safeTitle}">
${schemaScript(structuredData)}
<!-- SEO_END -->`;
}

export function withPage(template, { metadata, content, bodyClass = '' }) {
  const withMetadata = template.replace(
    /<!-- SEO_START -->[\s\S]*?<!-- SEO_END -->/,
    seoBlock(metadata),
  );
  return withMetadata
    .replace('<body class="popElectric">', `<body class="popElectric ${escapeHtml(bodyClass)}">`)
    .replace(
      /<main class="wrap feed" id="feed">[\s\S]*?<\/main>/,
      `<main class="wrap feed" id="feed" data-server-rendered="true">${content}</main>`,
    );
}

function rankingCard(ranking) {
  const question = rankingQuestion(ranking.id, ranking.question);
  const category = isSeoLocalRanking(ranking)
    ? localGroupForRanking(ranking)?.label || ranking.category
    : generalCategoryForRanking(ranking)?.label || ranking.category;
  const media = ranking.imageUrl
    ? `<img src="${escapeHtml(ranking.imageUrl)}" alt="" loading="lazy" decoding="async">`
    : '<span class="portalImageFallback">TOPO</span>';
  return `<article class="categoryRankCard seoRankingCard">
    <a class="categoryRankMedia" href="/ranking/${encodeURIComponent(ranking.id)}">${media}</a>
    <div class="categoryRankCopy">
      <div class="categoryRankMeta"><span class="category">${escapeHtml(category)}</span><span>${formatNumber(ranking.voteCount)} votos</span></div>
      <a class="categoryRankTitle" href="/ranking/${encodeURIComponent(ranking.id)}"><h2>${escapeHtml(question)}</h2></a>
      <div class="categoryRankLinks"><a class="categoryVoteCta" href="/ranking/${encodeURIComponent(ranking.id)}">VER RANKING <b>→</b></a></div>
    </div>
  </article>`;
}

function categoryNavigation() {
  return `<nav class="seoTopicLinks" aria-label="Categorias do TOPO">${GENERAL_CATEGORIES.map(
    (category) => `<a href="${generalCategoryPath(category)}">${escapeHtml(category.label)}</a>`,
  ).join('')}</nav>`;
}

function cityNavigation(rankings) {
  const available = new Set(
    rankings.map((ranking) => localCityByLabel(ranking.category)?.label).filter(Boolean),
  );
  return `<nav class="seoTopicLinks seoCityLinks" aria-label="Cidades no TOPO LOCAL">${LOCAL_CITIES.filter(
    (city) => available.has(city.label),
  )
    .map((city) => `<a href="${localCollectionPath(city)}">${escapeHtml(city.label)}</a>`)
    .join('')}</nav>`;
}

function itemListSchema(rankings, name, id) {
  return {
    '@type': 'ItemList',
    '@id': id,
    name,
    numberOfItems: rankings.length,
    itemListElement: rankings.map((ranking, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: rankingQuestion(ranking.id, ranking.question),
      url: `${BASE_URL}/ranking/${encodeURIComponent(ranking.id)}`,
    })),
  };
}

export function renderHomePage(template, rankings, search = '') {
  const publicRankings = rankings.filter((ranking) => !isSeoLocalRanking(ranking));
  const featured = [...publicRankings]
    .sort(
      (a, b) =>
        Number(b.voteCount || 0) - Number(a.voteCount || 0) ||
        new Date(b.createdAt) - new Date(a.createdAt),
    )
    .slice(0, 24);
  const title = search ? `Busca por “${truncate(search, 42)}” — TOPO` : 'TOPO — Tudo vira ranking';
  const description = search
    ? `Resultados e rankings relacionados a ${truncate(search, 80)} no TOPO.`
    : 'Vote, compare e descubra rankings de cultura, comida, lugares, esportes, produtos e muito mais.';
  const canonical = `${BASE_URL}/`;
  const listId = `${canonical}#rankings`;
  const structuredData = schemaGraph([
    {
      '@type': 'Organization',
      '@id': `${BASE_URL}/#organization`,
      name: 'TOPO',
      url: BASE_URL,
      logo: `${BASE_URL}/topo-mark-v3.svg`,
    },
    {
      '@type': 'WebSite',
      '@id': `${BASE_URL}/#website`,
      name: 'TOPO',
      alternateName: 'Tudo vira ranking',
      url: BASE_URL,
      inLanguage: 'pt-BR',
      publisher: { '@id': `${BASE_URL}/#organization` },
    },
    itemListSchema(featured, 'Rankings em destaque no TOPO', listId),
  ]);
  const content = `<section class="categoryLandingHead seoLandingHead">
      <div><span class="portalKicker">Tudo vira ranking</span><h1>Rankings para votar e descobrir</h1><p>${escapeHtml(description)}</p></div>
      <div class="categoryLandingCount"><strong>${formatNumber(publicRankings.length)}</strong><span>rankings</span></div>
    </section>
    ${categoryNavigation()}
    <section class="seoCollection" aria-labelledby="seo-home-rankings"><div class="portalSectionHead"><div><span>ESCOLHA UMA DISPUTA</span><h2 id="seo-home-rankings">Rankings em destaque</h2></div></div><div class="categoryRankGrid">${featured.map(rankingCard).join('')}</div></section>
    <noscript><p class="seoNoScript">Você pode consultar os rankings sem JavaScript. Para votar e ver resultados em tempo real, ative o JavaScript do navegador.</p></noscript>`;
  return withPage(template, {
    metadata: {
      title,
      description,
      canonical,
      index: !search,
      image: `${BASE_URL}/og-topo-v2.png`,
      structuredData,
    },
    content,
    bodyClass: 'homePage',
  });
}

export function renderGeneralCategoryPage(template, category, rankings, search = '') {
  const selected = rankings
    .filter(
      (ranking) =>
        !isSeoLocalRanking(ranking) && generalCategoryForRanking(ranking)?.slug === category.slug,
    )
    .sort(
      (a, b) =>
        Number(b.voteCount || 0) - Number(a.voteCount || 0) ||
        new Date(b.createdAt) - new Date(a.createdAt),
    );
  const canonical = `${BASE_URL}${generalCategoryPath(category)}`;
  const title = `${category.label}: rankings para votar — TOPO`;
  const description = truncate(
    `${category.description} Veja resultados atualizados e participe das disputas no TOPO.`,
    158,
  );
  const listId = `${canonical}#rankings`;
  const structuredData = schemaGraph([
    {
      '@type': 'CollectionPage',
      '@id': canonical,
      name: title,
      description,
      url: canonical,
      inLanguage: 'pt-BR',
      isPartOf: { '@id': `${BASE_URL}/#website` },
      mainEntity: { '@id': listId },
    },
    breadcrumbSchema([
      { name: 'TOPO', url: BASE_URL },
      { name: category.label, url: canonical },
    ]),
    itemListSchema(selected, `Rankings de ${category.label}`, listId),
  ]);
  const content = `<section class="categoryLandingHead seoLandingHead">
      <div><span class="portalKicker">Categoria</span><h1>${escapeHtml(category.label)}</h1><p>${escapeHtml(category.description)}</p></div>
      <div class="categoryLandingCount"><strong>${formatNumber(selected.length)}</strong><span>rankings</span></div>
    </section>
    ${categoryNavigation()}
    <section class="categoryRankGrid">${selected.slice(0, 36).map(rankingCard).join('')}</section>`;
  return {
    html: withPage(template, {
      metadata: {
        title,
        description,
        canonical,
        index: !search && selected.length > 0,
        image:
          selected.find((ranking) => ranking.imageUrl)?.imageUrl || `${BASE_URL}/og-topo-v2.png`,
        structuredData,
      },
      content,
      bodyClass: 'homePage',
    }),
    count: selected.length,
  };
}

export function renderLocalPage(template, rankings, city = null, group = null, search = '') {
  const localRankings = rankings.filter(isSeoLocalRanking);
  const selected = localRankings
    .filter((ranking) => !city || localCityByLabel(ranking.category)?.slug === city.slug)
    .filter((ranking) => !group || localGroupForRanking(ranking)?.slug === group.slug)
    .sort(
      (a, b) =>
        Number(b.voteCount || 0) - Number(a.voteCount || 0) ||
        new Date(b.createdAt) - new Date(a.createdAt),
    );
  const canonicalPath = city ? localCollectionPath(city, group) : '/local';
  const canonical = `${BASE_URL}${canonicalPath}`;
  const heading =
    group && city
      ? `${group.label} em ${city.label}`
      : city
        ? `Rankings em ${city.label}`
        : 'TOPO LOCAL';
  const title =
    group && city
      ? `${group.label} em ${city.label} — TOPO LOCAL`
      : city
        ? `Melhores de ${city.label}: rankings locais — TOPO`
        : 'TOPO LOCAL — rankings da sua cidade';
  const description = truncate(
    group && city
      ? `${group.description} Veja o ranking atualizado de ${city.label} e vote nos seus preferidos.`
      : city
        ? `Descubra e vote nos melhores restaurantes, cafés, serviços e lugares de ${city.label} no TOPO LOCAL.`
        : 'Vote nos melhores restaurantes, pizzarias, cafés, serviços e lugares das maiores cidades brasileiras.',
    158,
  );
  const listId = `${canonical}#rankings`;
  const breadcrumbs = [
    { name: 'TOPO', url: BASE_URL },
    { name: 'TOPO LOCAL', url: `${BASE_URL}/local` },
  ];
  if (city) breadcrumbs.push({ name: city.label, url: `${BASE_URL}${localCollectionPath(city)}` });
  if (group) breadcrumbs.push({ name: group.label, url: canonical });
  const structuredData = schemaGraph([
    {
      '@type': 'CollectionPage',
      '@id': canonical,
      name: title,
      description,
      url: canonical,
      inLanguage: 'pt-BR',
      isPartOf: { '@id': `${BASE_URL}/#website` },
      mainEntity: { '@id': listId },
    },
    breadcrumbSchema(breadcrumbs),
    itemListSchema(selected, heading, listId),
  ]);
  const content = `<section class="categoryLandingHead localCatalogHead seoLandingHead">
      <div><span class="portalKicker">${city ? `${escapeHtml(city.label)} no TOPO` : 'Escolha sua cidade'}</span><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(description)}</p></div>
      <div class="categoryLandingCount"><strong>${formatNumber(selected.length)}</strong><span>${city ? 'na cidade' : 'rankings locais'}</span></div>
    </section>
    ${cityNavigation(localRankings)}
    <section class="categoryRankGrid">${selected.slice(0, 36).map(rankingCard).join('')}</section>`;
  return {
    html: withPage(template, {
      metadata: {
        title,
        description,
        canonical,
        index: !search && selected.length > 0,
        image:
          selected.find((ranking) => ranking.imageUrl)?.imageUrl || `${BASE_URL}/og-topo-v2.png`,
        structuredData,
      },
      content,
      bodyClass: 'homePage localMode',
    }),
    count: selected.length,
  };
}

export function renderRankingPage(template, ranking) {
  const question = rankingQuestion(ranking.id, ranking.question);
  const canonical = `${BASE_URL}/ranking/${encodeURIComponent(ranking.id)}`;
  const localCity = localCityByLabel(ranking.category);
  const localGroup = localGroupForRanking(ranking);
  const generalCategory = generalCategoryForRanking(ranking);
  const categoryName =
    localCity && localGroup
      ? `${localGroup.label} em ${localCity.label}`
      : generalCategory?.label || ranking.category;
  const categoryPath =
    localCity && localGroup
      ? localCollectionPath(localCity, localGroup)
      : generalCategoryPath(generalCategory);
  const options = ranking.options.slice(0, 10);
  const title = `${truncate(question, 58)} — TOPO`;
  const description = truncate(
    `Confira o resultado atualizado de “${question}”, veja o Top ${options.length} e vote para mudar a ordem no TOPO.`,
    158,
  );
  const listId = `${canonical}#resultado`;
  const structuredData = schemaGraph([
    {
      '@type': 'WebPage',
      '@id': canonical,
      name: question,
      description,
      url: canonical,
      inLanguage: 'pt-BR',
      datePublished: ranking.createdAt,
      dateModified: ranking.updatedAt || ranking.createdAt,
      image: safeImageUrl(ranking.imageUrl),
      isPartOf: { '@id': `${BASE_URL}/#website` },
      mainEntity: { '@id': listId },
    },
    breadcrumbSchema([
      { name: 'TOPO', url: BASE_URL },
      { name: categoryName, url: `${BASE_URL}${categoryPath}` },
      { name: question, url: canonical },
    ]),
    {
      '@type': 'ItemList',
      '@id': listId,
      name: question,
      numberOfItems: ranking.options.length,
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      itemListElement: options.map((option, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: { '@type': 'Thing', name: option.label },
      })),
    },
  ]);
  const optionRows = options
    .map(
      (option, index) => `<div class="option seoOption">
        <div class="pos">${index + 1}</div>
        <div><div class="name">${escapeHtml(option.label)}</div><div class="score">${formatNumber(option.score)} ponto${Number(option.score) === 1 ? '' : 's'} · ${index + 1}º lugar</div></div>
        <span class="seoPosition" aria-label="${index + 1}º lugar">#${index + 1}</span>
      </div>`,
    )
    .join('');
  const content = `<nav class="seoBreadcrumb" aria-label="Navegação estrutural"><a href="/">TOPO</a><span>›</span><a href="${categoryPath}">${escapeHtml(categoryName)}</a></nav>
    <article class="rank rankingMain seoRankingMain" id="votar">
      <div class="rankHead"><a class="category" href="${categoryPath}">${escapeHtml(categoryName)}</a><span class="total">Top ${options.length}</span></div>
      <h1>${escapeHtml(question)}</h1>
      ${ranking.imageUrl ? `<div class="imageStrip"><img src="${escapeHtml(ranking.imageUrl)}" alt="${escapeHtml(question)}" decoding="async"></div>` : ''}
      <div class="rankingResultHead"><span>Resultado atual</span><strong>${formatNumber(ranking.voteCount)} votos</strong></div>
      <div class="options" id="resultado">${optionRows}</div>
      <p class="seoRankingNote">A ordem é atualizada pelos votos da comunidade. Entre no ranking para apoiar ou rebaixar qualquer opção.</p>
    </article>
    <noscript><p class="seoNoScript">O resultado está disponível acima. Para votar e acompanhar mudanças em tempo real, ative o JavaScript do navegador.</p></noscript>`;
  return withPage(template, {
    metadata: {
      title,
      description,
      canonical,
      image: ranking.imageUrl,
      type: 'website',
      structuredData,
    },
    content,
    bodyClass: 'rankingPage',
  });
}

async function fetchRankingSummaries(sql) {
  const rows = await sql.query(`
    WITH live_vote_activity AS (
      SELECT
        option.ranking_id,
        COUNT(vote.option_id)::int AS live_votes,
        MAX(vote.updated_at) AS last_vote_at
      FROM ranking_options option
      LEFT JOIN votes vote ON vote.option_id = option.id
      GROUP BY option.ranking_id
    ),
    double_vote_activity AS (
      SELECT
        option.ranking_id,
        MAX(double_vote.updated_at) AS last_double_vote_at
      FROM ranking_options option
      LEFT JOIN user_double_votes double_vote ON double_vote.option_id = option.id
      GROUP BY option.ranking_id
    )
    SELECT
      ranking.id,
      ranking.category,
      ranking.question,
      ranking.image_url,
      ranking.created_at,
      (ranking.baseline_votes + COALESCE(live.live_votes, 0))::int AS vote_count,
      GREATEST(
        ranking.created_at,
        COALESCE(live.last_vote_at, ranking.created_at),
        COALESCE(double_activity.last_double_vote_at, ranking.created_at)
      ) AS updated_at
    FROM rankings ranking
    LEFT JOIN live_vote_activity live ON live.ranking_id = ranking.id
    LEFT JOIN double_vote_activity double_activity ON double_activity.ranking_id = ranking.id
    WHERE ranking.is_active = true
    ORDER BY ranking.created_at DESC, ranking.id
  `);
  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    question: rankingQuestion(row.id, row.question),
    imageUrl: row.image_url || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    voteCount: Number(row.vote_count || 0),
  }));
}

async function fetchRanking(sql, id) {
  const rows = await sql.query(
    `
      WITH vote_totals AS (
        SELECT
          option_id,
          COALESCE(SUM(direction), 0)::int AS score_delta,
          COUNT(*)::int AS live_votes,
          MAX(updated_at) AS last_vote_at
        FROM votes
        GROUP BY option_id
      ),
      double_vote_totals AS (
        SELECT
          option_id,
          COALESCE(SUM(direction), 0)::int AS score_delta,
          MAX(updated_at) AS last_vote_at
        FROM user_double_votes
        GROUP BY option_id
      )
      SELECT
        ranking.id,
        ranking.category,
        ranking.question,
        ranking.image_url,
        ranking.baseline_votes,
        ranking.created_at,
        option.id AS option_id,
        option.label,
        option.position,
        option.baseline_score
          + COALESCE(vote.score_delta, 0)::int
          + COALESCE(double_vote.score_delta, 0)::int AS score,
        COALESCE(vote.live_votes, 0)::int AS live_votes,
        GREATEST(
          ranking.created_at,
          COALESCE(vote.last_vote_at, ranking.created_at),
          COALESCE(double_vote.last_vote_at, ranking.created_at)
        ) AS updated_at
      FROM rankings ranking
      JOIN ranking_options option ON option.ranking_id = ranking.id
      LEFT JOIN vote_totals vote ON vote.option_id = option.id
      LEFT JOIN double_vote_totals double_vote ON double_vote.option_id = option.id
      WHERE ranking.id = $1
        AND ranking.is_active = true
      ORDER BY score DESC, option.position
    `,
    [id],
  );
  if (!rows.length) return null;
  const first = rows[0];
  return {
    id: first.id,
    category: first.category,
    question: rankingQuestion(first.id, first.question),
    imageUrl: first.image_url || null,
    createdAt: first.created_at,
    updatedAt: rows.reduce(
      (latest, row) =>
        new Date(row.updated_at || row.created_at) > new Date(latest)
          ? row.updated_at || row.created_at
          : latest,
      first.updated_at || first.created_at,
    ),
    voteCount:
      Number(first.baseline_votes || 0) +
      rows.reduce((total, row) => total + Number(row.live_votes || 0), 0),
    options: rows.map((row) => ({
      id: Number(row.option_id),
      label: row.label,
      position: Number(row.position),
      score: Number(row.score || 0),
    })),
  };
}

function privatePageMetadata(kind) {
  return (
    {
      entrar: ['Entrar — TOPO', 'Entre no TOPO com um código enviado por e-mail.'],
      perfil: ['Perfil — TOPO', 'Acesse seu perfil, seus votos e suas conquistas no TOPO.'],
      moderacao: ['Moderação — TOPO', 'Área privada de moderação do TOPO.'],
      'recuperar-senha': ['Acesso — TOPO', 'Recupere o acesso à sua conta no TOPO.'],
      'redefinir-senha': ['Acesso — TOPO', 'Conclua a recuperação de acesso à sua conta no TOPO.'],
      'sso-callback': ['Concluindo acesso — TOPO', 'Concluindo seu acesso seguro ao TOPO.'],
    }[kind] || ['Área da conta — TOPO', 'Área da conta no TOPO.']
  );
}

function renderPrivatePage(template, kind) {
  const [title, description] = privatePageMetadata(kind);
  return withPage(template, {
    metadata: {
      title,
      description,
      canonical: `${BASE_URL}/${encodeURIComponent(kind)}`,
      image: `${BASE_URL}/og-topo-v2.png`,
      index: false,
    },
    content: '<div class="loading">carregando…</div>',
    bodyClass: kind === 'perfil' ? 'profilePage' : kind === 'moderacao' ? 'moderationPage' : '',
  });
}

function renderMissingPage(template, title = 'Página não encontrada — TOPO') {
  return withPage(template, {
    metadata: {
      title,
      description: 'Esta página não está disponível. Descubra outros rankings no TOPO.',
      canonical: BASE_URL,
      image: `${BASE_URL}/og-topo-v2.png`,
      index: false,
    },
    content:
      '<section class="portalEmpty"><span class="portalKicker">404</span><h1>Página não encontrada.</h1><p>Este endereço não está disponível.</p><a class="categoryVoteCta" href="/">Ver todos os rankings →</a></section>',
  });
}

function sendHtml(res, status, html, { cache = true, index = true } = {}) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Language', 'pt-BR');
  res.setHeader(
    'Cache-Control',
    cache ? 'public, s-maxage=300, stale-while-revalidate=86400' : 'private, no-store',
  );
  if (!index) res.setHeader('X-Robots-Tag', 'noindex, follow');
  return res.status(status).send(html);
}

export default async function handler(req, res) {
  const template = await templatePromise;
  const view = queryValue(req, 'view');
  const search = queryValue(req, 'busca').trim().slice(0, 100);

  if (view === 'private') {
    return sendHtml(res, 200, renderPrivatePage(template, queryValue(req, 'kind')), {
      cache: false,
      index: false,
    });
  }

  if (view === 'not-found') {
    return sendHtml(res, 404, renderMissingPage(template), { cache: false, index: false });
  }

  try {
    const sql = database();
    if (view === 'home') {
      const rankings = await fetchRankingSummaries(sql);
      return sendHtml(res, 200, renderHomePage(template, rankings, search), { index: !search });
    }

    if (view === 'category') {
      const category = generalCategoryBySlug(queryValue(req, 'category'));
      if (!category)
        return sendHtml(res, 404, renderMissingPage(template), { cache: false, index: false });
      const rankings = await fetchRankingSummaries(sql);
      const rendered = renderGeneralCategoryPage(template, category, rankings, search);
      if (!rendered.count) return sendHtml(res, 404, rendered.html, { cache: false, index: false });
      return sendHtml(res, 200, rendered.html, { index: !search });
    }

    if (view === 'local') {
      const rawCity = queryValue(req, 'city');
      const rawGroup = queryValue(req, 'local_category');
      const city = rawCity ? localCityBySlug(rawCity) : null;
      const group = rawGroup ? localGroupBySlug(rawGroup) : null;
      if ((rawCity && !city) || (rawGroup && !group) || (group && !city))
        return sendHtml(res, 404, renderMissingPage(template), { cache: false, index: false });
      const rankings = await fetchRankingSummaries(sql);
      const rendered = renderLocalPage(template, rankings, city, group, search);
      if (!rendered.count) return sendHtml(res, 404, rendered.html, { cache: false, index: false });
      return sendHtml(res, 200, rendered.html, { index: !search });
    }

    const id = queryValue(req, 'id').slice(0, 120);
    const ranking = await fetchRanking(sql, id);
    if (!ranking)
      return sendHtml(res, 404, renderMissingPage(template, 'Ranking não encontrado — TOPO'), {
        cache: false,
        index: false,
      });
    return sendHtml(res, 200, renderRankingPage(template, ranking));
  } catch (error) {
    console.error('Public page rendering failed', error);
    const html = withPage(template, {
      metadata: {
        title: 'TOPO temporariamente indisponível',
        description: 'O TOPO está sendo atualizado. Tente novamente em alguns instantes.',
        canonical: BASE_URL,
        image: `${BASE_URL}/og-topo-v2.png`,
        index: false,
      },
      content:
        '<section class="portalEmpty"><h1>Voltamos em instantes.</h1><p>Não foi possível carregar os rankings agora.</p><a class="categoryVoteCta" href="/">Tentar novamente →</a></section>',
    });
    res.setHeader('Retry-After', '60');
    return sendHtml(res, 503, html, { cache: false, index: false });
  }
}
