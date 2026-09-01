import { readFile, writeFile } from 'node:fs/promises';

const catalogUrl = new URL('../data/local-catalog.json', import.meta.url);
const exclusionsUrl = new URL('../data/local-option-exclusions.json', import.meta.url);
const veganFloripaRefreshUrl = new URL('../data/vegan-floripa-refresh.json', import.meta.url);

const [catalog, exclusions, veganFloripaRefresh] = await Promise.all([
  readFile(catalogUrl, 'utf8').then(JSON.parse),
  readFile(exclusionsUrl, 'utf8').then(JSON.parse),
  readFile(veganFloripaRefreshUrl, 'utf8').then(JSON.parse),
]);

let removed = 0;
for (const ranking of catalog) {
  const rejected = new Set(exclusions[ranking.id] || []);
  const before = ranking.opts.length;
  ranking.opts = ranking.opts.filter((option) => !rejected.has(option.label));
  removed += before - ranking.opts.length;

  if (ranking.localCategoryKey === 'vegan') {
    ranking.localCategory = 'Restaurante vegano';
    ranking.question =
      ranking.id === veganFloripaRefresh.rankingId
        ? veganFloripaRefresh.question
        : `Qual é o melhor restaurante vegano em ${ranking.city}?`;
  }

  if (ranking.opts.length < 5) {
    throw new Error(`${ranking.id} ficou com menos de 5 opções após a curadoria.`);
  }
}

await writeFile(catalogUrl, `${JSON.stringify(catalog)}\n`);
console.log(`Curadoria local aplicada: ${removed} opções removidas.`);
