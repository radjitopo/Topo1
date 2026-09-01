const BASE_URL = 'https://somostopo.com.br';

export const FOOTBALL_TEAMS_CATEGORY_PATH = '/categoria/futebol/times';
export const CLUB_PLAYER_RANKING_IDS = Object.freeze([
  'melhores-jogadores-flamengo',
  'melhores-jogadores-corinthians',
  'melhores-jogadores-palmeiras',
  'melhores-jogadores-sao-paulo',
  'melhores-jogadores-santos',
  'melhores-jogadores-vasco',
  'melhores-jogadores-botafogo',
  'melhores-jogadores-gremio',
  'melhores-jogadores-internacional',
  'melhores-jogadores-atletico-mg',
  'melhores-jogadores-cruzeiro',
  'melhores-jogadores-bahia',
  'melhores-jogadores-sport',
  'melhores-jogadores-athletico-pr',
  'melhores-jogadores-coritiba',
  'melhores-jogadores-fortaleza',
  'melhores-jogadores-ceara',
  'melhores-jogadores-goias',
  'melhores-jogadores-vitoria',
  'melhores-jogadores-fluminense',
]);
const clubPlayerRankingIds = new Set(CLUB_PLAYER_RANKING_IDS);

export function isClubPlayerRanking(ranking) {
  return clubPlayerRankingIds.has(String(ranking?.id || ''));
}

export function foldSeoText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function seoSlug(value) {
  return foldSeoText(value)
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const GENERAL_CATEGORIES = Object.freeze(
  [
    [
      'Cinema',
      'Filmes, diretores, personagens, cenas e tudo o que faz o cinema continuar rendendo boas discussões.',
    ],
    [
      'Música',
      'Artistas, bandas, álbuns, canções e gêneros musicais colocados em ordem pelos votos da comunidade.',
    ],
    [
      'TV & Séries',
      'Séries, programas, novelas, animações e personagens para descobrir, comparar e votar.',
    ],
    [
      'Nostalgia',
      'Brinquedos, programas, objetos, sons e hábitos que marcaram diferentes gerações.',
    ],
    [
      'Livros',
      'Livros, autores, personagens e histórias que seguem conquistando leitores de diferentes gerações.',
    ],
    ['Arte', 'Artistas, obras, movimentos e referências culturais reunidos em rankings abertos.'],
    ['Moda', 'Estilos, peças, tendências e nomes que marcaram a moda e o jeito de se vestir.'],
    [
      'Comida',
      'Pratos, ingredientes, sabores, restaurantes e escolhas que sempre dão vontade de discutir.',
    ],
    ['Lugares', 'Bairros, ruas, construções e paisagens para colocar no mapa e no ranking.'],
    ['Viagens', 'Países, cidades, praias, roteiros e experiências para inspirar a próxima viagem.'],
    [
      'Famosos',
      'Celebridades, personalidades e figuras públicas avaliadas pelo carisma, talento e impacto cultural.',
    ],
    ['Natureza', 'Plantas, paisagens e fenômenos naturais que despertam curiosidade e admiração.'],
    ['Animais', 'Espécies, raças e comportamentos do mundo animal reunidos para comparar e votar.'],
    ['Motores', 'Carros, motos, máquinas e ícones de velocidade, design e engenharia.'],
    [
      'Esporte',
      'Atletas, modalidades, competições e momentos esportivos que desafiam comparações.',
    ],
    ['Futebol', 'Clubes, seleções, jogadores, estádios e histórias que movimentam torcidas.'],
    ['Jogos', 'Videogames, jogos de mesa, personagens e universos que atravessam gerações.'],
    [
      'Tecnologia',
      'Produtos, invenções e ideias que mudaram a forma como a gente vive, trabalha e se comunica.',
    ],
    ['Compras', 'Marcas, lojas e produtos avaliados por utilidade, desejo e custo-benefício.'],
    ['Luxo', 'Marcas, objetos, destinos e experiências que representam exclusividade e desejo.'],
    [
      'Vida',
      'Hábitos, situações, relações e pequenas grandes questões do cotidiano transformadas em ranking.',
    ],
  ].map(([label, description]) =>
    Object.freeze({
      label,
      slug: seoSlug(label),
      description,
      url: `${BASE_URL}/categoria/${seoSlug(label)}`,
    }),
  ),
);

const generalByLabel = new Map(GENERAL_CATEGORIES.map((category) => [category.label, category]));
const generalBySlug = new Map(GENERAL_CATEGORIES.map((category) => [category.slug, category]));

const generalOverrides = Object.freeze({
  'lugares-date': 'Lugares',
  'coisas-fora-moda': 'Moda',
  animes: 'TV & Séries',
  'celebridades-fofas': 'Famosos',
  'celebridades-sexy': 'Famosos',
  'influencers-brasil': 'Famosos',
  'videogames-consoles': 'Jogos',
  'jogos-videogame': 'Jogos',
  'jogos-celular': 'Jogos',
  'pokemons-irados': 'Jogos',
});

export function generalCategoryByLabel(label) {
  return generalByLabel.get(String(label || '')) || null;
}

export function generalCategoryBySlug(slug) {
  return generalBySlug.get(String(slug || '').toLowerCase()) || null;
}

export function generalCategoryForRanking(ranking) {
  const id = String(ranking?.id || '');
  const category = String(ranking?.category || ranking?.cat || '');
  if (generalOverrides[id]) return generalCategoryByLabel(generalOverrides[id]);
  if (
    [
      'Cinema',
      'Música',
      'Livros',
      'Arte',
      'Moda',
      'Jogos',
      'Natureza',
      'Animais',
      'Motores',
      'Esporte',
      'Futebol',
      'Tecnologia',
      'Compras',
      'Luxo',
      'Lugares',
      'Viagens',
      'TV & Séries',
      'Nostalgia',
    ].includes(category)
  )
    return generalCategoryByLabel(category);
  if (category === 'TV') return generalCategoryByLabel('TV & Séries');
  if (['Pessoas', 'Famosos'].includes(category)) return generalCategoryByLabel('Famosos');
  if (category === 'Cultura') return generalCategoryByLabel('Arte');
  if (['Comida', 'Café'].includes(category)) return generalCategoryByLabel('Comida');
  if (['Viagem', 'Brasil'].includes(category)) return generalCategoryByLabel('Viagens');
  if (category === 'Animais') return generalCategoryByLabel('Animais');
  if (category === 'Plantas') return generalCategoryByLabel('Natureza');
  if (category === 'Carros') return generalCategoryByLabel('Motores');
  if (category === 'Produtos') return generalCategoryByLabel('Compras');
  return generalCategoryByLabel('Vida');
}

export const LOCAL_CITIES = Object.freeze(
  [
    'São Paulo',
    'Rio de Janeiro',
    'Brasília',
    'Fortaleza',
    'Salvador',
    'Belo Horizonte',
    'Manaus',
    'Curitiba',
    'Recife',
    'Goiânia',
    'Belém',
    'Porto Alegre',
    'Guarulhos',
    'Campinas',
    'São Luís',
    'Maceió',
    'Campo Grande',
    'São Gonçalo',
    'Teresina',
    'João Pessoa',
    'Florianópolis',
    'Balneário Camboriú',
  ].map((label) => Object.freeze({ label, slug: seoSlug(label) })),
);

const cityByLabel = new Map(LOCAL_CITIES.map((city) => [foldSeoText(city.label), city]));
const cityBySlug = new Map(LOCAL_CITIES.map((city) => [city.slug, city]));

export function localCityByLabel(label) {
  return cityByLabel.get(foldSeoText(label)) || null;
}

export function localCityBySlug(slug) {
  return cityBySlug.get(String(slug || '').toLowerCase()) || null;
}

const localGroupDefinitions = [
  {
    label: 'Restaurante vegano',
    description:
      'Restaurantes e estabelecimentos veganos escolhidos por quem conhece a cena local.',
    id: /^(?:restaurantes?\s+veganos?|veganos?)(?:\s|$)/,
    question: /\b(?:restaurante|estabelecimento)\s+vegano\b|\bcomida\s+vegana\b/,
  },
  {
    label: 'Restaurante por quilo',
    description:
      'Restaurantes por quilo e self-services para comparar variedade, sabor e experiência.',
    id: /^(?:quilo|restaurantes?\s+por\s+quilo)(?:\s|$)/,
    question: /\b(?:restaurante\s+por\s+quilo|quilo|self\s+service)\b/,
  },
  {
    label: 'Restaurante italiano',
    description: 'Cantinas e restaurantes italianos da cidade reunidos em rankings da comunidade.',
    id: /^restaurantes?\s+italianos?(?:\s|$)/,
    question: /\brestaurante\s+italiano\b/,
  },
  {
    label: 'Sushi/Japonês',
    description: 'Sushis e restaurantes japoneses para descobrir e votar na sua cidade.',
    id: /^(?:sushi|japones|restaurantes?\s+japoneses?)(?:\s|$)/,
    question: /\b(?:sushi|restaurante\s+japones)\b/,
  },
  {
    label: 'Pizza',
    description: 'Pizzarias e pizzas que disputam a preferência de cada cidade.',
    id: /^(?:pizza|pizzarias?)(?:\s|$)/,
    question: /\b(?:pizza|pizzaria)\b/,
  },
  {
    label: 'Hambúrguer',
    description: 'Hamburguerias locais avaliadas por quem conhece e frequenta a cidade.',
    id: /^(?:hamburguer|hamburguerias?)(?:\s|$)/,
    question: /\b(?:hamburguer|hamburgueria)\b/,
  },
  {
    label: 'Café/Cafeteria',
    description: 'Cafés e cafeterias para encontrar bons grãos, doces, ambientes e encontros.',
    id: /^(?:cafe|cafes|cafeterias?)(?:\s|$)/,
    question: /\b(?:cafe|cafeteria)\b/,
  },
  {
    label: 'Bares',
    description: 'Bares, pubs e botecos da cidade para descobrir, comparar e votar.',
    id: /^bares?(?:\s|$)/,
    question: /\b(?:bar|bares|boteco|botequim|pub)\b/,
  },
  {
    label: 'Salão de beleza',
    description: 'Salões de beleza da cidade classificados pela experiência da comunidade.',
    id: /^(?:salao|saloes)\s+(?:de\s+)?beleza(?:\s|$)/,
    question: /\bsalao\s+de\s+beleza\b/,
  },
  {
    label: 'Barbearia',
    description: 'Barbearias locais para comparar atendimento, estilo e preferência popular.',
    id: /^barbearias?(?:\s|$)/,
    question: /\bbarbearia\b/,
  },
  {
    label: 'Academia',
    description: 'Academias da cidade reunidas para facilitar a descoberta e a votação.',
    id: /^academias?(?:\s|$)/,
    question: /\bacademia\b/,
  },
  {
    label: 'Eventos esportivos',
    description: 'Eventos e modalidades esportivas que mais movimentam e animam cada cidade.',
    id: /^eventos?\s+esportivos?(?:\s|$)/,
    question: /\bevento\s+esportivo\b/,
  },
  {
    label: 'Pet shop',
    description: 'Pet shops locais comparados pela comunidade de cada cidade.',
    id: /^pet\s+shops?(?:\s|$)/,
    question: /\bpet\s+shop\b/,
  },
  {
    label: 'Padaria',
    description: 'Padarias de bairro e casas artesanais escolhidas por quem vive a cidade.',
    id: /^padarias?(?:\s|$)/,
    question: /\bpadaria\b/,
  },
  {
    label: 'Brechó',
    description: 'Brechós locais para garimpar moda, personalidade e bons achados.',
    id: /^brechos?(?:\s|$)/,
    question: /\bbrecho\b/,
  },
  {
    label: 'Restaurantes em geral',
    description:
      'Restaurantes da cidade em uma disputa aberta, atualizada pelos votos da comunidade.',
    id: /^restaurantes?(?:\s|$)/,
    question: /\bmelhor\s+restaurante(?:\s+(?:em|de|do|da)|\?|$)/,
  },
];

export const LOCAL_GROUPS = Object.freeze(
  localGroupDefinitions.map((group) =>
    Object.freeze({
      ...group,
      slug: seoSlug(group.label),
    }),
  ),
);

const localGroupBySlugMap = new Map(LOCAL_GROUPS.map((group) => [group.slug, group]));
const localGroupByLabelMap = new Map(LOCAL_GROUPS.map((group) => [group.label, group]));

export function localGroupBySlug(slug) {
  return localGroupBySlugMap.get(String(slug || '').toLowerCase()) || null;
}

export function localGroupByLabel(label) {
  return localGroupByLabelMap.get(String(label || '')) || null;
}

export function localGroupForRanking(ranking) {
  if (!localCityByLabel(ranking?.category || ranking?.cat)) return null;
  const id = foldSeoText(ranking?.id)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const question = foldSeoText(ranking?.question || ranking?.q)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return (
    LOCAL_GROUPS.find(
      (group) => group.id.test(id) || (group.question && group.question.test(question)),
    ) || null
  );
}

export function isSeoLocalRanking(ranking) {
  return Boolean(
    localCityByLabel(ranking?.category || ranking?.cat) && localGroupForRanking(ranking),
  );
}

export function generalCategoryPath(category) {
  const value = typeof category === 'string' ? generalCategoryByLabel(category) : category;
  return value ? `/categoria/${value.slug}` : '/';
}

export function localCollectionPath(city, group = null) {
  const cityValue =
    typeof city === 'string' ? localCityByLabel(city) || localCityBySlug(city) : city;
  if (!cityValue) return '/local';
  const groupValue =
    typeof group === 'string' ? localGroupByLabel(group) || localGroupBySlug(group) : group;
  return `/local/${cityValue.slug}${groupValue ? `/${groupValue.slug}` : ''}`;
}
