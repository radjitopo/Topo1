import { neon } from '@neondatabase/serverless';
import {
  FOOTBALL_TEAMS_CATEGORY_PATH,
  GENERAL_CATEGORIES,
  generalCategoryForRanking,
  generalCategoryPath,
  isClubPlayerRanking,
  isSeoLocalRanking,
  localCityByLabel,
  localCollectionPath,
  localGroupForRanking,
} from './seo-taxonomy.js';

const BASE_URL = 'https://somostopo.com.br';
let sqlClient;

function database() {
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
}

function escapeXml(value) {
  return String(value || '').replace(
    /[<>&'"]/g,
    (character) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&apos;',
        '"': '&quot;',
      })[character],
  );
}

function isoDate(value) {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function latestDate(current, candidate) {
  if (!current) return candidate;
  if (!candidate) return current;
  return new Date(candidate) > new Date(current) ? candidate : current;
}

function addUrl(urls, path, lastModified = '') {
  const previous = urls.get(path);
  urls.set(path, latestDate(previous, lastModified));
}

export function buildSitemap(rankings) {
  const urls = new Map();
  const staticUrls = [
    '/sobre',
    '/como-funciona',
    '/imprensa',
    '/anuncie',
    '/contato',
    '/denuncie',
    '/regras',
    '/seguranca',
    '/privacidade',
    '/termos',
    '/cookies',
    '/direitos-autorais',
  ];
  for (const path of staticUrls) addUrl(urls, path);

  let homeLastModified = '';
  let localLastModified = '';
  let footballTeamsLastModified = '';
  const categoryActivity = new Map(GENERAL_CATEGORIES.map((category) => [category.slug, '']));
  const cityActivity = new Map();
  const localGroupActivity = new Map();

  for (const ranking of rankings) {
    if (ranking.isVip || ranking.is_vip) continue;
    const updatedAt = ranking.updated_at || ranking.created_at;
    homeLastModified = latestDate(homeLastModified, updatedAt);
    addUrl(urls, `/ranking/${encodeURIComponent(ranking.id)}`, updatedAt);

    if (isSeoLocalRanking(ranking)) {
      const city = localCityByLabel(ranking.category);
      const group = localGroupForRanking(ranking);
      if (!city || !group) continue;
      localLastModified = latestDate(localLastModified, updatedAt);
      cityActivity.set(city.slug, latestDate(cityActivity.get(city.slug), updatedAt));
      const key = `${city.slug}/${group.slug}`;
      localGroupActivity.set(key, latestDate(localGroupActivity.get(key), updatedAt));
      continue;
    }

    const category = generalCategoryForRanking(ranking);
    if (isClubPlayerRanking(ranking)) {
      footballTeamsLastModified = latestDate(footballTeamsLastModified, updatedAt);
    } else if (category)
      categoryActivity.set(
        category.slug,
        latestDate(categoryActivity.get(category.slug), updatedAt),
      );
  }

  addUrl(urls, '/', homeLastModified);
  addUrl(urls, '/local', localLastModified);
  for (const category of GENERAL_CATEGORIES) {
    const lastModified = categoryActivity.get(category.slug);
    if (lastModified) addUrl(urls, generalCategoryPath(category), lastModified);
  }
  if (footballTeamsLastModified)
    addUrl(urls, FOOTBALL_TEAMS_CATEGORY_PATH, footballTeamsLastModified);
  for (const [citySlug, lastModified] of cityActivity) {
    addUrl(urls, localCollectionPath(citySlug), lastModified);
  }
  for (const [key, lastModified] of localGroupActivity) {
    const [citySlug, groupSlug] = key.split('/');
    addUrl(urls, localCollectionPath(citySlug, groupSlug), lastModified);
  }

  const content = [...urls.entries()]
    .map(([path, lastModified]) => {
      const lastmod = isoDate(lastModified);
      return `<url><loc>${escapeXml(BASE_URL + path)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${content}</urlset>`;
}

export default async function handler(_req, res) {
  try {
    const rankings = await database().query(`
      WITH live_vote_activity AS (
        SELECT option.ranking_id, MAX(vote.updated_at) AS last_vote_at
        FROM ranking_options option
        LEFT JOIN votes vote ON vote.option_id = option.id
        GROUP BY option.ranking_id
      ),
      double_vote_activity AS (
        SELECT option.ranking_id, MAX(double_vote.updated_at) AS last_double_vote_at
        FROM ranking_options option
        LEFT JOIN user_double_votes double_vote ON double_vote.option_id = option.id
        GROUP BY option.ranking_id
      )
      SELECT
        ranking.id,
        ranking.category,
        ranking.question,
        ranking.created_at,
        GREATEST(
          ranking.created_at,
          COALESCE(live.last_vote_at, ranking.created_at),
          COALESCE(double_activity.last_double_vote_at, ranking.created_at)
        ) AS updated_at
      FROM rankings ranking
      LEFT JOIN live_vote_activity live ON live.ranking_id = ranking.id
      LEFT JOIN double_vote_activity double_activity ON double_activity.ranking_id = ranking.id
      WHERE ranking.is_active = true
        AND ranking.is_vip = false
      ORDER BY ranking.created_at DESC, ranking.id
    `);
    const xml = buildSitemap(rankings);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(xml);
  } catch (error) {
    console.error('Sitemap failed', error);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Retry-After', '60');
    return res.status(503).send('Sitemap temporarily unavailable');
  }
}
