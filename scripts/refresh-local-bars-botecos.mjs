import { readFile, writeFile } from 'node:fs/promises';

const catalogUrl = new URL('../data/local-catalog.json', import.meta.url);
const reviewUrl = new URL('../data/local-bars-botecos-2026-09.json', import.meta.url);

const [catalog, review] = await Promise.all(
  [catalogUrl, reviewUrl].map((url) => readFile(url, 'utf8').then(JSON.parse)),
);

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

if (
  review.reviewKey !== 'local-bars-botecos-2026-09-v1' ||
  review.scope?.cityCount !== 21 ||
  review.scope?.rankingCount !== 42 ||
  review.scope?.optionsPerRanking !== 20 ||
  review.cities.length !== 21
) {
  throw new Error('A curadoria de bares e botecos está fora do escopo aprovado.');
}

const reviewByCity = new Map(review.cities.map((city) => [city.city, city]));
for (const city of review.cities) {
  const bars = city.bars.map(fold);
  const botecos = city.botecos.map(fold);
  if (
    !city.city ||
    !city.slug ||
    !Array.isArray(city.sources) ||
    city.sources.length === 0 ||
    city.bars.length !== 20 ||
    city.botecos.length !== 20 ||
    new Set(bars).size !== 20 ||
    new Set(botecos).size !== 20 ||
    bars.some((label) => botecos.includes(label))
  ) {
    throw new Error(`Curadoria inválida para ${city.city || city.slug}.`);
  }
}

const refreshed = catalog
  .filter((ranking) => ranking.localCategoryKey !== 'boteco')
  .flatMap((ranking) => {
    if (ranking.localCategoryKey !== 'bar') return [ranking];
    const city = reviewByCity.get(ranking.city);
    if (!city) throw new Error(`Sem curadoria de bares e botecos para ${ranking.city}.`);
    const options = (labels) =>
      labels.map((label, index) => ({ label, position: index + 1, baseline_score: 0 }));
    const bars = {
      ...ranking,
      id: `bares-${city.slug}`,
      localCategory: 'Bares',
      localCategoryKey: 'bar',
      question: `Qual é o melhor bar em ${city.city}?`,
      baseline_votes: 0,
      is_active: true,
      preserveExistingOptions: false,
      opts: options(city.bars),
    };
    const botecos = {
      ...ranking,
      id: `botecos-${city.slug}`,
      localCategory: 'Botecos',
      localCategoryKey: 'boteco',
      question: `Qual é o melhor boteco em ${city.city}?`,
      baseline_votes: 0,
      is_active: true,
      preserveExistingOptions: false,
      opts: options(city.botecos),
    };
    return [bars, botecos];
  });

if (
  refreshed.length !== 21 * 17 ||
  new Set(refreshed.map((ranking) => ranking.id)).size !== refreshed.length ||
  refreshed.filter((ranking) => ranking.localCategoryKey === 'bar').length !== 21 ||
  refreshed.filter((ranking) => ranking.localCategoryKey === 'boteco').length !== 21
) {
  throw new Error('O catálogo final não forma a matriz de 21 cidades por 17 categorias.');
}

await writeFile(catalogUrl, `${JSON.stringify(refreshed)}\n`);
console.log('Catálogo atualizado: 21 rankings de bares e 21 rankings de botecos.');
