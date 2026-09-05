(() => {
  if (typeof document === 'undefined' || typeof fetch === 'undefined') return;

  const photoCache = new Map();
  const entityCache = new Map();

  const CURATED_ENTITIES = Object.freeze({});
  const BLOCKED_ENTITIES = new Set();

  const plain = (value) => {
    const el = document.createElement('span');
    el.innerHTML = String(value || '');
    return (el.textContent || '').replace(/\s+/g, ' ').trim();
  };

  const fold = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/gi, ' ')
      .trim()
      .toLowerCase();

  const hasAny = (text, words) => words.some((word) => text.includes(word));

  const profiles = [
    {
      id: 'basketball-player',
      title: ['basquete', 'basketball', 'nba', 'wnba'],
      description: ['basketball player', 'jogador de basquete', 'jogadora de basquete', 'basquetebolista'],
      reject: ['footballer', 'futebolista', 'association football'],
    },
    {
      id: 'tennis-player',
      title: ['tenis', 'tenista', 'atp', 'wta'],
      description: ['tennis player', 'tenista'],
      reject: ['footballer', 'futebolista', 'association football'],
    },
    {
      id: 'football-player',
      title: ['jogador', 'jogadora', 'goleiro', 'zagueiro', 'atacante', 'meio campista', 'lateral', 'volante', 'camisa 10', 'futebolista'],
      description: ['footballer', 'football player', 'association football player', 'soccer player', 'futebolista', 'jogador de futebol', 'jogadora de futebol'],
      reject: ['city', 'cidade', 'municipality', 'municipio', 'commune', 'comuna'],
    },
    {
      id: 'band',
      title: ['banda', 'bandas', 'grupo musical'],
      description: ['band', 'musical group', 'banda', 'grupo musical', 'music group'],
      reject: ['album', 'song', 'cancao', 'single'],
    },
    {
      id: 'musician',
      title: ['cantor', 'cantora', 'musico', 'guitarrista', 'baixista', 'baterista', 'rapper', 'vocalista'],
      description: ['singer', 'musician', 'singer songwriter', 'rapper', 'guitarist', 'bassist', 'drummer', 'cantor', 'cantora', 'musico', 'guitarrista'],
      reject: ['album', 'song', 'cancao'],
    },
    {
      id: 'actor',
      title: ['ator', 'atriz', 'atores', 'atrizes', 'atuacao'],
      description: ['actor', 'actress', 'ator', 'atriz'],
      reject: ['film', 'filme', 'television series', 'serie de televisao'],
    },
    {
      id: 'director',
      title: ['diretor', 'diretora', 'cineasta'],
      description: ['film director', 'director', 'cineasta', 'diretor de cinema', 'diretora de cinema'],
      reject: ['film', 'filme'],
    },
    {
      id: 'film',
      title: ['filme', 'filmes', 'cinema'],
      description: ['film', 'filme'],
      reject: ['actor', 'actress', 'ator', 'atriz', 'film director', 'diretor'],
    },
    {
      id: 'tv-series',
      title: ['serie', 'series', 'televisao', 'tv'],
      description: ['television series', 'tv series', 'serie de televisao', 'serie televisiva'],
      reject: ['actor', 'actress', 'ator', 'atriz'],
    },
    {
      id: 'artist',
      title: ['artista', 'pintor', 'pintora', 'fotografo', 'fotografa', 'escultor', 'escultora'],
      description: ['artist', 'painter', 'photographer', 'sculptor', 'artista', 'pintor', 'pintora', 'fotografo', 'fotografa', 'escultor', 'escultora'],
      reject: ['city', 'cidade'],
    },
    {
      id: 'racing-driver',
      title: ['piloto', 'formula 1', 'f1', 'automobilismo'],
      description: ['racing driver', 'racecar driver', 'piloto automobilistico', 'piloto de automobilismo', 'formula one driver'],
      reject: ['airline pilot', 'aviator', 'aviador'],
    },
    {
      id: 'sports-club',
      title: ['clube', 'clubes', 'time', 'times', 'torcida', 'torcidas'],
      description: ['football club', 'association football club', 'soccer club', 'sports club', 'sports team', 'clube de futebol', 'clube esportivo', 'equipe esportiva'],
      reject: ['city', 'cidade', 'municipality', 'municipio'],
    },
    {
      id: 'place',
      title: ['cidade', 'cidades', 'pais', 'paises', 'capital', 'capitais', 'bairro', 'bairros', 'praia', 'praias', 'ilha', 'ilhas', 'lugar', 'lugares', 'viagem', 'viagens'],
      description: ['city', 'municipality', 'country', 'capital', 'neighborhood', 'district', 'beach', 'island', 'cidade', 'municipio', 'pais', 'capital', 'bairro', 'praia', 'ilha'],
      reject: ['footballer', 'futebolista', 'actor', 'atriz', 'ator', 'singer', 'cantor'],
    },
    {
      id: 'restaurant',
      title: ['restaurante', 'restaurantes', 'pizzaria', 'pizzarias', 'hamburgueria', 'hamburguerias', 'sushi', 'cafe', 'cafes', 'padaria', 'padarias', 'bar', 'bares', 'boteco', 'botecos'],
      description: ['restaurant', 'cafe', 'coffeehouse', 'bakery', 'bar', 'pizzeria', 'restaurante', 'cafeteria', 'padaria', 'pizzaria'],
      reject: ['city', 'cidade', 'album', 'song'],
    },
    {
      id: 'animal',
      title: ['animal', 'animais', 'cachorro', 'cachorros', 'cao', 'caes', 'gato', 'gatos', 'raca', 'racas'],
      description: ['animal', 'species', 'breed', 'dog breed', 'cat breed', 'especie', 'raca de cao', 'raca de cachorro', 'raca de gato'],
      reject: ['person', 'pessoa'],
    },
    {
      id: 'vehicle',
      title: ['carro', 'carros', 'automovel', 'automoveis', 'moto', 'motos', 'motocicleta', 'motocicletas'],
      description: ['automobile', 'car model', 'vehicle', 'motorcycle', 'automovel', 'modelo de automovel', 'veiculo', 'motocicleta'],
      reject: ['person', 'pessoa'],
    },
    {
      id: 'video-game',
      title: ['videogame', 'video game', 'jogo eletronico', 'games'],
      description: ['video game', 'jogo eletronico'],
      reject: ['person', 'pessoa'],
    },
    {
      id: 'book',
      title: ['livro', 'livros', 'romance', 'romances'],
      description: ['book', 'novel', 'livro', 'romance'],
      reject: ['person', 'pessoa', 'writer', 'escritor'],
    },
    {
      id: 'album',
      title: ['album', 'albuns', 'disco', 'discos'],
      description: ['album', 'album musical', 'studio album'],
      reject: ['person', 'pessoa', 'band', 'banda'],
    },
    {
      id: 'food',
      title: ['comida', 'comidas', 'prato', 'pratos', 'sobremesa', 'sobremesas', 'queijo', 'queijos', 'pao', 'paes', 'tempero', 'temperos', 'acompanhamento', 'acompanhamentos', 'culinaria'],
      description: ['food', 'dish', 'dessert', 'cheese', 'bread', 'spice', 'culinary', 'comida', 'prato', 'sobremesa', 'queijo', 'pao', 'tempero', 'culinaria'],
      reject: ['person', 'pessoa'],
    },
  ];

  function currentTitle() {
    return fold(document.querySelector('.rankingHero h1, .rankingHead h1, .rankingMain h1, h1')?.textContent);
  }

  function currentRankingKey() {
    const parts = location.pathname.split('/').filter(Boolean);
    return fold(parts.at(-1) || '');
  }

  function contextProfile() {
    const title = currentTitle();
    if (!title) return null;
    return profiles.find((profile) => hasAny(title, profile.title)) || null;
  }

  function curatedEntity(label) {
    return CURATED_ENTITIES[`${currentRankingKey()}|${fold(label)}`] || '';
  }

  async function wikidataSearch(label, language) {
    const endpoint = new URL('https://www.wikidata.org/w/api.php');
    endpoint.search = new URLSearchParams({
      action: 'wbsearchentities',
      format: 'json',
      origin: '*',
      type: 'item',
      limit: '8',
      search: label,
      language,
      uselang: language,
    }).toString();
    const response = await fetch(endpoint, { mode: 'cors' });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data?.search) ? data.search : [];
  }

  function candidateScore(candidate, label, profile) {
    if (!candidate?.id || BLOCKED_ENTITIES.has(candidate.id)) return -Infinity;
    const wanted = fold(label);
    const candidateLabel = fold(candidate.label);
    const aliases = (candidate.aliases || []).map(fold);
    const exactLabel = candidateLabel === wanted;
    const exactAlias = aliases.includes(wanted);
    if (!exactLabel && !exactAlias) return -Infinity;

    const description = fold(candidate.description);
    if (!description || !hasAny(description, profile.description)) return -Infinity;
    if (profile.reject?.length && hasAny(description, profile.reject)) return -Infinity;

    return (exactLabel ? 8 : 6) + profile.description.filter((word) => description.includes(word)).length;
  }

  async function resolveEntity(label, profile) {
    const override = curatedEntity(label);
    if (override) return override;

    const cacheKey = `${profile.id}|${fold(label)}`;
    if (entityCache.has(cacheKey)) return entityCache.get(cacheKey);

    const promise = (async () => {
      const groups = await Promise.all([
        wikidataSearch(label, 'pt').catch(() => []),
        wikidataSearch(label, 'en').catch(() => []),
      ]);
      const deduped = new Map();
      groups.flat().forEach((candidate) => {
        if (!deduped.has(candidate.id)) deduped.set(candidate.id, candidate);
        else if (!deduped.get(candidate.id)?.description && candidate.description)
          deduped.set(candidate.id, candidate);
      });

      const ranked = [...deduped.values()]
        .map((candidate) => ({ candidate, score: candidateScore(candidate, label, profile) }))
        .filter(({ score }) => Number.isFinite(score))
        .sort((a, b) => b.score - a.score);

      if (!ranked.length) return '';
      if (ranked[1] && ranked[1].score >= ranked[0].score) return '';
      return ranked[0].candidate.id;
    })().catch(() => '');

    entityCache.set(cacheKey, promise);
    return promise;
  }

  async function entityImageFile(entityId) {
    const endpoint = new URL('https://www.wikidata.org/w/api.php');
    endpoint.search = new URLSearchParams({
      action: 'wbgetentities',
      format: 'json',
      origin: '*',
      ids: entityId,
      props: 'claims',
    }).toString();
    const response = await fetch(endpoint, { mode: 'cors' });
    if (!response.ok) return '';
    const data = await response.json();
    return String(
      data?.entities?.[entityId]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value || '',
    ).trim();
  }

  const safeLicense = (value) =>
    /^(?:cc0|public domain|cc by(?:-sa)?(?:\s|$))/i.test(plain(value));

  async function commonsImage(fileName) {
    if (!fileName) return null;
    const endpoint = new URL('https://commons.wikimedia.org/w/api.php');
    endpoint.search = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      titles: `File:${fileName}`,
      prop: 'imageinfo',
      iiprop: 'url|mime|extmetadata',
      iiurlwidth: '720',
    }).toString();
    const response = await fetch(endpoint, { mode: 'cors' });
    if (!response.ok) return null;
    const data = await response.json();
    const page = Object.values(data?.query?.pages || {})[0];
    const info = page?.imageinfo?.[0];
    if (
      !info?.thumburl ||
      !String(info.mime || '').startsWith('image/') ||
      !safeLicense(info.extmetadata?.LicenseShortName?.value)
    )
      return null;

    const meta = info.extmetadata || {};
    const author = plain(meta.Artist?.value || meta.Credit?.value).slice(0, 72);
    const license = plain(meta.LicenseShortName?.value).slice(0, 28);
    return {
      src: info.thumburl,
      credit: `${author ? `${author} · ` : ''}${license} · Wikimedia Commons`,
    };
  }

  async function verifiedPhoto(label) {
    const profile = contextProfile();
    if (!profile) return null;

    const key = `${profile.id}|${currentRankingKey()}|${fold(label)}`;
    if (photoCache.has(key)) return photoCache.get(key);

    const promise = (async () => {
      const entityId = await resolveEntity(label, profile);
      if (!entityId) return null;
      const fileName = await entityImageFile(entityId);
      if (!fileName) return null;
      return commonsImage(fileName);
    })().catch(() => null);

    photoCache.set(key, promise);
    return promise;
  }

  function installStyles() {
    if (document.getElementById('duelVerifiedPhotoStyles')) return;
    const style = document.createElement('style');
    style.id = 'duelVerifiedPhotoStyles';
    style.textContent = `
      body.popElectric.rankingPage .duelChoice.duelChoiceWithVerifiedPhoto{
        min-height:0;
        display:grid;
        grid-template-rows:138px auto;
        align-content:stretch;
        gap:8px;
        padding:8px;
      }
      body.popElectric.rankingPage .duelChoiceVerifiedPhoto{
        position:relative;
        display:block;
        width:100%;
        height:138px;
        overflow:hidden;
        border:2px solid var(--ink,#151019);
        background:var(--lilac,#eee8e2);
      }
      body.popElectric.rankingPage .duelChoiceVerifiedPhoto img{
        display:block;
        width:100%;
        height:100%;
        object-fit:cover;
        object-position:center;
      }
      body.popElectric.rankingPage .duelChoiceVerifiedPhoto small{
        position:absolute;
        left:0;
        right:0;
        bottom:0;
        max-height:24px;
        overflow:hidden;
        background:rgba(0,0,0,.68);
        color:#fff;
        padding:3px 5px;
        text-align:left;
        font:700 6px/1.15 Arial,Helvetica,sans-serif;
        letter-spacing:0;
      }
      body.popElectric.rankingPage .duelChoice.duelChoiceWithVerifiedPhoto>strong{
        align-self:center;
        margin:0;
        padding:0 3px;
        font-size:clamp(21px,3vw,34px);
        line-height:.96;
      }
      @media(max-width:900px){
        body.popElectric.rankingPage .duelChoice.duelChoiceWithVerifiedPhoto{
          grid-template-rows:74px auto;
          gap:5px;
          padding:6px;
        }
        body.popElectric.rankingPage .duelChoiceVerifiedPhoto{height:74px;border-width:1px}
        body.popElectric.rankingPage .duelChoice.duelChoiceWithVerifiedPhoto>strong{
          font-size:clamp(16px,4.7vw,21px);
          line-height:.96;
        }
        body.popElectric.rankingPage .duelChoiceVerifiedPhoto small{
          max-height:17px;
          padding:2px 3px;
          font-size:5px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function appendPhoto(button, photo, label) {
    if (!photo?.src || !button.isConnected || button.querySelector('.duelChoiceVerifiedPhoto')) return;

    const image = new Image();
    image.alt = '';
    image.decoding = 'async';
    image.loading = 'eager';

    image.addEventListener(
      'load',
      () => {
        if (!button.isConnected || button.querySelector('.duelChoiceVerifiedPhoto')) return;
        const currentLabel = button.querySelector(':scope > strong')?.textContent?.trim();
        if (fold(currentLabel) !== fold(label)) return;

        const frame = document.createElement('span');
        frame.className = 'duelChoiceVerifiedPhoto';
        const credit = document.createElement('small');
        credit.textContent = photo.credit;
        frame.append(image, credit);
        button.prepend(frame);
        button.classList.add('duelChoiceWithVerifiedPhoto');
      },
      { once: true },
    );

    image.src = photo.src;
  }

  async function enhance(button) {
    if (!(button instanceof HTMLElement) || button.dataset.duelVerifiedPhotoChecked) return;
    button.dataset.duelVerifiedPhotoChecked = '1';
    const label = button.querySelector(':scope > strong')?.textContent?.trim();
    if (!label) return;

    const photo = await verifiedPhoto(label);
    if (!photo) return;
    appendPhoto(button, photo, label);
  }

  const scan = (root = document) =>
    root
      .querySelectorAll?.('.duelChoice:not([data-duel-verified-photo-checked])')
      .forEach(enhance);

  installStyles();
  scan();

  new MutationObserver((records) => {
    records.forEach((record) =>
      record.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches?.('.duelChoice')) enhance(node);
        scan(node);
      }),
    );
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
