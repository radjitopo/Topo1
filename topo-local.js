(function registerTopoLocal(root) {
  const cityAliases = Object.freeze({
    'balneario camboriu': 'Balneário Camboriú',
    'balneario-camboriu': 'Balneário Camboriú',
    bc: 'Balneário Camboriú',
    floripa: 'Florianópolis',
    florianopolis: 'Florianópolis',
    rio: 'Rio de Janeiro',
    'rio de janeiro': 'Rio de Janeiro',
    'rio-de-janeiro': 'Rio de Janeiro',
    sp: 'São Paulo',
    'sao paulo': 'São Paulo',
    'sao-paulo': 'São Paulo',
  });
  const cityOrder = Object.freeze([
    'Florianópolis',
    'Balneário Camboriú',
    'São Paulo',
    'Rio de Janeiro',
  ]);
  const groupOrder = Object.freeze([
    'Todos',
    'Restaurantes',
    'Cafés',
    'Padarias',
    'Pizzarias',
    'Bares',
    'Mercados',
    'Hotéis',
    'Serviços',
  ]);
  const groupRules = Object.freeze([
    ['Cafés', /\b(?:cafe|cafes|cafeteria|cafeterias)\b/],
    ['Padarias', /\b(?:padaria|padarias|panificadora|panificadoras)\b/],
    ['Pizzarias', /\b(?:pizza|pizzas|pizzaria|pizzarias)\b/],
    ['Bares', /\b(?:bar|bares|pub|pubs)\b/],
    ['Mercados', /\b(?:mercado|mercados|supermercado|supermercados|hortifruti)\b/],
    ['Hotéis', /\b(?:hotel|hoteis|pousada|pousadas|hostel|hostels)\b/],
    [
      'Serviços',
      /\b(?:servico|servicos|salao|saloes|barbearia|barbearias|academia|academias|lavanderia|lavanderias|oficina|oficinas)\b|\bpet shops?\b/,
    ],
    [
      'Restaurantes',
      /\b(?:restaurante|restaurantes|sushi|hamburguer|hamburgueres|hamburgueria|hamburguerias|quilo|buffet|buffets|lanchonete|lanchonetes|churrascaria|churrascarias|sorveteria|sorveterias|vegano|veganos)\b/,
    ],
  ]);

  function foldText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function normalizeCity(value) {
    return cityAliases[foldText(value)] || '';
  }

  function cityForRanking(ranking) {
    return normalizeCity(ranking?.cat);
  }

  function groupForRanking(ranking) {
    if (!cityForRanking(ranking)) return '';
    const text = foldText(`${ranking?.id || ''} ${ranking?.q || ''}`).replace(/[-_]+/g, ' ');
    return groupRules.find(([, pattern]) => pattern.test(text))?.[0] || '';
  }

  function isLocalRanking(ranking) {
    return Boolean(cityForRanking(ranking) && groupForRanking(ranking));
  }

  function availableCities(rankings) {
    const present = new Set(
      (rankings || []).filter(isLocalRanking).map(cityForRanking).filter(Boolean),
    );
    return cityOrder.filter((city) => present.has(city));
  }

  function resolvePreferredCity(rankings, savedCity, detectedCity) {
    const cities = availableCities(rankings),
      supported = new Set(cities);
    for (const candidate of [savedCity, detectedCity, 'Florianópolis', cities[0]]) {
      const city = normalizeCity(candidate);
      if (city && supported.has(city)) return city;
    }
    return '';
  }

  function prioritizeRankings(rankings, city) {
    const preferred = normalizeCity(city);
    if (!preferred) return [...(rankings || [])];
    return (rankings || [])
      .map((ranking, index) => ({ ranking, index }))
      .sort(
        (a, b) =>
          Number(cityForRanking(b.ranking) === preferred) -
            Number(cityForRanking(a.ranking) === preferred) || a.index - b.index,
      )
      .map(({ ranking }) => ranking);
  }

  function rankingsForCity(rankings, city) {
    const selected = normalizeCity(city);
    if (!selected) return [];
    return (rankings || []).filter((ranking) => cityForRanking(ranking) === selected);
  }

  root.TopoLocal = Object.freeze({
    availableCities,
    cityForRanking,
    cityMatches: (ranking, city) => cityForRanking(ranking) === normalizeCity(city),
    cityOrder,
    foldText,
    groupForRanking,
    groupOrder,
    isLocalRanking,
    normalizeCity,
    prioritizeRankings,
    rankingsForCity,
    resolvePreferredCity,
  });
})(globalThis);
