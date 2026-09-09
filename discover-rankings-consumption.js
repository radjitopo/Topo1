function rankingItems(block) {
  return block
    .trim()
    .split('\n')
    .map((line) => {
      const [rank, name, value] = line.split('|');
      return { rank, name, value };
    });
}

const FAOSTAT_SOURCE_URL = 'https://www.fao.org/faostat/en/#data/FBS';
const FAOSTAT_PERIOD = '2023, última edição global disponível';
const FAOSTAT_NOTE =
  'A série “Food supply quantity” estima o volume disponível no fim da cadeia alimentar. É consumo aparente: não mede o que cada pessoa ingeriu nem desconta o desperdício doméstico. A comparação considera países soberanos com dados publicados.';

export const CONSUMPTION_DISCOVER_RANKINGS = Object.freeze([
  {
    slug: 'paises-mais-consomem-vinho',
    title: 'Países que mais consomem vinho',
    category: 'Gastronomia',
    metric: 'Consumo total anual estimado',
    period: 'Estimativas preliminares de 2025',
    source: 'Organização Internacional da Vinha e do Vinho (OIV)',
    sourceUrl:
      'https://www.oiv.int/sites/default/files/2026-05/OIV-State_of_the_World_Wine_Sector_in_2025.pdf',
    note: 'Volumes preliminares da OIV, originalmente publicados em milhões de hectolitros e convertidos aqui para litros.',
    items: rankingItems(`
1|Estados Unidos|3,19 bilhões de litros
2|França|2,20 bilhões de litros
3|Itália|2,02 bilhões de litros
4|Alemanha|1,78 bilhão de litros
5|Reino Unido|1,23 bilhão de litros
6|Espanha|940 milhões de litros
7|Rússia|800 milhões de litros
8|Argentina|750 milhões de litros
9|Portugal|560 milhões de litros
10|Austrália|530 milhões de litros`),
  },
  {
    slug: 'paises-mais-consomem-cerveja-por-pessoa',
    title: 'Países que mais consomem cerveja por pessoa',
    category: 'Gastronomia',
    metric: 'Consumo anual por habitante',
    period: '2024',
    source: 'Kirin Holdings',
    sourceUrl: 'https://www.kirinholdings.com/en/newsroom/release/2025/1222_01.html',
    note: 'Levantamento da Kirin com associações de cervejarias e estatísticas setoriais de 170 países e regiões. Os valores são litros por habitante no ano.',
    items: rankingItems(`
1|Tchéquia|148,8 litros
2|Lituânia|110,6 litros
3|Áustria|104,6 litros
4|Irlanda|99,0 litros
5|Croácia|95,1 litros
6|Estônia|93,2 litros
7|Espanha|91,8 litros
8|Eslovênia|88,4 litros
9|Romênia|87,4 litros
10|Alemanha|86,9 litros`),
  },
  {
    slug: 'paises-mais-consomem-cafe-por-pessoa',
    title: 'Países que mais consomem café por pessoa',
    category: 'Gastronomia',
    metric: 'Oferta anual de café e derivados por habitante',
    period: FAOSTAT_PERIOD,
    source: 'FAOSTAT — Balanços Alimentares',
    sourceUrl: FAOSTAT_SOURCE_URL,
    note: `${FAOSTAT_NOTE} Os valores estão em equivalente de café e derivados, não no peso da bebida pronta.`,
    items: rankingItems(`
1|Ilhas Marshall|23,26 kg
2|Laos|22,59 kg
3|Maldivas|20,72 kg
4|Luxemburgo|18,98 kg
5|Irlanda|15,79 kg
6|Estônia|15,68 kg
7|Antígua e Barbuda|14,44 kg
8|Bósnia e Herzegovina|14,26 kg
9|Lituânia|13,40 kg
10|Líbano|12,91 kg`),
  },
  {
    slug: 'paises-mais-consomem-cha-mate-por-pessoa',
    title: 'Países que mais consomem chá e mate por pessoa',
    category: 'Gastronomia',
    metric: 'Oferta anual de chá e mate por habitante',
    period: FAOSTAT_PERIOD,
    source: 'FAOSTAT — Balanços Alimentares',
    sourceUrl: FAOSTAT_SOURCE_URL,
    note: `${FAOSTAT_NOTE} A categoria reúne chá e mate; os valores não representam o peso da bebida pronta.`,
    items: rankingItems(`
1|Sri Lanka|51,69 kg
2|Quênia|34,78 kg
3|Argentina|27,26 kg
4|Paraguai|22,35 kg
5|Turquia|19,98 kg
6|China|10,82 kg
7|Ruanda|10,45 kg
8|Vietnã|10,41 kg
9|Maláui|9,03 kg
10|Uruguai|8,84 kg`),
  },
  {
    slug: 'paises-mais-consomem-carne-bovina-por-pessoa',
    title: 'Países que mais consomem carne bovina por pessoa',
    category: 'Gastronomia',
    metric: 'Oferta anual de carne bovina por habitante',
    period: FAOSTAT_PERIOD,
    source: 'FAOSTAT — Balanços Alimentares',
    sourceUrl: FAOSTAT_SOURCE_URL,
    note: `${FAOSTAT_NOTE} Carne bovina é o recorte global confiável mais próximo de hambúrguer, para o qual não há uma série mundial comparável.`,
    items: rankingItems(`
1|Argentina|48,99 kg
2|Zimbábue|45,48 kg
3|Brasil|39,07 kg
4|Estados Unidos|37,04 kg
5|Mongólia|33,28 kg
6|Uzbequistão|32,27 kg
7|Israel|30,06 kg
8|Luxemburgo|29,82 kg
9|Chile|27,49 kg
10|Austrália|26,91 kg`),
  },
  {
    slug: 'paises-mais-consomem-pimentas-por-pessoa',
    title: 'Países que mais consomem pimentas por pessoa',
    category: 'Gastronomia',
    metric: 'Oferta anual de pimentas secas por habitante',
    period: FAOSTAT_PERIOD,
    source: 'FAOSTAT — Balanços Alimentares',
    sourceUrl: FAOSTAT_SOURCE_URL,
    note: `${FAOSTAT_NOTE} A categoria “Pimento” da FAO reúne pimentas secas, páprica, malaguetas e pimenta-da-jamaica.`,
    items: rankingItems(`
1|Bósnia e Herzegovina|7,44 kg
2|Jamaica|6,47 kg
3|Tailândia|5,57 kg
4|Costa do Marfim|4,01 kg
5|Bangladesh|3,66 kg
6|Gana|2,96 kg
7|Nepal|2,76 kg
8|Cabo Verde|2,74 kg
9|Mianmar|2,47 kg
10|Macedônia do Norte|2,19 kg`),
  },
  {
    slug: 'paises-mais-consomem-arroz-por-pessoa',
    title: 'Países que mais consomem arroz por pessoa',
    category: 'Gastronomia',
    metric: 'Oferta anual de arroz e derivados por habitante',
    period: FAOSTAT_PERIOD,
    source: 'FAOSTAT — Balanços Alimentares',
    sourceUrl: FAOSTAT_SOURCE_URL,
    note: `${FAOSTAT_NOTE} A categoria reúne arroz e produtos derivados, em equivalente do alimento.`,
    items: rankingItems(`
1|Gâmbia|310,73 kg
2|Mianmar|271,44 kg
3|Camboja|262,56 kg
4|Bangladesh|250,56 kg
5|Guiné-Bissau|239,42 kg
6|Comores|228,68 kg
7|Laos|224,80 kg
8|Vietnã|219,90 kg
9|Filipinas|200,38 kg
10|Serra Leoa|191,66 kg`),
  },
  {
    slug: 'paises-mais-consomem-peixes-frutos-mar-por-pessoa',
    title: 'Países que mais consomem peixes e frutos do mar por pessoa',
    category: 'Gastronomia',
    metric: 'Oferta anual de pescados por habitante',
    period: FAOSTAT_PERIOD,
    source: 'FAOSTAT — Balanços Alimentares',
    sourceUrl: FAOSTAT_SOURCE_URL,
    note: `${FAOSTAT_NOTE} A categoria reúne peixes, crustáceos, moluscos e outros frutos do mar.`,
    items: rankingItems(`
1|Islândia|83,81 kg
2|Maldivas|79,74 kg
3|Kiribati|72,28 kg
4|Tuvalu|55,92 kg
5|Antígua e Barbuda|54,52 kg
6|Portugal|53,49 kg
7|Coreia do Sul|52,82 kg
8|Malásia|51,03 kg
9|Noruega|49,10 kg
10|Estados Federados da Micronésia|48,99 kg`),
  },
  {
    slug: 'paises-mais-consomem-ovos-por-pessoa',
    title: 'Países que mais consomem ovos por pessoa',
    category: 'Gastronomia',
    metric: 'Oferta anual de ovos por habitante',
    period: FAOSTAT_PERIOD,
    source: 'FAOSTAT — Balanços Alimentares',
    sourceUrl: FAOSTAT_SOURCE_URL,
    note: `${FAOSTAT_NOTE} A comparação é em quilogramas, não em quantidade de ovos.`,
    items: rankingItems(`
1|Bélgica|31,83 kg
2|Luxemburgo|25,47 kg
3|China|22,96 kg
4|Malásia|21,65 kg
5|México|21,55 kg
6|Granada|21,36 kg
7|Indonésia|20,87 kg
8|Maldivas|20,17 kg
9|Argentina|18,41 kg
10|Países Baixos|17,85 kg`),
  },
  {
    slug: 'paises-mais-consomem-batatas-por-pessoa',
    title: 'Países que mais consomem batatas por pessoa',
    category: 'Gastronomia',
    metric: 'Oferta anual de batatas e derivados por habitante',
    period: FAOSTAT_PERIOD,
    source: 'FAOSTAT — Balanços Alimentares',
    sourceUrl: FAOSTAT_SOURCE_URL,
    note: `${FAOSTAT_NOTE} A categoria reúne batatas e produtos derivados, em equivalente do alimento.`,
    items: rankingItems(`
1|Belarus|166,87 kg
2|Ucrânia|146,96 kg
3|Bósnia e Herzegovina|102,86 kg
4|Nepal|99,47 kg
5|Quirguistão|98,80 kg
6|Polônia|92,87 kg
7|Uzbequistão|92,79 kg
8|Bélgica|90,79 kg
9|Peru|89,99 kg
10|Irlanda|85,26 kg`),
  },
]);
