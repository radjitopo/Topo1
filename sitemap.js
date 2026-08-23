import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const BASE_URL = 'https://somostopo.com.br';

function escapeXml(value) {
  return String(value || '').replace(/[<>&'\"]/g, (character) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;'
  })[character]);
}

export default async function handler(_req, res) {
  try {
    const rankings = await sql.query(`
      SELECT id, created_at
      FROM rankings
      WHERE is_active = true
      ORDER BY created_at DESC, id
    `);
    const staticUrls = ['/', '/sobre', '/como-funciona', '/imprensa', '/anuncie', '/contato', '/denuncie', '/regras', '/seguranca', '/privacidade', '/termos', '/cookies', '/direitos-autorais'];
    const urls = [
      ...staticUrls.map((path) => `<url><loc>${escapeXml(BASE_URL + path)}</loc></url>`),
      ...rankings.map((ranking) => {
        const location = `${BASE_URL}/ranking/${encodeURIComponent(ranking.id)}`;
        const lastModified = ranking.created_at
          ? `<lastmod>${new Date(ranking.created_at).toISOString().slice(0, 10)}</lastmod>`
          : '';
        return `<url><loc>${escapeXml(location)}</loc>${lastModified}</url>`;
      })
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(xml);
  } catch (error) {
    console.error('Sitemap failed', error);
    return res.status(500).send('Sitemap unavailable');
  }
}
