(function registerTopoLocal(root) {
  const cityOrder = Object.freeze([
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
  ]);
  const legacyCityOrder = Object.freeze(['Balneário Camboriú']);
  const groupOrder = Object.freeze([
    'Todos',
    'Restaurantes em geral',
    'Pizza',
    'Hambúrguer',
    'Sushi/Japonês',
    'Café/Cafeteria',
    'Salão de beleza',
    'Barbearia',
    'Academia',
    'Pet shop',
    'Restaurante italiano',
    'Padaria',
    'Restaurante por quilo',
    'Restaurante/estabelecimento vegano',
    'Brechó',
  ]);

  function foldText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function cityKey(value) {
    return foldText(value)
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function routeSlug(value) {
    return foldText(value)
      .replace(/&/g, ' e ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  const cityAliases = Object.freeze(
    Object.assign(
      Object.fromEntries([...cityOrder, ...legacyCityOrder].map((city) => [cityKey(city), city])),
      {
        bc: 'Balneário Camboriú',
        floripa: 'Florianópolis',
        rio: 'Rio de Janeiro',
        sp: 'São Paulo',
        bh: 'Belo Horizonte',
        poa: 'Porto Alegre',
      },
    ),
  );
  const groupRules = Object.freeze([
    {
      name: 'Restaurante/estabelecimento vegano',
      id: /^(?:restaurantes?\s+veganos?|veganos?)(?:\s|$)/,
      question: /\b(?:restaurante|estabelecimento)\s+vegano\b|\bcomida\s+vegana\b/,
    },
    {
      name: 'Restaurante por quilo',
      id: /^(?:quilo|restaurantes?\s+por\s+quilo)(?:\s|$)/,
      question: /\b(?:restaurante\s+por\s+quilo|quilo|self\s+service)\b/,
    },
    {
      name: 'Restaurante italiano',
      id: /^restaurantes?\s+italianos?(?:\s|$)/,
      question: /\brestaurante\s+italiano\b/,
    },
    {
      name: 'Sushi/Japonês',
      id: /^(?:sushi|japones|restaurantes?\s+japoneses?)(?:\s|$)/,
      question: /\b(?:sushi|restaurante\s+japones)\b/,
    },
    {
      name: 'Pizza',
      id: /^(?:pizza|pizzarias?)(?:\s|$)/,
      question: /\b(?:pizza|pizzaria)\b/,
    },
    {
      name: 'Hambúrguer',
      id: /^(?:hamburguer|hamburguerias?)(?:\s|$)/,
      question: /\b(?:hamburguer|hamburgueria)\b/,
    },
    {
      name: 'Café/Cafeteria',
      id: /^(?:cafe|cafes|cafeterias?)(?:\s|$)/,
      question: /\b(?:cafe|cafeteria)\b/,
    },
    {
      name: 'Salão de beleza',
      id: /^(?:salao|saloes)\s+(?:de\s+)?beleza(?:\s|$)/,
      question: /\bsalao\s+de\s+beleza\b/,
    },
    {
      name: 'Barbearia',
      id: /^barbearias?(?:\s|$)/,
      question: /\bbarbearia\b/,
    },
    {
      name: 'Academia',
      id: /^academias?(?:\s|$)/,
      question: /\bacademia\b/,
    },
    {
      name: 'Pet shop',
      id: /^pet\s+shops?(?:\s|$)/,
      question: /\bpet\s+shop\b/,
    },
    {
      name: 'Padaria',
      id: /^padarias?(?:\s|$)/,
      question: /\bpadaria\b/,
    },
    {
      name: 'Brechó',
      id: /^brechos?(?:\s|$)/,
      question: /\bbrecho\b/,
    },
    {
      name: 'Restaurantes em geral',
      id: /^restaurantes?(?:\s|$)/,
      question: /\bmelhor\s+restaurante(?:\s+(?:em|de|do|da)|\?|$)/,
    },
  ]);

  function normalizeCity(value) {
    return cityAliases[cityKey(value)] || '';
  }

  function citySlug(value) {
    const city = normalizeCity(value);
    return city ? routeSlug(city) : '';
  }

  function cityFromSlug(value) {
    return normalizeCity(String(value || '').replace(/-/g, ' '));
  }

  function groupSlug(value) {
    const group = groupOrder.find((item) => item === value);
    return group && group !== 'Todos' ? routeSlug(group) : '';
  }

  function groupFromSlug(value) {
    const slug = routeSlug(value);
    return groupOrder.find((group) => group !== 'Todos' && routeSlug(group) === slug) || '';
  }

  function collectionPath(cityValue, groupValue = 'Todos') {
    const city = citySlug(cityValue);
    if (!city) return '/local';
    const group = groupSlug(groupValue);
    return `/local/${city}${group ? `/${group}` : ''}`;
  }

  function cityForRanking(ranking) {
    return normalizeCity(ranking?.cat);
  }

  function groupForRanking(ranking) {
    if (!cityForRanking(ranking)) return '';
    const id = cityKey(ranking?.id);
    const question = cityKey(ranking?.q);
    return (
      groupRules.find((rule) => rule.id.test(id) || (rule.question && rule.question.test(question)))
        ?.name || ''
    );
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
    return (rankings || []).filter(
      (ranking) => isLocalRanking(ranking) && cityForRanking(ranking) === selected,
    );
  }

  root.TopoLocal = Object.freeze({
    availableCities,
    cityFromSlug,
    cityForRanking,
    cityMatches: (ranking, city) => cityForRanking(ranking) === normalizeCity(city),
    cityOrder,
    citySlug,
    collectionPath,
    foldText,
    groupFromSlug,
    groupForRanking,
    groupOrder,
    groupSlug,
    isLocalRanking,
    legacyCityOrder,
    normalizeCity,
    prioritizeRankings,
    rankingsForCity,
    resolvePreferredCity,
  });
})(globalThis);
