import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SCRIPT_DIR, '..');
const DEFAULT_SITE = 'https://somostopo.com.br';
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_CONCURRENCY = 8;

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

function rankingImage(ranking) {
  return ranking?.image_url || ranking?.image || ranking?.img || '';
}

function normalizeRanking(ranking) {
  return {
    id: String(ranking?.id || ''),
    question: String(ranking?.question || ranking?.title || ''),
    image: String(rankingImage(ranking) || '')
  };
}

async function rankingsFromSite(siteUrl) {
  const base = String(siteUrl || DEFAULT_SITE).replace(/\/$/, '');
  const response = await fetch(`${base}/api?device_id=topo-image-audit`, {
    headers: { 'user-agent': 'TOPO image audit/1.0' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`Catálogo remoto respondeu ${response.status}.`);
  const payload = await response.json();
  return (payload.rankings || []).map(normalizeRanking);
}

async function rankingsFromLocalData() {
  const dataDir = resolve(ROOT_DIR, 'data');
  const filenames = (await readdir(dataDir))
    .filter((name) => name.endsWith('.json') && name !== 'titles.json')
    .sort();
  const byId = new Map();
  for (const filename of filenames) {
    const parsed = JSON.parse(await readFile(resolve(dataDir, filename), 'utf8'));
    if (!Array.isArray(parsed)) continue;
    for (const raw of parsed) {
      const ranking = normalizeRanking(raw);
      if (ranking.id) byId.set(ranking.id, ranking);
    }
  }
  return [...byId.values()];
}

function staticQualityIssues(ranking) {
  const issues = [];
  if (!ranking.image) return ['sem endereço de imagem'];
  let url;
  try {
    url = new URL(ranking.image);
  } catch {
    return ['endereço inválido'];
  }
  if (url.protocol !== 'https:') issues.push('imagem sem HTTPS');
  if (url.hostname === 'images.unsplash.com') {
    const width = Number(url.searchParams.get('w') || 0);
    const height = Number(url.searchParams.get('h') || 0);
    const quality = Number(url.searchParams.get('q') || 0);
    if (url.searchParams.get('fit') !== 'crop') issues.push('sem corte padronizado');
    if (width && width < 1000) issues.push(`largura solicitada baixa (${width}px)`);
    if (height && height < 600) issues.push(`altura solicitada baixa (${height}px)`);
    if (quality && quality < 75) issues.push(`qualidade solicitada baixa (${quality})`);
  }
  return issues;
}

async function probeImage(ranking) {
  const qualityIssues = staticQualityIssues(ranking);
  if (!ranking.image) {
    return { ...ranking, ok: false, status: 0, contentType: '', error: 'sem imagem', qualityIssues };
  }
  try {
    const response = await fetch(ranking.image, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'user-agent': 'TOPO image audit/1.0' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    const contentType = response.headers.get('content-type') || '';
    const ok = response.ok && contentType.toLowerCase().startsWith('image/');
    return {
      ...ranking,
      ok,
      status: response.status,
      contentType,
      error: ok ? '' : response.ok ? `conteúdo inesperado: ${contentType || 'desconhecido'}` : `HTTP ${response.status}`,
      qualityIssues
    };
  } catch (error) {
    return {
      ...ranking,
      ok: false,
      status: 0,
      contentType: '',
      error: error?.name === 'TimeoutError' ? 'tempo esgotado' : String(error?.message || error),
      qualityIssues
    };
  }
}

async function mapConcurrent(items, worker, concurrency = MAX_CONCURRENCY) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

function duplicatePhotoGroups(rankings) {
  const groups = new Map();
  for (const ranking of rankings) {
    if (!ranking.image) continue;
    let key = ranking.image;
    try {
      const url = new URL(ranking.image);
      const unsplashId = url.pathname.match(/\/photo-([^/]+)/)?.[1];
      key = unsplashId ? `unsplash:${unsplashId}` : `${url.origin}${url.pathname}`;
    } catch {}
    const group = groups.get(key) || [];
    group.push(ranking.id);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([image, ids]) => ({ image, ids }));
}

export async function auditRankingImages(rankings, options = {}) {
  const normalized = rankings.map(normalizeRanking).filter((ranking) => ranking.id);
  const results = await mapConcurrent(normalized, probeImage, options.concurrency || MAX_CONCURRENCY);
  return {
    checked: results.length,
    broken: results.filter((result) => !result.ok),
    quality: results.filter((result) => result.qualityIssues.length),
    duplicates: duplicatePhotoGroups(normalized),
    results
  };
}

function printReport(report, sourceLabel) {
  console.log(`Capas verificadas: ${report.checked} (${sourceLabel})`);
  if (report.broken.length) {
    console.log('\nImagens quebradas:');
    for (const item of report.broken) console.log(`- ${item.id}: ${item.error} — ${item.image}`);
  }
  if (report.quality.length) {
    console.log('\nAlertas de qualidade técnica:');
    for (const item of report.quality) console.log(`- ${item.id}: ${item.qualityIssues.join(', ')} — ${item.image}`);
  }
  if (report.duplicates.length) {
    console.log('\nFotos repetidas (revisão editorial):');
    for (const group of report.duplicates) console.log(`- ${group.ids.join(', ')}`);
  }
  if (!report.broken.length && !report.quality.length) console.log('Nenhuma falha técnica encontrada.');
}

async function main() {
  const site = argValue('--site');
  const rankings = site ? await rankingsFromSite(site) : await rankingsFromLocalData();
  const report = await auditRankingImages(rankings);
  printReport(report, site || 'arquivos locais');
  if (report.broken.length || (process.argv.includes('--strict') && report.quality.length)) process.exitCode = 1;
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  await main();
}
