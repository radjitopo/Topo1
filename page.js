import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { resolveRankingCover } from './ranking-image-policy.js';
import { rankingQuestion } from './ranking-titles.js';
import {
  FOOTBALL_TEAMS_CATEGORY_PATH,
  GENERAL_CATEGORIES,
  LOCAL_CITIES,
  foldSeoText,
  generalCategoryBySlug,
  generalCategoryForRanking,
  generalCategoryPath,
  isClubPlayerRanking,
  isSeoLocalRanking,
  localCityByLabel,
  localCityBySlug,
  localCollectionPath,
  localGroupBySlug,
  localGroupForRanking,
} from './seo-taxonomy.js';

const templatePromise = readFile(new URL('./index.html', import.meta.url), 'utf8');
const BASE_URL = 'https://somostopo.com.br';
const LOCAL_CITY_LABELS = Object.freeze(LOCAL_CITIES.map((city) => city.label));
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

function whatsAppShare(ranking) {
  const path = `/ranking/${encodeURIComponent(ranking.id)}`;
  const leader = ranking.options?.[0]?.label || '';
  const text = `*${rankingQuestion(ranking.id, ranking.question)}*\n${leader ? `🥇 ${leader} está no topo agora.\n` : ''}Vote e mude o ranking no TOPO:\n${BASE_URL}${path}`;
  const href = `https://wa.me/?text=${encodeURIComponent(text)}`;
  return `<a class="whatsappShare compact" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" aria-label="Compartilhar ${escapeHtml(rankingQuestion(ranking.id, ranking.question))} no WhatsApp"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12.04 2C6.53 2 2.06 6.36 2.06 11.74c0 1.71.46 3.39 1.34 4.86L2 22l5.56-1.36a10.18 10.18 0 0 0 4.48 1.03h.01c5.5 0 9.98-4.37 9.98-9.74C22.02 6.36 17.55 2 12.04 2Zm0 17.77c-1.42 0-2.81-.37-4.03-1.07l-.29-.17-3.3.8.88-3.13-.19-.3a7.6 7.6 0 0 1-1.22-4.16c0-4.31 3.65-7.82 8.15-7.82 4.49 0 8.14 3.51 8.14 7.82 0 4.31-3.65 7.82-8.14 7.82Zm4.47-5.86c-.24-.12-1.45-.69-1.68-.77-.23-.08-.4-.12-.57.12-.16.24-.64.77-.79.93-.14.16-.29.18-.53.06-.25-.12-1.04-.37-1.98-1.18-.73-.63-1.23-1.42-1.37-1.66-.14-.24-.02-.37.11-.49.11-.11.24-.28.37-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.57-1.32-.78-1.81-.2-.47-.41-.41-.57-.42h-.48c-.16 0-.43.06-.65.3-.22.24-.85.81-.85 1.97s.87 2.29.99 2.45c.12.16 1.71 2.52 4.14 3.53.58.24 1.03.38 1.38.49.58.18 1.11.15 1.53.09.47-.07 1.45-.57 1.65-1.13.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.47-.28Z"></path></svg></a>`;
}

function nativeShare(ranking) {
  const question = escapeHtml(rankingQuestion(ranking.id, ranking.question));
  return `<button class="nativeShare compact" type="button" data-native-share="${escapeHtml(ranking.id)}" title="Instagram e outros" aria-label="Compartilhar ${question} no Instagram ou em outro aplicativo"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 11v8h14v-8"></path></svg></button>`;
}

function shareActions(ranking) {
  return `<span class="shareActions compact" role="group" aria-label="Opções para compartilhar">${whatsAppShare(ranking)}${nativeShare(ranking)}</span>`;
}

function queryValue(req, key) {
  const value = req.query?.[key];
  return String(Array.isArray(value) ? value[0] || '' : value || '');
}

export function sharedDuelForRanking(value, ranking) {
  const match = String(value || '').match(/^(\d+)-(\d+)$/);
  if (!match || match[1] === match[2]) return null;
  const optionsById = new Map(
      (ranking?.options || []).map((option) => [Number(option.id), option]),
    ),
    shared = match.slice(1).map((optionId) => optionsById.get(Number(optionId)));
  return shared.length === 2 && shared.every(Boolean) ? shared : null;
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
    : isClubPlayerRanking(ranking)
      ? 'Times'
      : generalCategoryForRanking(ranking)?.label || ranking.category;
  const path = `/ranking/${encodeURIComponent(ranking.id)}`;
  const media = ranking.imageUrl
    ? `<img src="${escapeHtml(ranking.imageUrl)}" alt="" loading="lazy" decoding="async">`
    : '<span class="portalImageFallback">TOPO</span>';
  const preview = (ranking.options || [])
    .slice(0, 3)
    .map(
      (option, index) => `<div class="categoryVoteOption">
        <span class="categoryVotePos">${index + 1}</span>
        <a class="categoryVoteName" href="${path}#votar"><strong>${escapeHtml(option.label)}</strong></a>
        <span class="actions categoryVoteActions"><a class="react up seoPreviewReact" href="${path}#votar" aria-label="Abrir o ranking para fazer ${escapeHtml(option.label)} subir">↑</a><a class="react down seoPreviewReact" href="${path}#votar" aria-label="Abrir o ranking para fazer ${escapeHtml(option.label)} descer">↓</a></span>
      </div>`,
    )
    .join('');
  return `<article class="categoryRankCard seoRankingCard" data-ranking-id="${escapeHtml(ranking.id)}">
    <div class="categoryRankMedia">
      <a class="categoryRankImageLink" href="${path}" aria-label="Abrir ${escapeHtml(question)}">${media}</a>
      <div class="categoryRankOverlay"><div class="categoryRankMeta"><span class="category">${escapeHtml(category)}</span></div><a class="categoryRankTitle" href="${path}"><h2>${escapeHtml(question)}</h2></a></div>
    </div>
    <div class="categoryVoteList" aria-label="Três primeiros itens de ${escapeHtml(question)}">${preview}</div>
    <div class="categoryRankLinks categoryRankFooter">${shareActions(ranking)}<a class="categoryVoteCta" href="${path}#votar">VER RANKING <b>→</b></a></div>
  </article>`;
}

function categoryNavigation() {
  return `<nav class="seoTopicLinks" aria-label="Categorias do TOPO">${GENERAL_CATEGORIES.map(
    (category) => `<a href="${generalCategoryPath(category)}">${escapeHtml(category.label)}</a>`,
  ).join('')}</nav>`;
}

function footballCategoryTabs(section, teamCount) {
  const teamsActive = section === 'times';
  return `<nav class="footballCategoryTabs" aria-label="Seções de futebol"><a class="${teamsActive ? '' : 'active'}" href="/categoria/esporte" ${teamsActive ? '' : 'aria-current="page"'}>Geral</a><a class="${teamsActive ? 'active' : ''}" href="${FOOTBALL_TEAMS_CATEGORY_PATH}" ${teamsActive ? 'aria-current="page"' : ''}>Times <span>${formatNumber(teamCount)}</span></a></nav>`;
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

function searchSingular(word) {
  if (word.endsWith('oes') && word.length > 4) return word.slice(0, -3) + 'ao';
  if (word.endsWith('aes') && word.length > 3) return word.slice(0, -3) + 'ao';
  if (word.endsWith('ais') && word.length > 4) return word.slice(0, -3) + 'al';
  if (word.endsWith('eis') && word.length > 4) return word.slice(0, -3) + 'el';
  if (word.endsWith('ois') && word.length > 4) return word.slice(0, -3) + 'ol';
  if (word.endsWith('ns') && word.length > 3) return word.slice(0, -2) + 'm';
  if (word.endsWith('es') && word.length > 4 && /[rzs]/.test(word.at(-3))) {
    return word.slice(0, -2);
  }
  if (word.endsWith('s') && word.length > 3) return word.slice(0, -1);
  return word;
}

function searchTerms(value) {
  return foldSeoText(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(searchSingular);
}

function rankingMatchesSearch(ranking, search) {
  const needles = searchTerms(search);
  if (!needles.length) return true;
  const words = searchTerms(
    [
      String(ranking.id || '').replace(/-/g, ' '),
      rankingQuestion(ranking.id, ranking.question),
      ranking.category,
      ranking.searchText,
      ...(ranking.options || []).map((option) => option.label),
    ].join(' '),
  );
  return needles.every((needle) => words.some((word) => word.includes(needle)));
}

export function renderHomePage(template, rankings, search = '', searchCity = 'Florianópolis') {
  const city =
    (typeof searchCity === 'string'
      ? localCityByLabel(searchCity) || localCityBySlug(searchCity)
      : searchCity) || localCityByLabel('Florianópolis');
  const publicRankings = rankings.filter(
    (ranking) =>
      !ranking.isVip &&
      !ranking.is_vip &&
      !isSeoLocalRanking(ranking) &&
      !isClubPlayerRanking(ranking),
  );
  const searchRankings = search
    ? rankings.filter(
        (ranking) =>
          !ranking.isVip &&
          !ranking.is_vip &&
          (!isSeoLocalRanking(ranking) || localCityByLabel(ranking.category)?.slug === city.slug) &&
          rankingMatchesSearch(ranking, search),
      )
    : publicRankings;
  const featured = [...searchRankings]
    .sort(
      (a, b) =>
        Number(b.voteCount || 0) - Number(a.voteCount || 0) ||
        new Date(b.createdAt) - new Date(a.createdAt),
    )
    .slice(0, search ? 36 : 24);
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
      logo: `${BASE_URL}/topo-mark-v4.svg`,
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
  const content = search
    ? `<section class="searchResultsHead seoSearchResultsHead"><div><span class="portalKicker">TOPO + TOPO LOCAL · ${escapeHtml(city.label)}</span><h1>Resultados para “${escapeHtml(search)}”</h1><p>${formatNumber(searchRankings.length)} ranking${searchRankings.length === 1 ? ' encontrado' : 's encontrados'} em todo o TOPO e nos rankings locais de ${escapeHtml(city.label)}.</p></div><a class="categoryVoteCta" href="/">Limpar busca</a></section>${
        featured.length
          ? `<section class="searchRankList">${featured.map(rankingCard).join('')}</section>`
          : '<section class="portalEmpty"><h2>Nenhum ranking encontrado.</h2><p>Tente outro termo ou volte a ver todos os temas.</p></section>'
      }`
    : `<section class="categoryLandingHead seoLandingHead">
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

export function renderGeneralCategoryPage(template, category, rankings, search = '', section = '') {
  const categoryRankings = rankings
      .filter(
        (ranking) =>
          !ranking.isVip &&
          !ranking.is_vip &&
          !isSeoLocalRanking(ranking) &&
          generalCategoryForRanking(ranking)?.slug === category.slug,
      )
      .sort(
        (a, b) =>
          Number(b.voteCount || 0) - Number(a.voteCount || 0) ||
          new Date(b.createdAt) - new Date(a.createdAt),
      ),
    teamsSection = category.slug === 'esporte' && section === 'times',
    teamCount = categoryRankings.filter(isClubPlayerRanking).length,
    selected =
      category.slug === 'esporte'
        ? categoryRankings.filter((ranking) =>
            teamsSection ? isClubPlayerRanking(ranking) : !isClubPlayerRanking(ranking),
          )
        : categoryRankings,
    canonicalPath = teamsSection ? FOOTBALL_TEAMS_CATEGORY_PATH : generalCategoryPath(category),
    canonical = `${BASE_URL}${canonicalPath}`,
    pageLabel = teamsSection ? 'Times' : category.label,
    title = teamsSection
      ? 'Times: os melhores jogadores de cada clube — TOPO'
      : `${category.label}: rankings para votar — TOPO`,
    categoryDescription = teamsSection
      ? 'Os melhores jogadores da história de cada clube, reunidos numa seção própria.'
      : category.description;
  const description = truncate(
    `${categoryDescription} Veja resultados atualizados e participe das disputas no TOPO.`,
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
      ...(teamsSection
        ? [
            { name: category.label, url: `${BASE_URL}${generalCategoryPath(category)}` },
            { name: pageLabel, url: canonical },
          ]
        : [{ name: category.label, url: canonical }]),
    ]),
    itemListSchema(selected, `Rankings de ${pageLabel}`, listId),
  ]);
  const content = `<section class="categoryLandingHead seoLandingHead">
      <div><span class="portalKicker">${teamsSection ? 'Futebol' : 'Categoria'}</span><h1>${escapeHtml(pageLabel)}</h1><p>${escapeHtml(categoryDescription)}</p></div>
      <div class="categoryLandingCount"><strong>${formatNumber(selected.length)}</strong><span>rankings</span></div>
    </section>
    ${category.slug === 'esporte' ? footballCategoryTabs(section, teamCount) : categoryNavigation()}
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
  const localRankings = rankings.filter(
    (ranking) => !ranking.isVip && !ranking.is_vip && isSeoLocalRanking(ranking),
  );
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

export function renderRankingPage(template, ranking, sharedDuel = null) {
  const question = rankingQuestion(ranking.id, ranking.question);
  const canonical = `${BASE_URL}/ranking/${encodeURIComponent(ranking.id)}`;
  const localCity = localCityByLabel(ranking.category);
  const localGroup = localGroupForRanking(ranking);
  const generalCategory = generalCategoryForRanking(ranking);
  const clubPlayerRanking = isClubPlayerRanking(ranking);
  const categoryName =
    localCity && localGroup
      ? `${localGroup.label} em ${localCity.label}`
      : clubPlayerRanking
        ? 'Times'
        : generalCategory?.label || ranking.category;
  const categoryPath =
    localCity && localGroup
      ? localCollectionPath(localCity, localGroup)
      : clubPlayerRanking
        ? FOOTBALL_TEAMS_CATEGORY_PATH
        : generalCategoryPath(generalCategory);
  const options = ranking.options.slice(0, 10);
  const hasSharedDuel = Array.isArray(sharedDuel) && sharedDuel.length === 2,
    versus = hasSharedDuel ? `${sharedDuel[0].label} × ${sharedDuel[1].label}` : '',
    title = hasSharedDuel
      ? `${truncate(versus, 58)} — Duelo do Topo`
      : `${truncate(question, 58)} — TOPO`,
    description = truncate(
      hasSharedDuel
        ? `Escolha entre ${versus} e comece uma nova partida neste ranking do TOPO exatamente por este duelo.`
        : `Confira o resultado atualizado de “${question}”, veja o Top ${options.length} e vote para mudar a ordem no TOPO.`,
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
      index: !hasSharedDuel,
      structuredData,
    },
    content,
    bodyClass: 'rankingPage',
  });
}

export function renderVipRankingPage(template, ranking) {
  const question = rankingQuestion(ranking.id, ranking.question);
  const canonical = `${BASE_URL}/ranking/${encodeURIComponent(ranking.id)}`;
  const content = `<section class="vipGate vipGateServer"><span class="vipGateIcon" aria-hidden="true">🔒</span><span class="portalKicker">Meu Topo</span><h1>${escapeHtml(question)}</h1><p>Este ranking é protegido. Digite a senha para ver as opções e votar.</p><div class="vipGateLoading">Preparando o acesso seguro…</div><noscript><p>Ative o JavaScript para informar a senha deste ranking.</p></noscript></section>`;
  return withPage(template, {
    metadata: {
      title: `Ranking do Meu Topo — TOPO`,
      description: 'Ranking protegido por senha no Meu Topo.',
      canonical,
      image: `${BASE_URL}/og-topo-v2.png`,
      index: false,
    },
    content,
    bodyClass: 'rankingPage vipPage',
  });
}

async function fetchRankingSummaries(sql, { scope = 'all', city = '' } = {}) {
  const rows = await sql.query(
    `
    WITH eligible_rankings AS MATERIALIZED (
      SELECT ranking.*
      FROM rankings ranking
      WHERE ranking.is_active = true
        AND ranking.is_vip = false
        AND (
          $1::text = 'all'
          OR ($1::text = 'general' AND NOT (ranking.category = ANY($3::text[])))
          OR ($1::text = 'local' AND ranking.category = ANY($3::text[]))
          OR ($1::text = 'city' AND ranking.category = $2::text)
          OR (
            $1::text = 'search'
            AND (
              NOT (ranking.category = ANY($3::text[]))
              OR ranking.category = $2::text
            )
          )
        )
    ),
    vote_totals AS (
      SELECT
        vote.option_id,
        COUNT(*)::int AS live_votes,
        COALESCE(SUM(vote.direction), 0)::int AS score_delta,
        MAX(vote.updated_at) AS last_vote_at
      FROM votes vote
      JOIN ranking_options option ON option.id = vote.option_id
      JOIN eligible_rankings ranking ON ranking.id = option.ranking_id
      GROUP BY vote.option_id
    ),
    double_vote_totals AS (
      SELECT
        double_vote.option_id,
        COALESCE(SUM(double_vote.direction), 0)::int AS score_delta,
        MAX(double_vote.updated_at) AS last_double_vote_at
      FROM user_double_votes double_vote
      JOIN ranking_options option ON option.id = double_vote.option_id
      JOIN eligible_rankings ranking ON ranking.id = option.ranking_id
      GROUP BY double_vote.option_id
    ),
    option_scores AS (
      SELECT
        option.ranking_id,
        option.id,
        option.label,
        option.position,
        option.baseline_score
          + COALESCE(vote.score_delta, 0)::int
          + COALESCE(double_vote.score_delta, 0)::int AS score,
        COALESCE(vote.live_votes, 0)::int AS live_votes,
        vote.last_vote_at,
        double_vote.last_double_vote_at,
        ROW_NUMBER() OVER (
          PARTITION BY option.ranking_id
          ORDER BY
            option.baseline_score
              + COALESCE(vote.score_delta, 0)::int
              + COALESCE(double_vote.score_delta, 0)::int DESC,
            option.position
        ) AS rank_position
      FROM eligible_rankings ranking
      JOIN ranking_options option ON option.ranking_id = ranking.id
      LEFT JOIN vote_totals vote ON vote.option_id = option.id
      LEFT JOIN double_vote_totals double_vote ON double_vote.option_id = option.id
    ),
    ranking_activity AS (
      SELECT
        ranking_id,
        SUM(live_votes)::int AS live_votes,
        MAX(last_vote_at) AS last_vote_at,
        MAX(last_double_vote_at) AS last_double_vote_at
      FROM option_scores
      GROUP BY ranking_id
    ),
    ranking_previews AS (
      SELECT
        ranking_id,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', id,
            'label', label,
            'position', position,
            'score', score
          )
          ORDER BY score DESC, position
        ) AS options
      FROM option_scores
      WHERE rank_position <= 3
      GROUP BY ranking_id
    ),
    ranking_search AS (
      SELECT ranking_id, STRING_AGG(label, ' ' ORDER BY position) AS labels
      FROM option_scores
      WHERE $1::text = 'search'
      GROUP BY ranking_id
    )
    SELECT
      ranking.id,
      ranking.category,
      ranking.question,
      ranking.image_url,
      ranking.created_at,
      ranking.content_updated_at,
      (ranking.baseline_votes + COALESCE(activity.live_votes, 0))::int AS vote_count,
      GREATEST(
        ranking.created_at,
        COALESCE(ranking.content_updated_at, ranking.created_at),
        COALESCE(activity.last_vote_at, ranking.created_at),
        COALESCE(activity.last_double_vote_at, ranking.created_at)
      ) AS updated_at,
      COALESCE(search.labels, '') AS search_text,
      COALESCE(preview.options, '[]'::json) AS options
    FROM eligible_rankings ranking
    LEFT JOIN ranking_activity activity ON activity.ranking_id = ranking.id
    LEFT JOIN ranking_previews preview ON preview.ranking_id = ranking.id
    LEFT JOIN ranking_search search ON search.ranking_id = ranking.id
    ORDER BY ranking.created_at DESC, ranking.id
  `,
    [scope, city || null, LOCAL_CITY_LABELS],
  );
  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    question: rankingQuestion(row.id, row.question),
    imageUrl: resolveRankingCover(row.id, row.image_url),
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    searchText: row.search_text || '',
    voteCount: Number(row.vote_count || 0),
    options: (Array.isArray(row.options) ? row.options : []).map((option) => ({
      id: Number(option.id),
      label: option.label,
      position: Number(option.position),
      score: Number(option.score || 0),
    })),
  }));
}

async function fetchRanking(sql, id) {
  const [metadata] = await sql.query(
    `
      SELECT
        id,
        category,
        question,
        image_url,
        created_at,
        content_updated_at,
        is_vip AS "isVip"
      FROM rankings
      WHERE id = $1
        AND is_active = true
      LIMIT 1
    `,
    [id],
  );
  if (!metadata) return null;
  if (metadata.isVip === true) {
    return {
      id: metadata.id,
      category: metadata.category,
      question: rankingQuestion(metadata.id, metadata.question),
      imageUrl: null,
      createdAt: metadata.created_at,
      updatedAt: metadata.content_updated_at || metadata.created_at,
      voteCount: 0,
      options: [],
      isVip: true,
    };
  }

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
        ranking.content_updated_at,
        option.id AS option_id,
        option.label,
        option.position,
        option.baseline_score
          + COALESCE(vote.score_delta, 0)::int
          + COALESCE(double_vote.score_delta, 0)::int AS score,
        COALESCE(vote.live_votes, 0)::int AS live_votes,
        GREATEST(
          ranking.created_at,
          COALESCE(ranking.content_updated_at, ranking.created_at),
          COALESCE(vote.last_vote_at, ranking.created_at),
          COALESCE(double_vote.last_vote_at, ranking.created_at)
        ) AS updated_at
      FROM rankings ranking
      JOIN ranking_options option ON option.ranking_id = ranking.id
      LEFT JOIN vote_totals vote ON vote.option_id = option.id
      LEFT JOIN double_vote_totals double_vote ON double_vote.option_id = option.id
      WHERE ranking.id = $1
        AND ranking.is_active = true
        AND ranking.is_vip = false
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
    imageUrl: resolveRankingCover(first.id, first.image_url),
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
      entrar: ['Entrar — TOPO', 'Entre ou crie sua conta no TOPO com Google ou e-mail.'],
      perfil: [
        'Editar perfil — TOPO',
        'Ajuste seu nome e sua foto e veja sua participação no TOPO.',
      ],
      moderacao: ['Moderação — TOPO', 'Área privada de moderação do TOPO.'],
      vip: ['Meu Topo — TOPO', 'Seus rankings protegidos por senha no TOPO.'],
      favoritos: ['Favoritos — TOPO', 'Uma seleção de rankings favoritos no TOPO.'],
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
    bodyClass:
      kind === 'perfil'
        ? 'profilePage'
        : kind === 'moderacao'
          ? 'moderationPage'
          : kind === 'vip'
            ? 'vipPage'
            : kind === 'favoritos'
              ? 'vipPage favoritesPage'
              : '',
  });
}

export function renderMissingPage(template, title = 'Página não encontrada — TOPO') {
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
    bodyClass: 'notFoundPage',
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
      const city = localCityBySlug(queryValue(req, 'cidade')) || localCityByLabel('Florianópolis');
      const rankings = await fetchRankingSummaries(sql, {
        scope: search ? 'search' : 'general',
        city: city.label,
      });
      return sendHtml(res, 200, renderHomePage(template, rankings, search, city), {
        index: !search,
      });
    }

    if (view === 'category') {
      const category = generalCategoryBySlug(queryValue(req, 'category'));
      const section = queryValue(req, 'section');
      if (!category || (section && !(category.slug === 'esporte' && section === 'times')))
        return sendHtml(res, 404, renderMissingPage(template), { cache: false, index: false });
      const rankings = await fetchRankingSummaries(sql, { scope: 'general' });
      const rendered = renderGeneralCategoryPage(template, category, rankings, search, section);
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
      const rankings = await fetchRankingSummaries(sql, {
        scope: city ? 'city' : 'local',
        city: city?.label || '',
      });
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
    if (ranking.isVip) {
      return sendHtml(res, 200, renderVipRankingPage(template, ranking), {
        cache: false,
        index: false,
      });
    }
    const sharedDuel = sharedDuelForRanking(queryValue(req, 'duelo'), ranking);
    return sendHtml(res, 200, renderRankingPage(template, ranking, sharedDuel), {
      index: !sharedDuel,
    });
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
