import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { imageAssetKey, rejectedRankingCoverIssue } from '../ranking-image-policy.js';

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

function normalizeRanking(ranking, baseUrl = DEFAULT_SITE) {
  const rawImage = String(rankingImage(ranking) || '');
  let image = rawImage;
  if (rawImage) {
    try {
      image = new URL(rawImage, baseUrl).href;
    } catch {}
  }
  return {
    id: String(ranking?.id || ''),
    question: String(ranking?.question || ranking?.title || ''),
    image,
  };
}

async function rankingsFromSite(siteUrl) {
  const base = String(siteUrl || DEFAULT_SITE).replace(/\/$/, '');
  const response = await fetch(`${base}/api?device_id=topo-image-audit`, {
    headers: { 'user-agent': 'TOPO image audit/1.0' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Catálogo remoto respondeu ${response.status}.`);
  const payload = await response.json();
  return (payload.rankings || []).map((ranking) => normalizeRanking(ranking, base));
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
      const ranking = normalizeRanking(raw, DEFAULT_SITE);
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
    url = new URL(ranking.image, DEFAULT_SITE);
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

function editorialIssues(ranking) {
  const rejected = rejectedRankingCoverIssue(ranking.id, ranking.image);
  return rejected ? [rejected] : [];
}

function responseResult(response, method) {
  const contentType = response.headers.get('content-type') || '';
  const ok = response.ok && contentType.toLowerCase().startsWith('image/');
  return {
    ok,
    status: response.status,
    contentType,
    method,
    error: ok
      ? ''
      : response.ok
        ? `conteúdo inesperado: ${contentType || 'desconhecido'}`
        : `HTTP ${response.status}`,
  };
}

async function imageRequest(image, method) {
  const response = await fetch(image, {
    method,
    redirect: 'follow',
    headers: {
      'user-agent': 'TOPO image audit/1.0',
      ...(method === 'GET' ? { range: 'bytes=0-2047' } : {}),
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const result = responseResult(response, method);
  if (response.body) await response.body.cancel().catch(() => {});
  return result;
}

async function probeImageAsset(image) {
  if (!image) {
    return {
      ok: false,
      status: 0,
      contentType: '',
      method: '',
      error: 'sem imagem',
    };
  }
  let headFailure = '';
  try {
    const head = await imageRequest(image, 'HEAD');
    if (head.ok) return head;
    headFailure = head.error;
  } catch (error) {
    headFailure =
      error?.name === 'TimeoutError' ? 'tempo esgotado' : String(error?.message || error);
  }
  try {
    return await imageRequest(image, 'GET');
  } catch (error) {
    const getFailure =
      error?.name === 'TimeoutError' ? 'tempo esgotado' : String(error?.message || error);
    return {
      ok: false,
      status: 0,
      contentType: '',
      method: 'GET',
      error: `HEAD: ${headFailure || 'falhou'}; GET: ${getFailure}`,
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
    const key = imageAssetKey(ranking.image) || ranking.image;
    const group = groups.get(key) || [];
    group.push(ranking.id);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([image, ids]) => ({ image, ids }));
}

export async function auditRankingImages(rankings, options = {}) {
  const normalized = rankings
    .map((ranking) => normalizeRanking(ranking))
    .filter((ranking) => ranking.id);
  const assets = new Map();
  for (const ranking of normalized) {
    const key = imageAssetKey(ranking.image) || `missing:${ranking.id}`;
    if (!assets.has(key)) assets.set(key, ranking.image);
  }
  const probedAssets = await mapConcurrent(
    [...assets.entries()],
    async ([key, image]) => [key, await probeImageAsset(image)],
    options.concurrency || MAX_CONCURRENCY,
  );
  const probeByAsset = new Map(probedAssets);
  const results = normalized.map((ranking) => ({
    ...ranking,
    ...probeByAsset.get(imageAssetKey(ranking.image) || `missing:${ranking.id}`),
    qualityIssues: staticQualityIssues(ranking),
  }));
  return {
    checked: results.length,
    broken: results.filter((result) => !result.ok),
    quality: results.filter((result) => result.qualityIssues.length),
    editorial: normalized
      .map((ranking) => ({ ...ranking, editorialIssues: editorialIssues(ranking) }))
      .filter((ranking) => ranking.editorialIssues.length),
    duplicates: duplicatePhotoGroups(normalized),
    results,
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
    for (const item of report.quality)
      console.log(`- ${item.id}: ${item.qualityIssues.join(', ')} — ${item.image}`);
  }
  if (report.editorial.length) {
    console.log('\nCapas reprovadas pelo critério editorial:');
    for (const item of report.editorial)
      console.log(`- ${item.id}: ${item.editorialIssues.join(', ')} — ${item.image}`);
  }
  if (report.duplicates.length) {
    console.log('\nFotos repetidas (revisão editorial):');
    for (const group of report.duplicates) console.log(`- ${group.ids.join(', ')}`);
  }
  if (!report.broken.length && !report.quality.length && !report.editorial.length)
    console.log('Nenhuma falha técnica ou editorial encontrada.');
}

async function main() {
  const site = argValue('--site');
  const rankings = site ? await rankingsFromSite(site) : await rankingsFromLocalData();
  const requestedConcurrency = Number(argValue('--concurrency'));
  const report = await auditRankingImages(rankings, {
    concurrency:
      Number.isInteger(requestedConcurrency) && requestedConcurrency > 0
        ? requestedConcurrency
        : MAX_CONCURRENCY,
  });
  printReport(report, site || 'arquivos locais');
  if (
    report.broken.length ||
    (process.argv.includes('--strict') && (report.quality.length || report.editorial.length))
  )
    process.exitCode = 1;
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  await main();
}
