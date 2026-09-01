import { readFile, writeFile } from 'node:fs/promises';

const USER_AGENT = 'SomosTopoCatalog/1.0 (https://somostopo.com.br; contato@somostopo.com.br)';
const LOCAL_PUBLIC_OPTION_COUNT = 20;
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const OUTPUT_URL = new URL('../data/local-catalog.json', import.meta.url);
const exclusions = JSON.parse(
  await readFile(new URL('../data/local-option-exclusions.json', import.meta.url), 'utf8'),
);
const publicOptionExpansion = JSON.parse(
  await readFile(new URL('../data/public-option-expansion.json', import.meta.url), 'utf8'),
);

const cities = Object.freeze([
  { name: 'São Paulo', state: 'SP', slug: 'sp' },
  { name: 'Rio de Janeiro', state: 'RJ', slug: 'rio' },
  { name: 'Brasília', state: 'DF', slug: 'brasilia', relationId: 421151 },
  { name: 'Fortaleza', state: 'CE', slug: 'fortaleza' },
  { name: 'Salvador', state: 'BA', slug: 'salvador' },
  { name: 'Belo Horizonte', state: 'MG', slug: 'belo-horizonte' },
  { name: 'Manaus', state: 'AM', slug: 'manaus' },
  { name: 'Curitiba', state: 'PR', slug: 'curitiba' },
  { name: 'Recife', state: 'PE', slug: 'recife' },
  { name: 'Goiânia', state: 'GO', slug: 'goiania' },
  { name: 'Belém', state: 'PA', slug: 'belem' },
  { name: 'Porto Alegre', state: 'RS', slug: 'porto-alegre' },
  { name: 'Guarulhos', state: 'SP', slug: 'guarulhos' },
  { name: 'Campinas', state: 'SP', slug: 'campinas' },
  { name: 'São Luís', state: 'MA', slug: 'sao-luis' },
  { name: 'Maceió', state: 'AL', slug: 'maceio' },
  { name: 'Campo Grande', state: 'MS', slug: 'campo-grande' },
  { name: 'São Gonçalo', state: 'RJ', slug: 'sao-goncalo' },
  { name: 'Teresina', state: 'PI', slug: 'teresina' },
  { name: 'João Pessoa', state: 'PB', slug: 'joao-pessoa' },
  { name: 'Florianópolis', state: 'SC', slug: 'floripa' },
]);

const images = Object.freeze({
  restaurants:
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=82',
  pizza:
    'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=82',
  burger:
    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=82',
  sushi:
    'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=1200&q=82',
  cafe: 'https://images.unsplash.com/photo-1561522983-385a76fbb4cb?auto=format&fit=crop&crop=entropy&w=1200&q=82',
  bar: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=82',
  beauty:
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=82',
  barber:
    'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=82',
  gym: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=82',
  sportsEvents:
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=82',
  pet: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1200&q=82',
  italian:
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=82',
  bakery:
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=82',
  buffet:
    'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=82',
  vegan:
    'https://images.unsplash.com/photo-1638328740227-1c4b1627614d?auto=format&fit=crop&crop=entropy&w=1200&q=82',
  thrift:
    'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=82',
});

const patterns = Object.freeze({
  pizza: /\b(?:pizza|pizzaria|pizzeria|pizzaiolo|forneria)\b/,
  burger: /\b(?:burger|burguer|hamburguer|hamburgueria|hamburger)\b/,
  sushi: /\b(?:sushi|temaki|temakeria|japa|japones|japanese|izakaya|ramen|yakisoba|nikkei|kappo)\b/,
  cafe: /\b(?:cafe|cafeteria|coffee|cafes)\b/,
  bar: /\b(?:bar|bares|pub|boteco|botequim|cervejaria|choperia|taproom|beer|bier)\b/,
  barber: /\b(?:barber|barbearia|barbeiro|barbershop|cavalheiros?)\b/,
  beauty: /\b(?:salao|beleza|beauty|cabeleireir|hair|esmalteria|estetica|studio)\b/,
  gym: /\b(?:academia|fitness|crossfit|cross training|gym|pilates|musculacao)\b/,
  pet: /\b(?:pet shop|petshop|pet center|petz|cobasi|petland|mundo animal)\b/,
  italian: /\b(?:italian|italiano|italiana|ristorante|trattoria|osteria|cantina|pasta|massas)\b/,
  bakery: /\b(?:padaria|panificadora|panificacao|paes|pao|bakery|boulangerie|confeitaria)\b/,
  buffet: /\b(?:quilo|buffet|self service|selfservice|self-service|comida caseira)\b/,
  vegan: /\b(?:vegano|vegana|vegan|vegetariano|vegetariana|vegetarian|plant based|plant-based)\b/,
  thrift: /\b(?:brecho|bazar|thrift|second hand|segunda mao|reuso)\b/,
});

const sportsEventOptions = Object.freeze([
  'Jogos de futebol',
  'Corridas de rua',
  'Maratonas e meias maratonas',
  'Torneios de futsal',
  'Jogos de vôlei',
  'Jogos de basquete',
  'Provas de ciclismo',
  'Competições de natação',
  'Torneios de tênis',
  'Competições de artes marciais',
  'Triatlo',
  'Competições de skate',
  'Jogos universitários',
  'Campeonatos escolares',
  'Eventos de esportes adaptados',
  'E-sports',
  'Competições de ginástica',
  'Provas de atletismo',
  'Torneios de handebol',
  'Eventos de rugby',
]);

const existingIds = new Set([
  'sushi-floripa',
  'pizzarias-floripa',
  'hamburguer-floripa',
  'cafes-floripa',
  'restaurantes-veganos-floripa',
  'padarias-floripa',
  'quilo-floripa',
  'sushi-sp',
  'pizza-sp',
  'hamburguer-sp',
  'padarias-sp',
  'quilo-sp',
  'sushi-rio',
  'pizza-rio',
  'hamburguer-rio',
  'padarias-rio',
  'quilo-rio',
]);

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function searchable(place) {
  return fold(
    [
      place.name,
      place.tags.cuisine,
      place.tags.description,
      place.tags.brand,
      place.tags.operator,
      place.tags['shop:category'],
    ].join(' '),
  );
}

function isRestaurant(place) {
  return ['restaurant', 'fast_food'].includes(place.tags.amenity);
}

function isFoodEstablishment(place) {
  return isRestaurant(place) || place.tags.amenity === 'cafe';
}

function tagContains(place, key, expected) {
  return fold(place.tags[key])
    .split(/\s+/)
    .some((value) => value === expected || value.includes(expected));
}

function categoryId(key, city) {
  const standard = {
    restaurants: `restaurantes-${city.slug}`,
    pizza: `pizza-${city.slug}`,
    burger: `hamburguer-${city.slug}`,
    sushi: `sushi-${city.slug}`,
    cafe: `cafes-${city.slug}`,
    bar: `bares-${city.slug}`,
    beauty: `saloes-beleza-${city.slug}`,
    barber: `barbearias-${city.slug}`,
    gym: `academias-${city.slug}`,
    sportsEvents: `eventos-esportivos-${city.slug}`,
    pet: `pet-shops-${city.slug}`,
    italian: `restaurantes-italianos-${city.slug}`,
    bakery: `padarias-${city.slug}`,
    buffet: `quilo-${city.slug}`,
    vegan: `restaurantes-veganos-${city.slug}`,
    thrift: `brechos-${city.slug}`,
  }[key];
  if (city.slug === 'floripa' && key === 'pizza') return 'pizzarias-floripa';
  return standard;
}

const categories = Object.freeze([
  {
    key: 'restaurants',
    label: 'Restaurantes em geral',
    question: (city) => `Qual é o melhor restaurante em ${city.name}?`,
    image: images.restaurants,
    match: (place) => place.tags.amenity === 'restaurant',
  },
  {
    key: 'pizza',
    label: 'Pizza',
    question: (city) => `Qual é a melhor pizzaria em ${city.name}?`,
    image: images.pizza,
    match: (place) =>
      isRestaurant(place) &&
      (tagContains(place, 'cuisine', 'pizza') || patterns.pizza.test(searchable(place))),
  },
  {
    key: 'burger',
    label: 'Hambúrguer',
    question: (city) => `Quem faz o melhor hambúrguer em ${city.name}?`,
    image: images.burger,
    match: (place) =>
      isRestaurant(place) &&
      (tagContains(place, 'cuisine', 'burger') || patterns.burger.test(searchable(place))),
  },
  {
    key: 'sushi',
    label: 'Sushi/Japonês',
    question: (city) => `Qual é o melhor sushi ou restaurante japonês em ${city.name}?`,
    image: images.sushi,
    match: (place) =>
      isRestaurant(place) &&
      (['sushi', 'japanese', 'ramen'].some((term) => tagContains(place, 'cuisine', term)) ||
        patterns.sushi.test(searchable(place))),
  },
  {
    key: 'cafe',
    label: 'Café/Cafeteria',
    question: (city) => `Qual é o melhor café ou cafeteria em ${city.name}?`,
    image: images.cafe,
    match: (place) =>
      place.tags.amenity === 'cafe' ||
      (isFoodEstablishment(place) && patterns.cafe.test(searchable(place))),
  },
  {
    key: 'bar',
    label: 'Bares',
    question: (city) => `Qual é o melhor bar em ${city.name}?`,
    image: images.bar,
    match: (place) =>
      ['bar', 'pub', 'biergarten'].includes(place.tags.amenity) ||
      (['restaurant', 'cafe', 'nightclub'].includes(place.tags.amenity) &&
        patterns.bar.test(searchable(place))),
  },
  {
    key: 'beauty',
    label: 'Salão de beleza',
    question: (city) => `Qual é o melhor salão de beleza em ${city.name}?`,
    image: images.beauty,
    match: (place) =>
      (['beauty', 'hairdresser'].includes(place.tags.shop) ||
        patterns.beauty.test(searchable(place))) &&
      !patterns.barber.test(searchable(place)) &&
      fold(place.tags.hairdresser) !== 'male',
  },
  {
    key: 'barber',
    label: 'Barbearia',
    question: (city) => `Qual é a melhor barbearia em ${city.name}?`,
    image: images.barber,
    match: (place) =>
      (place.tags.shop === 'hairdresser' || patterns.barber.test(searchable(place))) &&
      (fold(place.tags.hairdresser) === 'male' || patterns.barber.test(searchable(place))),
  },
  {
    key: 'gym',
    label: 'Academia',
    question: (city) => `Qual é a melhor academia em ${city.name}?`,
    image: images.gym,
    match: (place) =>
      place.tags.leisure === 'fitness_centre' || patterns.gym.test(searchable(place)),
  },
  {
    key: 'sportsEvents',
    label: 'Eventos esportivos',
    question: (city) => `Qual tipo de evento esportivo é o favorito em ${city.name}?`,
    image: images.sportsEvents,
    fixedOptions: sportsEventOptions,
  },
  {
    key: 'pet',
    label: 'Pet shop',
    question: (city) => `Qual é o melhor pet shop em ${city.name}?`,
    image: images.pet,
    match: (place) =>
      ['pet', 'pet_grooming'].includes(place.tags.shop) || patterns.pet.test(searchable(place)),
  },
  {
    key: 'italian',
    label: 'Restaurante italiano',
    question: (city) => `Qual é o melhor restaurante italiano em ${city.name}?`,
    image: images.italian,
    match: (place) =>
      isRestaurant(place) &&
      (tagContains(place, 'cuisine', 'italian') || patterns.italian.test(searchable(place))),
  },
  {
    key: 'bakery',
    label: 'Padaria',
    question: (city) => `Qual é a melhor padaria em ${city.name}?`,
    image: images.bakery,
    match: (place) => place.tags.shop === 'bakery' || patterns.bakery.test(searchable(place)),
  },
  {
    key: 'buffet',
    label: 'Restaurante por quilo',
    question: (city) => `Qual é o melhor restaurante por quilo em ${city.name}?`,
    image: images.buffet,
    match: (place) => isRestaurant(place) && patterns.buffet.test(searchable(place)),
  },
  {
    key: 'vegan',
    label: 'Restaurante vegano',
    question: (city) => `Qual é o melhor restaurante vegano em ${city.name}?`,
    image: images.vegan,
    match: (place) =>
      (isFoodEstablishment(place) || ['health_food', 'organic'].includes(place.tags.shop)) &&
      (['yes', 'only'].includes(fold(place.tags['diet:vegan'])) ||
        ['yes', 'only'].includes(fold(place.tags['diet:vegetarian'])) ||
        ['vegan', 'vegetarian'].some((term) => tagContains(place, 'cuisine', term)) ||
        patterns.vegan.test(searchable(place))),
  },
  {
    key: 'thrift',
    label: 'Brechó',
    question: (city) => `Qual é o melhor brechó em ${city.name}?`,
    image: images.thrift,
    match: (place) =>
      ['second_hand', 'charity'].includes(place.tags.shop) ||
      ['yes', 'only'].includes(fold(place.tags.second_hand)) ||
      patterns.thrift.test(searchable(place)),
  },
]);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, options = {}, attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...options.headers },
      });
      if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(attempt * 2500);
    }
  }
  throw lastError;
}

async function resolveRelation(city) {
  if (city.relationId) return city.relationId;
  const query = encodeURIComponent(`${city.name}, ${city.state}, Brasil`);
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&q=${query}`;
  const results = await fetchJson(url);
  const state = fold(city.state);
  const relation = results.find(
    (item) =>
      item.osm_type === 'relation' &&
      (item.type === 'administrative' || item.category === 'boundary') &&
      (!state ||
        fold(item.address?.state_code || item.address?.['ISO3166-2-lvl4']).includes(state)),
  );
  const fallback = results.find((item) => item.osm_type === 'relation');
  const selected = relation || fallback;
  if (!selected) throw new Error(`Não encontrei o limite municipal de ${city.name}.`);
  return Number(selected.osm_id);
}

function overpassQuery(relationId) {
  const areaId = 3600000000 + Number(relationId);
  return `[out:json][timeout:150];
area(${areaId})->.city;
nwr["amenity"="restaurant"]["name"](area.city)->.restaurants;
.restaurants out tags 1600;
nwr["amenity"="fast_food"]["name"](area.city)->.fastfood;
.fastfood out tags 900;
nwr["amenity"="cafe"]["name"](area.city)->.cafes;
.cafes out tags 700;
nwr["amenity"~"^(bar|pub|biergarten)$"]["name"](area.city)->.bars;
.bars out tags 900;
nwr["shop"~"^(hairdresser|beauty)$"]["name"](area.city)->.beauty;
.beauty out tags 900;
nwr["leisure"="fitness_centre"]["name"](area.city)->.gyms;
.gyms out tags 500;
nwr["shop"~"^(pet|pet_grooming)$"]["name"](area.city)->.pets;
.pets out tags 500;
nwr["shop"="bakery"]["name"](area.city)->.bakeries;
.bakeries out tags 700;
nwr["shop"~"^(health_food|organic|second_hand|charity)$"]["name"](area.city)->.specialshops;
.specialshops out tags 500;
nwr["shop"="clothes"]["second_hand"]["name"](area.city)->.secondhand;
.secondhand out tags 500;
nwr["name"~"pizza|pizzaria|pizzeria|burger|burguer|hamburg|sushi|temaki|japon|izakaya|ramen|bar|pub|boteco|botequim|cervejaria|choperia|barbear|barber|academia|fitness|crossfit|pet.?shop|italian|trattoria|osteria|cantina|ristorante|padaria|panificadora|boulangerie|quilo|buffet|self.?service|vegano|vegan|vegetariano|brech.|bazar",i](area.city)->.named;
.named out tags 1800;`;
}

function barsOverpassQuery(relationId) {
  const areaId = 3600000000 + Number(relationId);
  return `[out:json][timeout:120];
area(${areaId})->.city;
nwr["amenity"~"^(bar|pub|biergarten)$"]["name"](area.city)->.bars;
.bars out tags 1200;
nwr["amenity"~"^(restaurant|cafe|nightclub)$"]["name"~"bar|pub|boteco|botequim|cervejaria|choperia|taproom",i](area.city)->.namedbars;
.namedbars out tags 700;`;
}

async function fetchPlaces(city, relationId, cityIndex, query = overpassQuery) {
  const body = new URLSearchParams({ data: query(relationId) });
  let lastError;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const endpoint = OVERPASS_ENDPOINTS[(cityIndex + attempt) % OVERPASS_ENDPOINTS.length];
    try {
      const data = await fetchJson(
        endpoint,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body,
        },
        1,
      );
      return data.elements || [];
    } catch (error) {
      lastError = error;
      await delay((attempt + 1) * 3500);
    }
  }
  throw new Error(`${city.name}: ${lastError?.message || 'falha no Overpass'}`);
}

function cleanPlace(element) {
  const tags = element?.tags || {};
  const name = String(tags.name || '')
    .replace(/\s+/g, ' ')
    .trim();
  const normalized = fold(name);
  if (!name || name.length < 3 || name.length > 80) return null;
  if (!/[a-z]/.test(normalized) || /^\d+$/.test(normalized)) return null;
  if (
    /^(?:restaurante|lanchonete|pizzaria|padaria|academia|barbearia|salao|brecho|bazar|cafe|pet shop|bar|pub|boteco)$/i.test(
      normalized,
    )
  )
    return null;
  if (
    tags.disused ||
    tags.abandoned ||
    tags.demolished ||
    tags['disused:amenity'] ||
    tags['disused:shop'] ||
    fold(tags.opening_hours) === 'closed'
  )
    return null;
  return { name, normalized, tags };
}

function placeScore(place, category) {
  const tags = place.tags;
  let score = 0;
  if (tags.website || tags['contact:website']) score += 5;
  if (tags.phone || tags['contact:phone']) score += 3;
  if (tags.opening_hours) score += 2;
  if (tags['addr:street']) score += 2;
  if (tags.brand || tags.operator) score += 2;
  if (tags.wikidata || tags.wikipedia) score += 3;
  if (tags.cuisine) score += 2;
  if (category.key === 'restaurants' && tags.amenity === 'restaurant') score += 8;
  if (category.key === 'cafe' && tags.amenity === 'cafe') score += 8;
  if (category.key === 'bar' && ['bar', 'pub', 'biergarten'].includes(tags.amenity)) score += 10;
  if (category.key === 'beauty' && tags.shop === 'beauty') score += 7;
  if (category.key === 'barber' && fold(tags.hairdresser) === 'male') score += 9;
  if (category.key === 'gym' && tags.leisure === 'fitness_centre') score += 9;
  if (category.key === 'pet' && ['pet', 'pet_grooming'].includes(tags.shop)) score += 9;
  if (category.key === 'bakery' && tags.shop === 'bakery') score += 9;
  if (category.key === 'thrift' && ['second_hand', 'charity'].includes(tags.shop)) score += 9;
  if (category.key === 'vegan' && fold(tags['diet:vegan']) === 'only') score += 10;
  return score;
}

function bestOptions(elements, category) {
  const deduped = new Map();
  for (const element of elements) {
    const place = cleanPlace(element);
    if (!place || !category.match(place)) continue;
    const current = deduped.get(place.normalized);
    const score = placeScore(place, category);
    if (!current || score > current.score) deduped.set(place.normalized, { ...place, score });
  }
  return [...deduped.values()]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, LOCAL_PUBLIC_OPTION_COUNT)
    .map((place) => place.name);
}

function makeRanking(city, category, labels) {
  const id = categoryId(category.key, city);
  const rejected = new Set(exclusions[id] || []);
  const curatedLabels = [...labels, ...(publicOptionExpansion.local[id] || [])]
    .filter((label) => !rejected.has(label))
    .filter((label, index, all) => all.indexOf(label) === index)
    .slice(0, LOCAL_PUBLIC_OPTION_COUNT);
  return {
    id,
    city: city.name,
    citySlug: city.slug,
    state: city.state,
    localCategory: category.label,
    localCategoryKey: category.key,
    category: city.name,
    question: category.question(city),
    image_url: category.image,
    baseline_votes: 0,
    is_active: curatedLabels.length === LOCAL_PUBLIC_OPTION_COUNT,
    preserveExistingOptions: existingIds.has(id),
    opts: curatedLabels.map((label, index) => ({
      label,
      position: index + 1,
      baseline_score: 0,
    })),
  };
}

function makeRankings(city, elements) {
  return categories.map((category) =>
    makeRanking(
      city,
      category,
      category.fixedOptions ? [...category.fixedOptions] : bestOptions(elements, category),
    ),
  );
}

function rankingsFromSeed(seed) {
  if (!seed || typeof seed !== 'object' || !seed.cities) {
    throw new Error('O arquivo de sementes precisa conter o objeto "cities".');
  }
  return cities.flatMap((city) =>
    categories.map((category) => {
      const labels = category.fixedOptions || seed.cities?.[city.slug]?.[category.key];
      if (!Array.isArray(labels)) {
        throw new Error(`Sementes ausentes para ${city.slug}/${category.key}.`);
      }
      return makeRanking(city, category, labels);
    }),
  );
}

function validate(rankings, allowIncomplete = false, requireCompleteMatrix = true) {
  if (requireCompleteMatrix && rankings.length !== cities.length * categories.length) {
    throw new Error(
      `O catálogo tem ${rankings.length} rankings; deveria ter ${cities.length * categories.length}.`,
    );
  }
  if (new Set(rankings.map((ranking) => ranking.id)).size !== rankings.length) {
    throw new Error('Há IDs repetidos no catálogo local.');
  }
  const incomplete = rankings.filter((ranking) => ranking.opts.length < LOCAL_PUBLIC_OPTION_COUNT);
  const invalidActive = rankings.filter(
    (ranking) =>
      ranking.opts.length > LOCAL_PUBLIC_OPTION_COUNT ||
      (ranking.is_active && ranking.opts.length !== LOCAL_PUBLIC_OPTION_COUNT),
  );
  if (invalidActive.length && !allowIncomplete) {
    throw new Error(
      `Há ${invalidActive.length} rankings públicos sem exatamente ${LOCAL_PUBLIC_OPTION_COUNT} opções:\n${invalidActive
        .map((ranking) => `${ranking.id}: ${ranking.opts.length}`)
        .join('\n')}`,
    );
  }
  return incomplete;
}

function sqlStatements(rankings, requireCompleteMatrix = true) {
  validate(rankings, false, requireCompleteMatrix);
  const sqlText = String.raw;
  const rankingPayload = JSON.stringify(
    rankings.map(({ id, category, question, image_url, baseline_votes, is_active }) => ({
      id,
      category,
      question,
      image_url,
      baseline_votes,
      is_active,
    })),
  );
  const freshPayload = JSON.stringify(
    rankings
      .filter((ranking) => !ranking.preserveExistingOptions)
      .map(({ id, opts }) => ({ id, opts })),
  );
  const expectedPayload = JSON.stringify(
    rankings.map((ranking) => ({ id: ranking.id, expected_options: ranking.opts.length })),
  );
  return [
    sqlText`WITH incoming AS (
      SELECT *
      FROM jsonb_to_recordset('${rankingPayload.replaceAll("'", "''")}'::jsonb) AS ranking(
        id text,
        category text,
        question text,
        image_url text,
        baseline_votes integer,
        is_active boolean
      )
    )
    INSERT INTO rankings (
      id, category, question, image_url, baseline_votes, is_active, created_at
    )
    SELECT
      id, category, question, image_url, baseline_votes, is_active, now()
    FROM incoming
    ON CONFLICT (id) DO UPDATE SET
      category = EXCLUDED.category,
      question = COALESCE(NULLIF(rankings.question, ''), EXCLUDED.question),
      image_url = COALESCE(NULLIF(rankings.image_url, ''), EXCLUDED.image_url),
      is_active = EXCLUDED.is_active;`,
    sqlText`WITH ranking_rows AS (
      SELECT *
      FROM jsonb_to_recordset('${freshPayload.replaceAll("'", "''")}'::jsonb) AS ranking(
        id text,
        opts jsonb
      )
    ), incoming AS (
      SELECT
        ranking.id AS ranking_id,
        option.label,
        option.position,
        option.baseline_score
      FROM ranking_rows ranking
      CROSS JOIN LATERAL jsonb_to_recordset(ranking.opts) AS option(
        label text,
        position integer,
        baseline_score integer
      )
    )
    INSERT INTO ranking_options (ranking_id, label, position, baseline_score)
    SELECT ranking_id, label, position, baseline_score
    FROM incoming
    WHERE NOT EXISTS (
      SELECT 1
      FROM ranking_options existing
      WHERE existing.ranking_id = incoming.ranking_id
    )
    ON CONFLICT (ranking_id, position) DO UPDATE SET
      label = EXCLUDED.label,
      baseline_score = EXCLUDED.baseline_score;`,
    sqlText`WITH expected AS (
      SELECT *
      FROM jsonb_to_recordset('${expectedPayload.replaceAll("'", "''")}'::jsonb) AS ranking(
        id text,
        expected_options integer
      )
    ), counts AS (
      SELECT ranking_id, COUNT(*)::int AS total
      FROM ranking_options
      GROUP BY ranking_id
    )
    SELECT
      COUNT(*)::int AS rankings,
      COUNT(*) FILTER (
        WHERE counts.total >= expected.expected_options
      )::int AS complete_rankings,
      MIN(counts.total)::int AS minimum_options,
      MAX(counts.total)::int AS maximum_options
    FROM expected
    JOIN rankings ON rankings.id = expected.id AND rankings.is_active = true
    JOIN counts ON counts.ranking_id = expected.id;`,
  ];
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--sql')) {
    const rankings = JSON.parse(await readFile(OUTPUT_URL, 'utf8')).map((ranking) => {
      const opts = [
        ...(ranking.opts || []),
        ...(publicOptionExpansion.local[ranking.id] || []).map((label) => ({
          label,
          baseline_score: 0,
        })),
      ]
        .filter(
          (option, index, all) =>
            all.findIndex((candidate) => candidate.label === option.label) === index,
        )
        .slice(0, LOCAL_PUBLIC_OPTION_COUNT)
        .map((option, index) => ({ ...option, position: index + 1 }));
      return {
        ...ranking,
        is_active: opts.length === LOCAL_PUBLIC_OPTION_COUNT,
        opts,
      };
    });
    const requestedKeys = process.argv
      .find((value) => value.startsWith('--categories='))
      ?.slice(13)
      .split(',')
      .filter(Boolean);
    const selectedRankings = requestedKeys?.length
      ? rankings.filter((ranking) => requestedKeys.includes(ranking.localCategoryKey))
      : rankings;
    if (requestedKeys?.length && selectedRankings.length !== cities.length * requestedKeys.length) {
      throw new Error(`Categorias locais incompletas: ${requestedKeys.join(', ')}.`);
    }
    process.stdout.write(JSON.stringify(sqlStatements(selectedRankings, !requestedKeys?.length)));
    return;
  }

  const seedPath = process.argv.find((value) => value.startsWith('--seed='))?.slice(7);
  if (seedPath) {
    const seed = JSON.parse(await readFile(seedPath, 'utf8'));
    const rankings = rankingsFromSeed(seed);
    validate(rankings);
    await writeFile(OUTPUT_URL, `${JSON.stringify(rankings)}\n`);
    console.error(
      `Catálogo salvo em ${OUTPUT_URL.pathname}: ${rankings.length} rankings, ` +
        `${rankings.reduce((total, ranking) => total + ranking.opts.length, 0)} opções.`,
    );
    return;
  }

  const requestedCity = process.argv.find((value) => value.startsWith('--city='))?.slice(7);
  const augmentExisting = args.has('--augment');
  const existingCatalog = augmentExisting ? JSON.parse(await readFile(OUTPUT_URL, 'utf8')) : [];
  const existingById = new Map(existingCatalog.map((ranking) => [ranking.id, ranking]));
  const selectedCities = requestedCity
    ? cities.filter(
        (city) => fold(city.name) === fold(requestedCity) || city.slug === requestedCity,
      )
    : cities;
  if (!selectedCities.length) throw new Error(`Cidade desconhecida: ${requestedCity}`);

  const rankings = [];
  for (const [index, city] of selectedCities.entries()) {
    const missingCategories = categories.filter(
      (category) => !existingById.has(categoryId(category.key, city)),
    );
    if (augmentExisting && !missingCategories.length) {
      rankings.push(
        ...categories.map((category) => existingById.get(categoryId(category.key, city))),
      );
      continue;
    }
    console.error(
      `[${index + 1}/${selectedCities.length}] ${city.name}: resolvendo limite municipal...`,
    );
    const dynamicCategories = augmentExisting
      ? missingCategories.filter((category) => !category.fixedOptions)
      : categories.filter((category) => !category.fixedOptions);
    let elements = [];
    if (dynamicCategories.length) {
      const relationId = await resolveRelation(city);
      await delay(1100);
      console.error(
        `[${index + 1}/${selectedCities.length}] ${city.name}: buscando estabelecimentos...`,
      );
      elements = await fetchPlaces(
        city,
        relationId,
        index,
        augmentExisting && dynamicCategories.every((category) => category.key === 'bar')
          ? barsOverpassQuery
          : overpassQuery,
      );
    }
    const cityRankings = categories.map((category) => {
      const existing = existingById.get(categoryId(category.key, city));
      if (augmentExisting && existing) return existing;
      const labels = category.fixedOptions
        ? [...category.fixedOptions]
        : bestOptions(elements, category);
      return makeRanking(city, category, labels);
    });
    rankings.push(...cityRankings);
    console.error(
      `[${index + 1}/${selectedCities.length}] ${city.name}: ${elements.length} registros; ` +
        cityRankings
          .map((ranking) => `${ranking.localCategoryKey}=${ranking.opts.length}`)
          .join(', '),
    );
    await delay(1600);
  }

  const incomplete =
    selectedCities.length === cities.length
      ? validate(rankings, true)
      : rankings.filter((r) => r.opts.length < LOCAL_PUBLIC_OPTION_COUNT);
  if (args.has('--report') || selectedCities.length !== cities.length) {
    process.stdout.write(
      JSON.stringify(
        {
          cities: selectedCities.length,
          rankings: rankings.length,
          incomplete: incomplete.map((ranking) => ({
            id: ranking.id,
            options: ranking.opts.length,
          })),
          data: rankings,
        },
        null,
        2,
      ),
    );
    return;
  }

  await writeFile(OUTPUT_URL, `${JSON.stringify(rankings)}\n`);
  console.error(`Catálogo salvo em ${OUTPUT_URL.pathname}.`);
  validate(rankings);
}

await main();
