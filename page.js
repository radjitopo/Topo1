import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { rankingQuestion } from './ranking-titles.js';

const templatePromise = readFile(new URL('./index.html', import.meta.url), 'utf8');
const sql = neon(process.env.DATABASE_URL);
const BASE_URL = 'https://somostopo.com.br';

function escapeAttribute(value) {
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

function seoBlock({ title, description, canonical, image, index = true }) {
  const safeTitle = escapeAttribute(title);
  const safeDescription = escapeAttribute(description);
  const safeCanonical = escapeAttribute(canonical);
  const safeImage = escapeAttribute(image || `${BASE_URL}/og-topo.png`);

  return `<!-- SEO_START -->
<title>${safeTitle}</title>
<meta name="description" content="${safeDescription}">
<link rel="canonical" href="${safeCanonical}">
<meta name="robots" content="${index ? 'index,follow,max-image-preview:large' : 'noindex,follow'}">
<meta property="og:locale" content="pt_BR">
<meta property="og:type" content="website">
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
<!-- SEO_END -->`;
}

function withSeo(template, metadata) {
  return template.replace(/<!-- SEO_START -->[\s\S]*?<!-- SEO_END -->/, seoBlock(metadata));
}

function socialImageUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.hostname === 'images.unsplash.com') {
      url.searchParams.set('auto', 'format');
      url.searchParams.set('fit', 'crop');
      url.searchParams.set('w', '1200');
      url.searchParams.set('h', '630');
      url.searchParams.set('q', '82');
    }
    return url.toString();
  } catch {
    return `${BASE_URL}/og-topo.png`;
  }
}

export default async function handler(req, res) {
  const rawId = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
  const rawView = Array.isArray(req.query?.view) ? req.query.view[0] : req.query?.view;
  const id = String(rawId || '').slice(0, 120);
  const template = await templatePromise;

  if (rawView === 'local') {
    const html = withSeo(template, {
      title: 'TOPO LOCAL — rankings da sua cidade',
      description:
        'Descubra e vote nos melhores restaurantes, cafés, padarias, pizzarias, hotéis e serviços da sua cidade.',
      canonical: `${BASE_URL}/local`,
      image: `${BASE_URL}/og-topo.png`,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    return res.status(200).send(html);
  }

  try {
    const [ranking] = await sql.query(
      `
      SELECT id, question, image_url
      FROM rankings
      WHERE id = $1
        AND is_active = true
      LIMIT 1
    `,
      [id],
    );

    if (!ranking) {
      const html = withSeo(template, {
        title: 'Ranking não encontrado — TOPO',
        description: 'Este ranking não está disponível. Descubra outros temas no TOPO.',
        canonical: BASE_URL,
        image: `${BASE_URL}/og-topo.png`,
        index: false,
      });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      return res.status(404).send(html);
    }

    const canonical = `${BASE_URL}/ranking/${encodeURIComponent(ranking.id)}`;
    const question = rankingQuestion(ranking.id, ranking.question);
    const title = `${question} — TOPO`;
    const description = `Veja o resultado atual de “${question}”, conheça o Top 20 e vote para mudar a ordem.`;
    const html = withSeo(template, {
      title,
      description,
      canonical,
      image: socialImageUrl(ranking.image_url),
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Ranking page metadata failed', error);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(template);
  }
}
