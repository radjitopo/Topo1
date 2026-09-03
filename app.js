const feed = document.getElementById('feed'),
  groupsEl = document.getElementById('groups'),
  accountEl = document.getElementById('account'),
  sitePulseEl = document.getElementById('sitePulse'),
  searchForm = document.getElementById('siteSearchForm'),
  searchInput = document.getElementById('rankingSearch'),
  searchCityInput = document.getElementById('searchCity'),
  cityPickerEl = document.getElementById('cityPicker'),
  citySelectEl = document.getElementById('citySelect'),
  experienceLinks = [...document.querySelectorAll('[data-experience]')],
  topoLocal = globalThis.TopoLocal,
  storeKey = 'topo_device_id',
  cityStoreKey = 'topo_local_city',
  firstShowKey = 'topo_first_show_seen',
  lastHeroKey = 'topo_last_home_hero';
function newDeviceId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : 'd-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}
let deviceId = localStorage.getItem(storeKey);
if (!deviceId) {
  deviceId = newDeviceId();
  localStorage.setItem(storeKey, deviceId);
}
function rotateDeviceId() {
  deviceId = newDeviceId();
  localStorage.setItem(storeKey, deviceId);
  return deviceId;
}

function rankingTitleSizeClass(value) {
  const title = String(value || '')
      .trim()
      .replace(/\s+/g, ' '),
    longestWord = title.split(' ').reduce((longest, word) => Math.max(longest, word.length), 0);
  if (title.length >= 96 || longestWord >= 28) return ' rankingTitleExtraLong';
  if (title.length >= 70 || longestWord >= 22) return ' rankingTitleLong';
  if (title.length >= 48 || longestWord >= 18) return ' rankingTitleMedium';
  return '';
}
const queryParams = new URLSearchParams(location.search);
const CATEGORY_PAGE_SIZE = 12;
const DEFAULT_ANONYMOUS_LIMIT = 10;
const DEFAULT_ANONYMOUS_DUEL_LIMIT = 2;
const googlePlaceProfiles = Object.freeze({});
const generalGroupSlugs = Object.freeze({
  Cinema: 'cinema',
  Música: 'musica',
  'TV & Séries': 'tv-e-series',
  Nostalgia: 'nostalgia',
  Livros: 'livros',
  Arte: 'arte',
  Moda: 'moda',
  Comida: 'comida',
  Lugares: 'lugares',
  Viagens: 'viagens',
  Famosos: 'famosos',
  Natureza: 'natureza',
  Animais: 'animais',
  Motores: 'motores',
  Esporte: 'esporte',
  Futebol: 'futebol',
  Jogos: 'jogos',
  Tecnologia: 'tecnologia',
  Compras: 'compras',
  Luxo: 'luxo',
  Vida: 'vida',
});
function generalGroupFromRoute() {
  const match = location.pathname.match(/^\/categoria\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (!match) return '';
  return Object.entries(generalGroupSlugs).find(([, slug]) => slug === match[1])?.[0] || '';
}
function footballCategorySectionFromRoute() {
  return /^\/categoria\/(?:futebol|esporte)\/times\/?$/.test(location.pathname) ? 'times' : '';
}
function localRouteState() {
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts[0] !== 'local') return { city: '', group: '' };
  return {
    city: topoLocal.cityFromSlug(parts[1] || ''),
    group: topoLocal.groupFromSlug(parts[2] || ''),
  };
}
let renderHome;
let rankings = [],
  vipRankings = [],
  favoriteRankings = [],
  activeGroup =
    (footballCategorySectionFromRoute() ? 'Futebol' : generalGroupFromRoute()) ||
    localRouteState().group ||
    'Todos',
  activeFootballSection = footballCategorySectionFromRoute(),
  homePortal = !isLocalRoute() && !isCategoryRoute(),
  homeSearch = (queryParams.get('busca') || '').trim(),
  categoryVisibleCount = CATEGORY_PAGE_SIZE,
  visibleOptionCount = 10,
  rankingEditorState = null,
  vipOwnerEditorState = null,
  activeVipRankingId = '',
  sessionHeroId = '',
  selectedCity = '',
  detectedCity = '',
  viewer = {
    registered: false,
    isModerator: false,
    anonymousUsed: 0,
    anonymousLimit: DEFAULT_ANONYMOUS_LIMIT,
    anonymousDuelsUsed: 0,
    anonymousDuelLimit: DEFAULT_ANONYMOUS_DUEL_LIMIT,
    anonymousActiveDuels: 0,
    anonymousLimitReason: '',
    anonymousAccessExhausted: false,
    rankingLimit: 20,
    votingRequiresAccount: false,
  },
  community = { rankings: 0, votes: 0, users: 0 },
  localCityCatalog = [],
  rankingVotingState = null,
  rankingVotingRequest = 0,
  rankingPromotionFocusKey = '',
  clerkLoadPromise = null,
  clerkAuthFlow = { email: '', kind: 'signin' },
  notificationState = {
    items: [],
    unread: 0,
    loaded: false,
    loading: false,
    open: false,
  };
const groupNames = [
    'Todos',
    'Cinema',
    'Música',
    'TV & Séries',
    'Nostalgia',
    'Livros',
    'Arte',
    'Moda',
    'Comida',
    'Lugares',
    'Viagens',
    'Famosos',
    'Natureza',
    'Animais',
    'Motores',
    'Esporte',
    'Futebol',
    'Jogos',
    'Tecnologia',
    'Compras',
    'Luxo',
    'Vida',
  ],
  fmt = (n) => Number(n).toLocaleString('pt-BR');
const homeContextOnlyRankingIds = new Set([
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
function isClubPlayerRanking(ranking) {
  return homeContextOnlyRankingIds.has(String(ranking?.id || ''));
}
const voteCountText = (n) => `${fmt(n)} voto${Number(n) === 1 ? '' : 's'}`;
const pointCountText = (n) => `${fmt(n)} ponto${Number(n) === 1 ? '' : 's'}`;
function communityFrom(data = {}) {
  const list = Array.isArray(data.rankings) ? data.rankings : [],
    reported = data.community || {},
    fallbackVotes = list.reduce((sum, ranking) => sum + Number(ranking.votes || 0), 0),
    numberOr = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
  return {
    rankings: numberOr(reported.rankings, list.length),
    votes: numberOr(reported.votes, fallbackVotes),
    users: numberOr(reported.users, 0),
  };
}
const escapeHTML = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
function loadExternalScript(src, attributes = {}) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') return resolve();
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    Object.entries(attributes).forEach(([key, value]) => script.setAttribute(key, value));
    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true';
        resolve();
      },
      { once: true },
    );
    script.addEventListener('error', reject, { once: true });
    document.head.appendChild(script);
  });
}
async function initClerk(withUi = false) {
  if (clerkLoadPromise) return clerkLoadPromise;
  clerkLoadPromise = (async () => {
    const response = await fetch('/api?action=auth-config', { cache: 'no-store' });
    if (!response.ok) throw new Error('clerk_not_configured');
    const config = await response.json(),
      base = `https://${config.frontendApi}`;
    if (
      !/^[a-z0-9.-]+$/i.test(config.frontendApi) ||
      !String(config.publishableKey || '').startsWith('pk_')
    )
      throw new Error('invalid_clerk_config');
    if (withUi) await loadExternalScript(`${base}/npm/@clerk/ui@1/dist/ui.browser.js`);
    await loadExternalScript(`${base}/npm/@clerk/clerk-js@6.29.3/dist/clerk.browser.js`, {
      'data-clerk-publishable-key': config.publishableKey,
    });
    if (!window.Clerk) throw new Error('clerk_unavailable');
    if (withUi && !window.__internal_ClerkUICtor) throw new Error('clerk_ui_unavailable');
    await window.Clerk.load({
      ...(withUi ? { ui: { ClerkUI: window.__internal_ClerkUICtor } } : {}),
      signInUrl: '/entrar',
      signUpUrl: '/entrar',
      signInForceRedirectUrl: authReturn(),
      signInFallbackRedirectUrl: authReturn(),
      signUpForceRedirectUrl: authReturn(),
      signUpFallbackRedirectUrl: authReturn(),
    });
    return window.Clerk;
  })().catch((error) => {
    clerkLoadPromise = null;
    console.error('Não foi possível iniciar o acesso seguro.', error);
    return null;
  });
  return clerkLoadPromise;
}
const foldText = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
function searchSingular(word) {
  if (word.endsWith('oes') && word.length > 4) return word.slice(0, -3) + 'ao';
  if (word.endsWith('aes') && word.length > 3) return word.slice(0, -3) + 'ao';
  if (word.endsWith('ais') && word.length > 4) return word.slice(0, -3) + 'al';
  if (word.endsWith('eis') && word.length > 4) return word.slice(0, -3) + 'el';
  if (word.endsWith('ois') && word.length > 4) return word.slice(0, -3) + 'ol';
  if (word.endsWith('ns') && word.length > 3) return word.slice(0, -2) + 'm';
  if (word.endsWith('es') && word.length > 4 && /[rzs]/.test(word.at(-3))) return word.slice(0, -2);
  if (word.endsWith('s') && word.length > 3) return word.slice(0, -1);
  return word;
}
function searchTerms(value) {
  return foldText(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(searchSingular);
}
function searchMatches(value, query) {
  const haystack = searchTerms(value),
    needles = searchTerms(query);
  return (
    needles.length > 0 && needles.every((needle) => haystack.some((word) => word.includes(needle)))
  );
}
function rankingSearchText(r) {
  return [
    r.id.replace(/-/g, ' '),
    r.q,
    r.cat,
    groupOf(r),
    topoLocal.groupForRanking(r),
    r.searchText || '',
    ...(r.opts || []).map((o) => o.label),
  ].join(' ');
}
const shuffle = (a) => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};
const NEW_BADGE_EPOCH = Date.parse('2026-08-20T15:24:00Z'),
  NEW_BADGE_DAYS = 7;
const NEW_FIRST_SHOW_EPOCH = Date.parse('2026-08-21T12:00:00Z');
function isNewRanking(r) {
  const t = Date.parse(r?.createdAt || '');
  return Number.isFinite(t) && t >= NEW_BADGE_EPOCH && Date.now() - t < NEW_BADGE_DAYS * 86400000;
}
function isFirstShowCandidate(r) {
  const t = Date.parse(r?.createdAt || '');
  return isNewRanking(r) && Number.isFinite(t) && t >= NEW_FIRST_SHOW_EPOCH;
}
function myVoteCount(r) {
  const stored = Number(r?.myVoteCount);
  if (Number.isSafeInteger(stored) && stored >= 0) return stored;
  return (r?.opts || []).reduce((n, o) => n + (Number(o.mine) !== 0 ? 1 : 0), 0);
}
function rankingNeedsParticipation(r) {
  return myVoteCount(r) === 0 && r?.duelCompleted !== true;
}
function rankingSequenceCompare(a, b) {
  const aTime = Date.parse(a?.createdAt || ''),
    bTime = Date.parse(b?.createdAt || ''),
    safeATime = Number.isFinite(aTime) ? aTime : 0,
    safeBTime = Number.isFinite(bTime) ? bTime : 0;
  return safeATime - safeBTime || String(a?.id || '').localeCompare(String(b?.id || ''), 'pt-BR');
}
function activeRankingVoteMode() {
  const mode = new URLSearchParams(location.search).get('modo');
  if (mode === 'livre' || mode === 'flechas') return 'livre';
  return 'duelo';
}
function sharedDuelStartOptionIds() {
  const raw = new URLSearchParams(location.search).get('duelo') || '',
    match = raw.match(/^(\d+)-(\d+)$/);
  if (!match) return [];
  const optionIds = match.slice(1).map(Number);
  return optionIds.length === 2 &&
    optionIds.every((optionId) => Number.isSafeInteger(optionId) && optionId > 0) &&
    optionIds[0] !== optionIds[1]
    ? optionIds
    : [];
}
function randomDuelRanking(excludeRankingId = '') {
  const available = homeEligibleRankings(rankings).filter(
      (ranking) => !ranking.vip && ranking.id !== excludeRankingId && ranking.opts?.length >= 2,
    ),
    pool = shuffle(available);
  return pool[0] || null;
}
function priorityBucket(r) {
  const n = myVoteCount(r),
    limit = Math.min(r.opts.length, Number(viewer.rankingLimit || 20));
  if (n === 0) return 0;
  if (n < limit) return 1;
  return 2;
}
function favoriteAffinity(r, favorites) {
  if (r.favorite || !favorites.length) return 0;
  if (favorites.some((favorite) => favorite.cat === r.cat)) return 3;
  if (favorites.some((favorite) => groupOf(favorite) === groupOf(r))) return 2;
  if (
    topoLocal.isLocalRanking(r) &&
    favorites.some(
      (favorite) =>
        topoLocal.isLocalRanking(favorite) &&
        topoLocal.groupForRanking(favorite) === topoLocal.groupForRanking(r),
    )
  )
    return 1;
  return 0;
}
function smartShuffle(list) {
  const favorites = list.filter((ranking) => ranking.favorite);
  return [...list]
    .map((r) => ({
      r,
      p: priorityBucket(r),
      affinity: favoriteAffinity(r, favorites),
      x: Math.random(),
    }))
    .sort((a, b) => a.p - b.p || b.affinity - a.affinity || a.x - b.x)
    .map((x) => x.r);
}
function newBadgeHTML(r) {
  return isNewRanking(r) ? '<span class="newBadge">Novo</span>' : '';
}
function pageKind() {
  if (document.body.classList.contains('notFoundPage')) return 'not-found';
  if (location.pathname.startsWith('/ranking/')) return 'ranking';
  if (
    ['/entrar', '/recuperar-senha', '/redefinir-senha', '/sso-callback'].includes(location.pathname)
  )
    return 'auth';
  if (location.pathname === '/perfil') return 'profile';
  if (location.pathname === '/moderacao') return 'moderation';
  if (location.pathname === '/vip') return 'vip';
  if (location.pathname.startsWith('/favoritos/')) return 'favorites';
  return 'home';
}
function isLocalRoute() {
  return location.pathname === '/local' || location.pathname.startsWith('/local/');
}
function isCategoryRoute() {
  return location.pathname === '/categoria' || location.pathname.startsWith('/categoria/');
}
function isVipRoute() {
  return location.pathname === '/vip' || location.pathname.startsWith('/favoritos/');
}
function isVipExperience() {
  if (isVipRoute()) return true;
  if (pageKind() !== 'ranking') return false;
  const id = internalId();
  return activeVipRankingId === id || rankings.find((ranking) => ranking.id === id)?.vip === true;
}
function isLocalExperience() {
  if (isVipExperience()) return false;
  if (isLocalRoute()) return true;
  if (pageKind() !== 'ranking' || !rankings.length) return false;
  return topoLocal.isLocalRanking(rankings.find((ranking) => ranking.id === internalId()));
}
function groupPath(group) {
  if (isVipExperience()) return '/vip';
  if (isLocalExperience()) return topoLocal.collectionPath(selectedCity, group);
  return group === 'Todos' ? '/' : `/categoria/${generalGroupSlugs[group] || ''}`;
}
document.body.classList.toggle('homePage', pageKind() === 'home');
document.body.classList.toggle('rankingPage', pageKind() === 'ranking');
document.body.classList.toggle('authPage', pageKind() === 'auth');
document.body.classList.toggle('profilePage', pageKind() === 'profile');
document.body.classList.toggle('moderationPage', pageKind() === 'moderation');
document.body.classList.toggle('favoritesPage', pageKind() === 'favorites');
document.body.classList.toggle('localMode', isLocalRoute());
document.body.classList.toggle('vipPage', isVipRoute());
if (searchInput && homeSearch) searchInput.value = homeSearch;
function experienceRankings() {
  return rankings.filter(
    (ranking) =>
      !ranking.vip &&
      (isLocalExperience()
        ? topoLocal.isLocalRanking(ranking)
        : !topoLocal.isLocalRanking(ranking)),
  );
}
function localRankingsForSelectedCity(list = experienceRankings()) {
  if (!isLocalExperience()) return list;
  return topoLocal.rankingsForCity(list, selectedCity);
}
function globalSearchRankings() {
  return rankings.filter(
    (ranking) =>
      !ranking.vip &&
      (!topoLocal.isLocalRanking(ranking) || topoLocal.cityMatches(ranking, selectedCity)),
  );
}
const groupOverrides = {
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
};
const categoryLabelOverrides = {
  animes: 'TV & Séries',
  'celebridades-fofas': 'Famosos',
  'celebridades-sexy': 'Famosos',
  'influencers-brasil': 'Famosos',
};
function groupOf(r) {
  if (groupOverrides[r.id]) return groupOverrides[r.id];
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
      'Viagens',
      'Lugares',
      'TV & Séries',
      'Nostalgia',
    ].includes(r.cat)
  )
    return r.cat;
  if (r.cat === 'TV') return 'TV & Séries';
  if (['Pessoas', 'Famosos'].includes(r.cat)) return 'Famosos';
  if (r.cat === 'Cultura') return 'Arte';
  if (['Comida', 'Café'].includes(r.cat)) return 'Comida';
  if (['Viagem', 'Brasil'].includes(r.cat)) return 'Viagens';
  if (topoLocal.normalizeCity(r.cat)) return 'Lugares';
  if (r.cat === 'Animais') return 'Animais';
  if (r.cat === 'Plantas') return 'Natureza';
  if (r.cat === 'Carros') return 'Motores';
  if (r.cat === 'Produtos') return 'Compras';
  return 'Vida';
}
function categoryLabel(r) {
  if (isClubPlayerRanking(r)) return 'Times';
  if (categoryLabelOverrides[r.id]) return categoryLabelOverrides[r.id];
  if (r.cat === 'TV') return 'TV & Séries';
  if (r.cat === 'Pessoas') return 'Famosos';
  if (r.cat === 'Cotidiano') return 'Vida';
  if (r.cat === 'Produtos') return 'Compras';
  if (['Viagem', 'Brasil'].includes(r.cat)) return 'Viagens';
  return r.cat;
}
function experienceGroupOf(r) {
  return isLocalExperience() ? topoLocal.groupForRanking(r) : groupOf(r);
}
function experienceGroupNames() {
  return isLocalExperience() ? topoLocal.groupOrder : groupNames;
}
function belongsToGroup(r, group) {
  return (
    experienceGroupOf(r) === group ||
    (!isLocalExperience() && r.id === 'salgadinhos' && group === 'Comida')
  );
}
function toast(t) {
  const e = document.getElementById('toast');
  e.textContent = t;
  e.classList.add('show');
  clearTimeout(window._tt);
  window._tt = setTimeout(() => e.classList.remove('show'), 1400);
}
function notificationTime(value) {
  const date = new Date(value),
    elapsed = Date.now() - date.getTime(),
    minutes = Math.floor(elapsed / 60000),
    hours = Math.floor(elapsed / 3600000),
    days = Math.floor(elapsed / 86400000);
  if (!Number.isFinite(elapsed)) return '';
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  if (hours < 24) return `há ${hours} h`;
  if (days === 1) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
function notificationIcon(kind) {
  if (kind === 'ranking_changed') return '↕';
  if (kind === 'double_vote') return '2×';
  if (kind === 'level') return '★';
  return 'T';
}
function notificationItemsHTML() {
  if (notificationState.loading && !notificationState.loaded) {
    return '<div class="notificationEmpty">Buscando novidades…</div>';
  }
  if (!notificationState.items.length) {
    return '<div class="notificationEmpty"><strong>Tudo tranquilo por aqui.</strong><span>As novidades dos seus rankings aparecerão neste espaço.</span></div>';
  }
  return notificationState.items
    .map((item) => {
      const href = String(item.href || '').startsWith('/') ? item.href : '/perfil';
      return `<a class="notificationItem ${item.readAt ? '' : 'unread'}" href="${escapeHTML(href)}" data-notification-id="${escapeHTML(item.id)}"><span class="notificationKind ${escapeHTML(item.kind)}" aria-hidden="true">${notificationIcon(item.kind)}</span><span class="notificationCopy"><strong>${escapeHTML(item.title)}</strong><span>${escapeHTML(item.body)}</span><time>${escapeHTML(notificationTime(item.createdAt))}</time></span></a>`;
    })
    .join('');
}
function renderNotificationContents() {
  const badge = document.getElementById('notificationBadge'),
    button = document.getElementById('notificationButton'),
    panel = document.getElementById('notificationPanel');
  if (!badge || !button || !panel) return;
  const unread = Math.max(0, Number(notificationState.unread || 0));
  badge.hidden = unread === 0;
  badge.textContent = unread > 9 ? '9+' : String(unread);
  button.setAttribute(
    'aria-label',
    unread ? `Notificações: ${unread} não lida${unread === 1 ? '' : 's'}` : 'Notificações',
  );
  button.setAttribute('aria-expanded', String(notificationState.open));
  panel.hidden = !notificationState.open;
  panel.innerHTML = `<div class="notificationPanelHead"><div><strong>Notificações</strong><span>O que aconteceu no seu TOPO</span></div>${unread ? '<button type="button" id="notificationReadAll">Marcar como lidas</button>' : ''}</div><div class="notificationList">${notificationItemsHTML()}</div>`;

  panel.querySelectorAll('[data-notification-id]').forEach((link) => {
    link.onclick = async (event) => {
      event.preventDefault();
      const href = link.getAttribute('href') || '/perfil';
      await markNotificationRead(link.dataset.notificationId).catch(() => {});
      location.href = href;
    };
  });
  const readAll = document.getElementById('notificationReadAll');
  if (readAll) {
    readAll.onclick = async () => {
      readAll.disabled = true;
      try {
        const response = await fetch('/api?action=notifications', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ operation: 'read-all' }),
        });
        if (!response.ok) throw new Error('notification_read_failed');
        notificationState.items = notificationState.items.map((item) => ({
          ...item,
          readAt: item.readAt || new Date().toISOString(),
        }));
        notificationState.unread = 0;
        renderNotificationContents();
      } catch {
        readAll.disabled = false;
        toast('Não consegui marcar as notificações');
      }
    };
  }
}
async function markNotificationRead(id) {
  const item = notificationState.items.find((entry) => entry.id === id);
  if (!item || item.readAt) return;
  const response = await fetch('/api?action=notifications', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ operation: 'read', id }),
    keepalive: true,
  });
  if (!response.ok) throw new Error('notification_read_failed');
  item.readAt = new Date().toISOString();
  notificationState.unread = Math.max(0, notificationState.unread - 1);
  renderNotificationContents();
}
async function loadNotifications({ force = false } = {}) {
  if (!viewer.registered || notificationState.loading || (notificationState.loaded && !force)) {
    return;
  }
  notificationState.loading = true;
  renderNotificationContents();
  try {
    const response = await fetch('/api?action=notifications', { cache: 'no-store' });
    if (!response.ok) throw new Error('notification_load_failed');
    const data = await response.json();
    notificationState.items = Array.isArray(data.notifications) ? data.notifications : [];
    notificationState.unread = Math.max(0, Number(data.unread || 0));
    notificationState.loaded = true;
  } catch (error) {
    console.error('Não foi possível carregar as notificações.', error);
  } finally {
    notificationState.loading = false;
    renderNotificationContents();
  }
}
function bindNotificationBell() {
  const button = document.getElementById('notificationButton'),
    panel = document.getElementById('notificationPanel');
  if (!button || !panel) return;
  button.onclick = (event) => {
    event.stopPropagation();
    notificationState.open = !notificationState.open;
    renderNotificationContents();
    if (notificationState.open) void loadNotifications();
  };
  panel.onclick = (event) => event.stopPropagation();
}
function renderAccount() {
  if (viewer.registered) {
    accountEl.innerHTML = `<div class="notificationShell"><button class="notificationButton" id="notificationButton" type="button" aria-haspopup="dialog" aria-expanded="false"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"></path><path d="M10 21h4"></path></svg><span class="notificationBadge" id="notificationBadge" hidden></span></button><section class="notificationPanel" id="notificationPanel" aria-label="Suas notificações" hidden></section></div><a class="accountLink" href="/vip" aria-label="Abrir Meu Topo">Meu Topo</a><button class="accountLogout" id="accountLogout" type="button" aria-label="Sair da conta">Sair</button>`;
    bindNotificationBell();
    document.getElementById('accountLogout')?.addEventListener('click', logout);
    renderNotificationContents();
    void loadNotifications();
  } else {
    notificationState = {
      items: [],
      unread: 0,
      loaded: false,
      loading: false,
      open: false,
    };
    const voteLimit = viewer.anonymousLimit || DEFAULT_ANONYMOUS_LIMIT,
      duelLimit = viewer.anonymousDuelLimit || DEFAULT_ANONYMOUS_DUEL_LIMIT,
      voteCount = Math.min(Number(viewer.anonymousUsed || 0), voteLimit),
      duelCount = Math.min(Number(viewer.anonymousDuelsUsed || 0), duelLimit),
      requiresAccount = viewer.votingRequiresAccount || viewer.anonymousAccessExhausted;
    accountEl.innerHTML = `<a class="accountLink accountEnter" href="/entrar">Entrar</a><span class="voteMeter">${viewer.privateVoting && isVipExperience() ? 'acesso privado' : requiresAccount ? 'entre para votar' : `${fmt(voteCount)}/${voteLimit} votos · ${fmt(duelCount)}/${duelLimit} duelos`}</span>`;
  }
}
document.addEventListener('click', (event) => {
  if (!notificationState.open || event.target.closest('.notificationShell')) return;
  notificationState.open = false;
  renderNotificationContents();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !notificationState.open) return;
  notificationState.open = false;
  renderNotificationContents();
  document.getElementById('notificationButton')?.focus();
});
document.addEventListener('keydown', (event) => {
  if (
    !searchInput ||
    event.defaultPrevented ||
    event.altKey ||
    !(event.metaKey || event.ctrlKey) ||
    event.key.toLowerCase() !== 'k'
  )
    return;
  event.preventDefault();
  searchInput.focus();
  searchInput.select();
});
function renderCommunityPulse() {
  if (sitePulseEl)
    sitePulseEl.innerHTML = `<span><strong>${fmt(community.rankings)}</strong> rankings</span><span><strong>${fmt(community.votes)}</strong> votos</span><span><strong>${fmt(community.users)}</strong> pessoas</span>`;
}
function catalogCities() {
  const present = new Set(
      localCityCatalog.map((entry) => topoLocal.normalizeCity(entry?.city)).filter(Boolean),
    ),
    cities = topoLocal.cityOrder.filter((city) => present.has(city));
  return cities.length ? cities : topoLocal.availableCities(rankings);
}
function catalogCityCount(city) {
  const normalized = topoLocal.normalizeCity(city),
    entry = localCityCatalog.find(
      (candidate) => topoLocal.normalizeCity(candidate?.city) === normalized,
    );
  return entry
    ? Math.max(0, Number(entry.total || 0))
    : topoLocal.rankingsForCity(rankings, city).length;
}
function renderCityPicker() {
  const cities = catalogCities(),
    shouldShow =
      isLocalExperience() &&
      pageKind() === 'home' &&
      topoLocal.cityOrder.includes(selectedCity) &&
      cities.length > 0;
  if (!cityPickerEl || !citySelectEl) return;
  cityPickerEl.hidden = !shouldShow;
  if (!shouldShow) return;
  citySelectEl.innerHTML = cities
    .map(
      (city) =>
        `<option value="${escapeHTML(city)}" ${city === selectedCity ? 'selected' : ''}>${escapeHTML(city)}</option>`,
    )
    .join('');
  citySelectEl.title = `Cidade do TOPO LOCAL: ${selectedCity}`;
}
function syncExperienceNavigation() {
  const vip = isVipExperience(),
    local = !vip && isLocalExperience(),
    experience = vip ? 'vip' : local ? 'local' : 'topo';
  document.body.classList.toggle('localMode', local);
  document.body.classList.toggle('vipPage', vip);
  experienceLinks.forEach((link) => {
    const active = link.dataset.experience === experience;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (searchForm) searchForm.action = '/';
  if (searchCityInput) {
    const city = topoLocal.citySlug(selectedCity);
    searchCityInput.value = city;
    searchCityInput.defaultValue = city;
  }
  if (searchInput) {
    searchInput.placeholder = `Buscar no TOPO e em ${selectedCity || 'sua cidade'}`;
    searchInput.setAttribute(
      'aria-label',
      `Buscar em todos os rankings públicos e nos rankings locais de ${selectedCity || 'sua cidade'}`,
    );
  }
  renderCityPicker();
}
function initializeCity(locationData = {}) {
  detectedCity = String(locationData.selectedCity || locationData.city || '');
  const routeCity = localRouteState().city,
    queryCity = topoLocal.cityFromSlug(queryParams.get('cidade') || ''),
    rankingCity =
      pageKind() === 'ranking'
        ? topoLocal.cityForRanking(rankings.find((ranking) => ranking.id === internalId()))
        : '';
  let savedCity = '';
  try {
    savedCity = localStorage.getItem(cityStoreKey) || '';
  } catch {}
  selectedCity = topoLocal.resolvePreferredCity(
    rankings,
    routeCity || queryCity || rankingCity || savedCity,
    detectedCity,
  );
  if (
    activeGroup !== 'Todos' &&
    !localRankingsForSelectedCity().some((ranking) => belongsToGroup(ranking, activeGroup))
  )
    activeGroup = 'Todos';
  syncExperienceNavigation();
}
function changeSelectedCity(city) {
  const normalized = topoLocal.normalizeCity(city);
  if (!normalized || normalized === selectedCity) return;
  selectedCity = normalized;
  try {
    localStorage.setItem(cityStoreKey, selectedCity);
  } catch {}
  if (isLocalRoute() && pageKind() === 'home') {
    location.assign(topoLocal.collectionPath(selectedCity, activeGroup));
    return;
  }
  sessionHeroId = '';
  categoryVisibleCount = CATEGORY_PAGE_SIZE;
  if (
    activeGroup !== 'Todos' &&
    !localRankingsForSelectedCity().some((ranking) => belongsToGroup(ranking, activeGroup))
  )
    activeGroup = 'Todos';
  syncExperienceNavigation();
  renderGroups();
  renderHome();
}
citySelectEl?.addEventListener('change', () => changeSelectedCity(citySelectEl.value));
function availableGroupNames() {
  if (isVipExperience()) return [];
  const source = localRankingsForSelectedCity();
  return experienceGroupNames().filter(
    (group) => group === 'Todos' || source.some((r) => belongsToGroup(r, group)),
  );
}
function syncHomeSearchURL() {
  if (pageKind() !== 'home') return;
  const url = new URL(location.href);
  if (homeSearch) {
    url.searchParams.set('busca', homeSearch);
    const city = topoLocal.citySlug(selectedCity);
    if (city) url.searchParams.set('cidade', city);
    else url.searchParams.delete('cidade');
  } else {
    url.searchParams.delete('busca');
    url.searchParams.delete('cidade');
  }
  history.replaceState(null, '', url.pathname + url.search + url.hash);
  queryParams.delete('busca');
  queryParams.delete('cidade');
  if (homeSearch) {
    queryParams.set('busca', homeSearch);
    const city = topoLocal.citySlug(selectedCity);
    if (city) queryParams.set('cidade', city);
  }
}
function selectGroup(group) {
  location.assign(groupPath(group));
}
function renderGroups() {
  groupsEl.innerHTML = availableGroupNames()
    .map(
      (g) =>
        `<a class="groupBtn ${!homePortal && !homeSearch && g === activeGroup ? 'active' : ''}" href="${escapeHTML(groupPath(g))}" data-g="${escapeHTML(g)}" ${!homePortal && !homeSearch && g === activeGroup ? 'aria-current="page"' : ''}>${escapeHTML(g)}</a>`,
    )
    .join('');
}
if (searchInput)
  searchInput.addEventListener('input', () => {
    if (pageKind() !== 'home' || location.pathname !== '/') return;
    homeSearch = searchInput.value.trim();
    categoryVisibleCount = CATEGORY_PAGE_SIZE;
    syncHomeSearchURL();
    if (rankings.length) {
      renderGroups();
      renderHome();
    }
  });
if (searchForm)
  searchForm.addEventListener('submit', (event) => {
    const query = searchInput.value.trim();
    if (!query) {
      event.preventDefault();
      searchInput.focus();
      return;
    }
    if (pageKind() !== 'home' || location.pathname !== '/') {
      event.preventDefault();
      const params = new URLSearchParams({ busca: query }),
        city = topoLocal.citySlug(selectedCity);
      if (city) params.set('cidade', city);
      location.assign(`/?${params}`);
      return;
    }
    event.preventDefault();
    homeSearch = query;
    categoryVisibleCount = CATEGORY_PAGE_SIZE;
    syncHomeSearchURL();
    if (rankings.length) {
      renderGroups();
      renderHome();
    }
  });
async function fetchBootstrap(rekeyed = false) {
  const params = new URLSearchParams({ device_id: deviceId }),
    routeCity = localRouteState().city,
    queryCity = topoLocal.cityFromSlug(queryParams.get('cidade') || '');
  let savedCity = '';
  try {
    savedCity = localStorage.getItem(cityStoreKey) || '';
  } catch {}
  const city = topoLocal.normalizeCity(routeCity || queryCity || savedCity);
  if (city) params.set('city', city);
  if (pageKind() === 'ranking') params.set('ranking_id', internalId());
  const res = await fetch(`/api?${params}`, { cache: 'no-store' });
  if (res.status === 409 && !rekeyed) {
    const issue = await res.json().catch(() => ({}));
    if (issue.error === 'device_rekey_required') {
      rotateDeviceId();
      return fetchBootstrap(true);
    }
  }
  if (!res.ok) throw new Error('load');
  return res.json();
}

function vipCardHTML(ranking) {
  const path = rankingPath(ranking.id),
    media = ranking.img
      ? `<img src="${escapeHTML(ranking.img)}" alt="" loading="lazy" decoding="async">`
      : '<span class="vipCardFallback" aria-hidden="true">MEU TOPO</span>',
    status = ranking.owned
      ? ranking.votingOpen === false
        ? 'Votação encerrada'
        : 'Seu ranking privado'
      : ranking.locked
        ? 'Protegido por senha'
        : 'Acesso liberado neste aparelho',
    details = ranking.userCreated
      ? `<small class="vipCardDetails">${fmt(ranking.optionCount || 0)} nomes · ${fmt(ranking.voteCount || 0)} votos</small>`
      : '',
    ownerActions = ranking.owned
      ? `<div class="vipOwnerActions"><a href="${path}?gerenciar=1">GERENCIAR</a><button type="button" data-copy-vip="${escapeHTML(ranking.id)}">COPIAR LINK</button><button class="danger" type="button" data-delete-vip="${escapeHTML(ranking.id)}">APAGAR</button></div>`
      : '';
  return `<article class="vipCard" data-vip-card="${escapeHTML(ranking.id)}"><a class="vipCardMedia" href="${path}">${media}<span class="vipCardLock" aria-hidden="true">${ranking.locked ? '🔒' : '✓'}</span></a><div class="vipCardBody"><span class="vipCardStatus ${ranking.locked ? '' : 'unlocked'}">${status}</span><h2><a href="${path}">${escapeHTML(ranking.q)}</a></h2>${details}<a class="vipCardAction" href="${path}">${ranking.locked ? 'DIGITAR SENHA' : 'ABRIR RANKING'} <b>→</b></a>${ownerActions}</div></article>`;
}

function favoriteCardHTML(ranking, { editable = false } = {}) {
  const path = rankingPath(ranking.id),
    media = ranking.img
      ? `<img data-ranking-image src="${escapeHTML(ranking.img)}" alt="" loading="lazy" decoding="async">`
      : '<span class="favoriteCardFallback" aria-hidden="true">TOPO</span>';
  return `<article class="favoriteCard"><a class="favoriteCardMedia" href="${path}">${media}<span class="favoriteCardHeart" aria-hidden="true">${favoriteIconHTML()}</span></a><div class="favoriteCardBody"><span class="favoriteCardCategory">${escapeHTML(categoryLabel(ranking))}</span><h2><a href="${path}">${escapeHTML(ranking.q)}</a></h2><div class="favoriteCardActions"><a href="${path}">ABRIR RANKING <b>→</b></a>${editable ? favoriteButtonHTML({ ...ranking, favorite: true }, { remove: true }) : ''}</div></div></article>`;
}

function vipOptionInputHTML(index, value = '') {
  return `<div class="vipOptionInputRow"><span>${index + 1}</span><input class="vipOptionInput" type="text" minlength="2" maxlength="80" autocomplete="off" value="${escapeHTML(value)}" placeholder="Nome ou opção ${index + 1}" aria-label="Nome ou opção ${index + 1}" required><button type="button" data-remove-vip-option aria-label="Remover nome ou opção ${index + 1}">×</button></div>`;
}

function vipInitialOptionInputsHTML() {
  return ['', '', ''].map((value, index) => vipOptionInputHTML(index, value)).join('');
}

function vipCoverEditorHTML(prefix, imageUrl = '') {
  const hasImage = Boolean(imageUrl);
  return `<section class="vipCoverEditor"><div class="vipCoverEditorHead"><div><label for="${prefix}CoverInput">Foto do topo <small>opcional</small></label><p>Ela aparece para todos que abrirem este ranking.</p></div><small>JPG, PNG ou WebP</small></div><div class="vipCoverPreview" id="${prefix}CoverPreview">${hasImage ? `<img src="${escapeHTML(imageUrl)}" alt="Foto do topo do ranking">` : '<span class="vipCoverEmpty"><b aria-hidden="true">＋</b><small>Adicione uma foto</small></span>'}</div><div class="vipCoverActions"><label class="vipCoverChoose" for="${prefix}CoverInput">${hasImage ? 'TROCAR FOTO' : 'ADICIONAR FOTO'}<input id="${prefix}CoverInput" type="file" accept="image/jpeg,image/png,image/webp" hidden></label><button id="${prefix}CoverRemove" type="button" ${hasImage ? '' : 'hidden'}>REMOVER</button></div><small class="vipCoverHint">A foto também identifica o ranking na sua lista do Meu Topo.</small><span class="vipCoverStatus" id="${prefix}CoverStatus" role="status" aria-live="polite"></span></section>`;
}

function setVipCoverPreview(prefix, source) {
  const preview = document.getElementById(`${prefix}CoverPreview`);
  if (!preview) return;
  preview.innerHTML = source
    ? `<img src="${escapeHTML(source)}" alt="Foto do topo do ranking">`
    : '<span class="vipCoverEmpty"><b aria-hidden="true">＋</b><small>Adicione uma foto</small></span>';
}

function bindVipCoverPicker(prefix, initialImage = '') {
  const input = document.getElementById(`${prefix}CoverInput`),
    remove = document.getElementById(`${prefix}CoverRemove`),
    status = document.getElementById(`${prefix}CoverStatus`),
    state = { mode: 'keep', imageData: '', processing: false };
  if (!input || !remove || !status) return state;

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    state.processing = true;
    input.disabled = true;
    remove.disabled = true;
    status.textContent = 'Preparando a foto…';
    try {
      const imageData = await optimizeRankingPhoto(file);
      state.mode = 'upload';
      state.imageData = imageData;
      setVipCoverPreview(prefix, imageData);
      remove.hidden = false;
      status.textContent = 'Foto pronta para salvar.';
    } catch {
      input.value = '';
      status.textContent = 'Use uma imagem JPG, PNG ou WebP de até 8 MB.';
    } finally {
      state.processing = false;
      input.disabled = false;
      remove.disabled = false;
    }
  };
  remove.onclick = () => {
    state.mode = 'remove';
    state.imageData = '';
    input.value = '';
    setVipCoverPreview(prefix, '');
    remove.hidden = true;
    status.textContent = initialImage
      ? 'A foto será removida quando você salvar.'
      : 'Foto removida.';
  };
  return state;
}

function vipCreatePanelHTML(open = false) {
  return `<section class="vipCreatePanel" id="vipCreatePanel" ${open ? '' : 'hidden'}><div class="vipCreateIntro"><span class="portalKicker">Só para o seu grupo</span><h2>Crie seu ranking privado</h2><p>Escreva a pergunta, inclua os nomes e escolha a senha que você enviará para o grupo.</p></div><form class="vipCreateForm" id="vipCreateForm"><label for="vipCreateTitle">Pergunta ou título</label><input class="vipCreateText" id="vipCreateTitle" type="text" minlength="8" maxlength="120" autocomplete="off" placeholder="Ex.: Quem é o mais atrasado do trabalho?" required><label for="vipCreateDescription">Descrição <small>opcional</small></label><textarea class="vipCreateText" id="vipCreateDescription" maxlength="280" rows="3" placeholder="Explique a brincadeira ou combine as regras."></textarea>${vipCoverEditorHTML('vipCreate')}<div class="vipOptionEditorHead"><label>Nomes ou opções</label><small>De 3 a 20</small></div><div class="vipOptionInputs" id="vipCreateOptions">${vipInitialOptionInputsHTML()}</div><button class="vipAddOption" id="vipAddOption" type="button">+ ADICIONAR OUTRO NOME</button><label for="vipCreatePassword">Senha para os convidados</label><div class="vipCreatePasswordRow"><input id="vipCreatePassword" name="password" type="password" minlength="4" maxlength="80" autocomplete="new-password" placeholder="No mínimo 4 caracteres" required><button id="vipPasswordVisibility" type="button" aria-label="Mostrar senha">MOSTRAR</button></div><small class="vipCreateHint">Guarde essa senha. Ela não será exibida pelo site depois da criação.</small><span class="vipCreateStatus" id="vipCreateStatus" role="status" aria-live="polite"></span><div class="vipCreateSubmitRow"><button class="secondary" id="vipCreateCancel" type="button">CANCELAR</button><button class="primary" type="submit">CRIAR RANKING PRIVADO</button></div></form></section>`;
}

function vipCreateErrorText(error) {
  return (
    {
      invalid_vip_title: 'Escreva uma pergunta com pelo menos 8 caracteres.',
      invalid_vip_description: 'A descrição pode ter até 280 caracteres.',
      invalid_vip_options: 'Inclua de 3 a 20 nomes diferentes.',
      duplicate_vip_option: 'Há nomes repetidos. Cada nome deve aparecer uma vez.',
      invalid_vip_password: 'Crie uma senha com 4 a 80 caracteres.',
      invalid_ranking_image: 'Essa foto não pôde ser usada. Tente outra imagem.',
      user_vip_ranking_limit:
        'Você chegou ao limite de 20 rankings no Meu Topo. Apague um para criar outro.',
      vip_not_configured: 'A proteção por senha está indisponível agora.',
    }[error] || 'Não consegui criar agora. Tente novamente.'
  );
}

function bindVipOptionInputs(container, addButton) {
  if (!container || !addButton) return;
  const sync = () => {
    const rows = [...container.querySelectorAll('.vipOptionInputRow')];
    rows.forEach((row, index) => {
      row.querySelector('span').textContent = String(index + 1);
      const input = row.querySelector('input'),
        remove = row.querySelector('[data-remove-vip-option]');
      input.placeholder = `Nome ou opção ${index + 1}`;
      input.setAttribute('aria-label', `Nome ou opção ${index + 1}`);
      remove.disabled = rows.length <= 3;
      remove.onclick = () => {
        if (container.querySelectorAll('.vipOptionInputRow').length <= 3) return;
        row.remove();
        sync();
      };
    });
    addButton.disabled = rows.length >= 20;
  };
  addButton.onclick = () => {
    const total = container.querySelectorAll('.vipOptionInputRow').length;
    if (total >= 20) return;
    container.insertAdjacentHTML('beforeend', vipOptionInputHTML(total));
    sync();
    container.querySelector('.vipOptionInputRow:last-child input')?.focus();
  };
  sync();
}

function bindVipCreateForm() {
  const panel = document.getElementById('vipCreatePanel'),
    toggle = document.getElementById('vipCreateToggle'),
    cancel = document.getElementById('vipCreateCancel'),
    form = document.getElementById('vipCreateForm'),
    password = document.getElementById('vipCreatePassword'),
    visibility = document.getElementById('vipPasswordVisibility'),
    optionContainer = document.getElementById('vipCreateOptions'),
    addOption = document.getElementById('vipAddOption'),
    cover = bindVipCoverPicker('vipCreate');
  if (!panel || !form || !password || !visibility) return;

  const setOpen = (open) => {
    panel.hidden = !open;
    toggle?.setAttribute('aria-expanded', String(open));
    if (open) document.getElementById('vipCreateTitle')?.focus();
  };
  toggle?.addEventListener('click', () => setOpen(panel.hidden));
  cancel?.addEventListener('click', () => setOpen(false));
  visibility.onclick = () => {
    const showing = password.type === 'text';
    password.type = showing ? 'password' : 'text';
    visibility.textContent = showing ? 'MOSTRAR' : 'OCULTAR';
    visibility.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');
  };
  bindVipOptionInputs(optionContainer, addOption);

  form.onsubmit = async (event) => {
    event.preventDefault();
    const title = document.getElementById('vipCreateTitle').value.trim(),
      description = document.getElementById('vipCreateDescription').value.trim(),
      options = [...optionContainer.querySelectorAll('.vipOptionInput')]
        .map((input) => input.value.trim())
        .filter(Boolean),
      status = document.getElementById('vipCreateStatus'),
      submit = form.querySelector('button[type=submit]'),
      payload = { title, description, options, password: password.value };
    if (cover.processing) {
      status.className = 'vipCreateStatus';
      status.textContent = 'Espere a foto terminar de ser preparada.';
      return;
    }
    if (options.length < 3) {
      status.className = 'vipCreateStatus error';
      status.textContent = 'Inclua pelo menos 3 nomes ou opções.';
      optionContainer.querySelector('input')?.focus();
      return;
    }
    submit.disabled = true;
    status.className = 'vipCreateStatus';
    status.textContent = 'Criando seu ranking privado…';
    if (cover.mode === 'upload') payload.imageData = cover.imageData;
    try {
      const response = await fetch('/api?action=vip-rankings', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        }),
        result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        location.assign(`/entrar?voltar=${encodeURIComponent('/vip?criar=1')}`);
        return;
      }
      if (!response.ok) throw result;
      status.classList.add('success');
      status.textContent = 'Ranking criado. Abrindo…';
      toast('Seu ranking no Meu Topo está pronto');
      location.assign(result.path || rankingPath(result.ranking.id));
    } catch (error) {
      status.className = 'vipCreateStatus error';
      status.textContent = vipCreateErrorText(error?.error);
      submit.disabled = false;
    }
  };
}

async function copyVipRankingLink(rankingId) {
  const url = location.origin + rankingPath(rankingId);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      toast('Link do Meu Topo copiado');
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: 'Ranking do Meu Topo — TOPO', url });
      return;
    }
    throw new Error('sharing_unavailable');
  } catch (error) {
    if (error?.name !== 'AbortError') toast('Não consegui copiar o link neste navegador');
  }
}

async function shareFavoriteCollectionURL(url, title = 'Favoritos no TOPO') {
  const data = {
    title,
    text: 'Separei meus rankings favoritos no TOPO.',
    url,
  };
  if (navigator.share) {
    try {
      await navigator.share(data);
      return true;
    } catch (error) {
      if (error?.name === 'AbortError') return false;
    }
  }
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
    await navigator.clipboard.writeText(url);
    toast('Link dos favoritos copiado');
    return true;
  } catch {
    toast('Não consegui abrir o compartilhamento neste navegador');
    return false;
  }
}

async function shareMyFavorites(button) {
  button.disabled = true;
  try {
    const response = await fetch('/api?action=favorite-share', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
      result = await response.json().catch(() => ({}));
    if (response.status === 401) {
      location.assign(`/entrar?voltar=${encodeURIComponent('/vip')}`);
      return;
    }
    if (!response.ok || !result.sharePath) throw result;
    await shareFavoriteCollectionURL(location.origin + result.sharePath, 'Meus favoritos no TOPO');
  } catch (error) {
    toast(
      error?.error === 'favorites_empty'
        ? 'Favorite pelo menos um ranking primeiro'
        : 'Não consegui compartilhar seus favoritos agora',
    );
  } finally {
    button.disabled = false;
  }
}

function bindVipOwnerActions() {
  document
    .querySelectorAll('[data-copy-vip]')
    .forEach((button) => (button.onclick = () => copyVipRankingLink(button.dataset.copyVip)));
  document.querySelectorAll('[data-delete-vip]').forEach((button) => {
    button.onclick = async () => {
      const ranking = vipRankings.find((item) => item.id === button.dataset.deleteVip);
      if (!ranking) return;
      if (
        !window.confirm(
          `Apagar “${ranking.q}”? Os votos e comentários desta cópia também serão apagados.`,
        )
      )
        return;
      button.disabled = true;
      try {
        const response = await fetch(
            `/api?action=vip-rankings&ranking_id=${encodeURIComponent(ranking.id)}`,
            { method: 'DELETE' },
          ),
          result = await response.json().catch(() => ({}));
        if (response.status === 401) {
          location.assign(`/entrar?voltar=${encodeURIComponent('/vip')}`);
          return;
        }
        if (!response.ok) throw result;
        toast('Ranking do Meu Topo apagado');
        if (pageKind() === 'profile') await renderProfile();
        else await loadVipArea();
      } catch {
        button.disabled = false;
        toast('Não consegui apagar agora');
      }
    };
  });
}

function personalAreaHeaderHTML(active = 'activity') {
  const profilePath = viewer.registered
      ? '/perfil'
      : `/entrar?voltar=${encodeURIComponent('/perfil')}`,
    activityCurrent = active === 'activity',
    profileCurrent = active === 'profile';
  return `<section class="personalHubHeader"><div><span class="portalKicker">Seu espaço pessoal</span><h1>Meu Topo</h1><p>Sua atividade e seu perfil reunidos no mesmo lugar.</p></div><nav class="personalHubTabs" aria-label="Áreas do Meu Topo"><a class="${activityCurrent ? 'active' : ''}" href="/vip" ${activityCurrent ? 'aria-current="page"' : ''}>Minha atividade</a><a class="${profileCurrent ? 'active' : ''}" href="${escapeHTML(profilePath)}" ${profileCurrent ? 'aria-current="page"' : ''}>Perfil</a></nav></section>`;
}

function personalScorecardHTML(data = null) {
  const loaded = Boolean(data),
    stats = data?.stats || {},
    value = (number, suffix = '') =>
      loaded ? `${fmt(Math.max(0, Number(number || 0)))}${suffix}` : '—',
    streak = Math.max(0, Number(stats.streak || 0));
  return `<section class="profileScorecard" aria-label="Sua pontuação e atividade no TOPO"><div class="profileMetrics"><span class="profileScoreMetric profileScoreMetricPrimary"><small>Pontuação</small><strong>${value(stats.points ?? stats.votes)}</strong><em>pontos no TOPO</em></span><span class="profileScoreMetric" aria-label="${loaded ? `${fmt(stats.votes || 0)} votos: ${fmt(stats.directVotes || 0)} livres e ${fmt(stats.duelPoints || 0)} no duelo` : 'Votos livres e no duelo'}"><small>Votos</small><strong>${value(stats.votes)}</strong><em>${loaded ? `${fmt(stats.directVotes || 0)} livres + ${fmt(stats.duelPoints || 0)} duelo` : 'livres + duelo'}</em></span><span class="profileScoreMetric"><small>Rankings</small><strong>${value(stats.rankings)}</strong><em>participados</em></span><span class="profileScoreMetric"><small>Sequência</small><strong>${value(streak)}</strong><em>${loaded ? `dia${streak === 1 ? '' : 's'}` : 'dias'}</em></span><span class="profileScoreMetric profileScorePosition"><small>Posição</small><strong id="profileScorecardPosition" aria-live="polite">—</strong><em>entre as pessoas</em></span></div><a class="profileScorecardLink" href="#profileLeaderboardSection">VER RANKING DE PESSOAS <span aria-hidden="true">↓</span></a></section>`;
}

function personalActivityHTML(data = null) {
  if (!data)
    return '<section class="profileSection profileRecentSection personalActivityUnavailable"><div class="profileSectionHead"><div class="sectionLabel">Sua participação</div><span>atividade no TOPO</span></div><p class="profileHint">Não consegui carregar seu histórico agora. Seus favoritos e rankings continuam disponíveis acima.</p></section>';
  const stats = data.stats || {},
    doubleVotes = data.doubleVotes || {},
    progress = profileProgressInfo(doubleVotes.totalVotes ?? stats.votes),
    up = Math.max(0, Number(stats.upVotes || 0)),
    down = Math.max(0, Number(stats.downVotes || 0)),
    voteTotal = up + down,
    upPercent = voteTotal ? Math.round((up / voteTotal) * 100) : 0,
    downPercent = voteTotal ? 100 - upPercent : 0,
    powerSummary = progress.unlocked
      ? `${fmt(doubleVotes.available || 0)} livre${Number(doubleVotes.available || 0) === 1 ? '' : 's'} · ${fmt(doubleVotes.active || 0)} em uso`
      : 'valem 2 pontos';
  return `${profileRankingActivityHTML(data.rankingActivity)}<div class="profileDashboard personalActivityDashboard"><section class="profileSection profilePowerSection"><div class="profileSectionHead"><div class="sectionLabel">Seus votos duplos</div><span>${powerSummary}</span></div><div class="profilePowerList">${profileDoubleVotesHTML(doubleVotes)}</div><p class="profileComingSoon"><strong>Como usar:</strong> vote normalmente e toque no pequeno botão 2× que aparece ao lado da seta escolhida. Toque no 2× novamente para voltar ao voto simples; toque na seta marcada para remover o voto inteiro.</p></section><section class="profileSection profileVoteStyle"><div class="profileSectionHead"><div class="sectionLabel">Seu jeito de votar</div><span>votos ativos</span></div><div class="profileVoteSplit" aria-label="${upPercent}% para cima e ${downPercent}% para baixo"><span class="up" style="width:${upPercent}%"></span><span class="down" style="width:${downPercent}%"></span></div><div class="profileVoteLegend"><span><i class="up"></i><strong>${fmt(up)} ↑</strong> para cima</span><span><i class="down"></i><strong>${fmt(down)} ↓</strong> para baixo</span></div><div class="profileSubhead">Categorias favoritas</div>${profileCategoriesHTML(data.categories)}</section></div><section class="profileSection profileRecentSection"><div class="profileSectionHead"><div class="sectionLabel">Seus votos recentes</div><span>últimas escolhas</span></div>${profileRecentHTML(data.recent)}</section>`;
}

async function loadVipArea() {
  syncExperienceNavigation();
  groupsEl.innerHTML = '';
  document.title = 'Meu Topo — TOPO';
  const [response, favoriteResponse, profileResponse] = await Promise.all([
      fetch('/api?action=vip-catalog', { cache: 'no-store' }),
      viewer.registered
        ? fetch('/api?action=favorites', { cache: 'no-store' })
        : Promise.resolve(null),
      viewer.registered
        ? fetch('/api?action=profile&device_id=' + encodeURIComponent(deviceId), {
            cache: 'no-store',
          })
        : Promise.resolve(null),
    ]),
    data = await response.json().catch(() => ({})),
    favoriteData = favoriteResponse?.ok
      ? await favoriteResponse.json().catch(() => ({}))
      : { favorites: [] },
    profileData = profileResponse?.ok ? await profileResponse.json().catch(() => null) : null;
  if (!response.ok) throw new Error('vip_catalog');
  vipRankings = Array.isArray(data.rankings) ? data.rankings : [];
  favoriteRankings = Array.isArray(favoriteData.favorites) ? favoriteData.favorites : [];
  const ownedVipRankings = vipRankings.filter((ranking) => ranking.owned),
    createOpen = queryParams.get('criar') === '1',
    loginPath = `/entrar?voltar=${encodeURIComponent('/vip?criar=1')}`,
    createAction = viewer.registered
      ? `<button class="vipHeroAction" id="vipCreateToggle" type="button" aria-expanded="${createOpen}">CRIAR NOVO RANKING</button>`
      : `<a class="vipHeroAction" href="${loginPath}">ENTRAR PARA CRIAR</a>`,
    privateCards = !viewer.registered
      ? '<section class="vipEmpty"><span aria-hidden="true">🔒</span><h2>Entre para ver seus rankings privados.</h2><p>Somente o criador encontra os rankings nesta área.</p></section>'
      : ownedVipRankings.length
        ? `<div class="vipGrid vipOwnedGrid">${ownedVipRankings.map(vipCardHTML).join('')}</div>`
        : '<section class="vipEmpty"><span aria-hidden="true">＋</span><h2>Você ainda não criou nenhum ranking privado.</h2><p>Crie o primeiro aqui e compartilhe o link e a senha com o seu grupo.</p></section>',
    favoriteCards = !viewer.registered
      ? '<section class="favoriteEmpty"><span aria-hidden="true">♡</span><h2>Entre para guardar seus rankings favoritos.</h2><p>Eles ficam reunidos aqui e podem ser compartilhados de uma vez.</p></section>'
      : favoriteRankings.length
        ? `<div class="favoriteGrid">${favoriteRankings.map((ranking) => favoriteCardHTML(ranking, { editable: true })).join('')}</div>`
        : '<section class="favoriteEmpty"><span aria-hidden="true">♡</span><h2>Você ainda não favoritou nenhum ranking.</h2><p>Toque no coração de um ranking para guardar aqui.</p></section>',
    favoriteAction = viewer.registered
      ? `<button class="favoriteShareButton" id="favoriteShareButton" type="button" ${favoriteRankings.length ? '' : 'disabled'}>COMPARTILHAR FAVORITOS</button>`
      : `<a class="favoriteShareButton" href="${escapeHTML(`/entrar?voltar=${encodeURIComponent('/vip')}`)}">ENTRAR PARA FAVORITAR</a>`,
    createdCount = viewer.registered
      ? `<small>${ownedVipRankings.length}/${Number(data.userRankingLimit || 20)} criados</small>`
      : '';
  feed.innerHTML = `${personalAreaHeaderHTML('activity')}${viewer.registered ? personalScorecardHTML(profileData) : ''}<section class="vipActivityLead"><div><span class="portalKicker">Minha atividade</span><h2>Tudo que é seu no TOPO</h2><p>Favoritos, rankings criados e a história da sua participação.</p></div><div class="vipHeroActions">${createAction}</div></section>${viewer.registered ? vipCreatePanelHTML(createOpen) : ''}<section class="vipCollection favoriteCollection"><div class="vipCollectionHead"><div><span class="portalKicker">Sua seleção</span><h2>Favoritos</h2></div><div class="favoriteCollectionTools"><small>${favoriteRankings.length} salvo${favoriteRankings.length === 1 ? '' : 's'}</small>${favoriteAction}</div></div>${favoriteCards}</section><section class="vipCollection" id="rankings-privados"><div class="vipCollectionHead"><div><span class="portalKicker">Somente para você</span><h2>Meus rankings privados</h2></div>${createdCount}</div>${privateCards}</section>${viewer.registered ? personalActivityHTML(profileData) : ''}`;
  bindVipCreateForm();
  bindVipOwnerActions();
  bindFavoriteButtons();
  bindWhatsAppShares();
  bindNativeShares();
  bindProfileRankingActivityMore(feed);
  document
    .getElementById('favoriteShareButton')
    ?.addEventListener('click', (event) => shareMyFavorites(event.currentTarget));
  if (viewer.registered) {
    void loadProfileLeaderboard();
    void loadProfileSuggestionCenter();
  }
}

function favoriteCollectionToken() {
  const match = location.pathname.match(/^\/favoritos\/([^/]+)\/?$/);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return '';
  }
}

async function loadFavoriteCollection() {
  syncExperienceNavigation();
  groupsEl.innerHTML = '';
  const token = favoriteCollectionToken();
  if (!token) {
    feed.innerHTML =
      '<section class="favoritePublicEmpty"><span class="portalKicker">Favoritos</span><h1>Este link não está completo.</h1><a href="/">Descobrir rankings →</a></section>';
    return;
  }
  const response = await fetch(
      `/api?action=favorite-collection&token=${encodeURIComponent(token)}`,
      { cache: 'no-store' },
    ),
    data = await response.json().catch(() => ({}));
  if (response.status === 404) {
    document.title = 'Favoritos não encontrados — TOPO';
    feed.innerHTML =
      '<section class="favoritePublicEmpty"><span class="portalKicker">Favoritos</span><h1>Esta seleção não está disponível.</h1><p>O link pode ter mudado ou deixado de existir.</p><a href="/">Descobrir rankings →</a></section>';
    return;
  }
  if (!response.ok) throw new Error('favorite_collection');
  favoriteRankings = Array.isArray(data.favorites) ? data.favorites : [];
  const ownerName = String(data.owner?.name || 'Pessoa no TOPO'),
    cards = favoriteRankings.length
      ? `<div class="favoriteGrid favoritePublicGrid">${favoriteRankings.map((ranking) => favoriteCardHTML(ranking)).join('')}</div>`
      : '<section class="favoriteEmpty"><span aria-hidden="true">♡</span><h2>Esta seleção está vazia agora.</h2><p>Quando novos rankings forem favoritados, eles aparecerão neste mesmo link.</p></section>';
  document.title = `Favoritos de ${ownerName} — TOPO`;
  feed.innerHTML = `<section class="favoritePublicHero"><a class="backLink" href="/">← TOPO</a><span class="portalKicker">Uma seleção pessoal</span><h1>Favoritos de ${escapeHTML(ownerName)}</h1><p>Estes são os rankings que ${escapeHTML(ownerName)} guardou no Meu Topo.</p><button class="favoriteShareButton" id="favoritePublicShare" type="button">COMPARTILHAR ESTA SELEÇÃO</button></section><section class="vipCollection favoriteCollection"><div class="vipCollectionHead"><div><span class="portalKicker">No Meu Topo</span><h2>${favoriteRankings.length} favorito${favoriteRankings.length === 1 ? '' : 's'}</h2></div></div>${cards}</section>`;
  document
    .getElementById('favoritePublicShare')
    ?.addEventListener('click', () =>
      shareFavoriteCollectionURL(location.href, `Favoritos de ${ownerName} no TOPO`),
    );
}

function vipGateErrorText(error, result = {}) {
  if (error === 'invalid_vip_password') {
    const remaining = Number(result.attemptsRemaining);
    return Number.isFinite(remaining) && remaining >= 0
      ? `Senha incorreta. Você ainda tem ${remaining} tentativa${remaining === 1 ? '' : 's'} antes da pausa.`
      : 'Senha incorreta. Confira e tente novamente.';
  }
  if (error === 'vip_attempt_limit')
    return 'Muitas tentativas. Aguarde 15 minutos e tente novamente.';
  if (error === 'vip_not_configured') return 'Este ranking ainda não está pronto para acesso.';
  return 'Não consegui liberar o ranking agora. Tente novamente.';
}

function renderVipGate(ranking, message = '') {
  activeVipRankingId = ranking?.id || internalId();
  syncExperienceNavigation();
  document.title = `Meu Topo — TOPO`;
  feed.innerHTML = `<div class="internalHead"><a class="backLink" href="/vip">← Meu Topo</a><span class="internalMeta">Protegido</span></div><section class="vipGate"><span class="vipGateIcon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4.5" y="10" width="15" height="11" rx="3"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path><circle cx="12" cy="15.5" r="1"></circle></svg></span><span class="portalKicker">Meu Topo</span><h1>${escapeHTML(ranking?.q || 'Ranking protegido')}</h1><p>Digite a senha deste ranking para ver as opções e votar.</p><form class="vipGateForm" id="vipGateForm"><label for="vipPassword">Senha do ranking</label><div><input id="vipPassword" name="password" type="password" minlength="4" maxlength="80" autocomplete="current-password" placeholder="Digite a senha" required><button type="submit">ENTRAR</button></div><span class="vipGateStatus ${message ? 'error' : ''}" id="vipGateStatus" role="status" aria-live="polite">${escapeHTML(message)}</span></form><small>O acesso fica salvo neste aparelho por 30 dias.</small></section>`;
  const form = document.getElementById('vipGateForm'),
    input = document.getElementById('vipPassword'),
    status = document.getElementById('vipGateStatus');
  input?.focus();
  form.onsubmit = async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    status.className = 'vipGateStatus';
    status.textContent = 'Conferindo…';
    try {
      const response = await fetch('/api?action=vip-unlock', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ rankingId: ranking.id, password: input.value }),
        }),
        result = await response.json().catch(() => ({}));
      if (!response.ok) throw result;
      status.textContent = 'Acesso liberado.';
      await loadVipRanking(ranking.id);
    } catch (error) {
      status.className = 'vipGateStatus error';
      status.textContent = vipGateErrorText(error?.error, error);
      input.select();
      button.disabled = false;
    }
  };
}

async function loadVipRanking(rankingId, rekeyed = false) {
  const response = await fetch(
      `/api?action=vip-ranking&ranking_id=${encodeURIComponent(rankingId)}&device_id=${encodeURIComponent(deviceId)}`,
      { cache: 'no-store' },
    ),
    result = await response.json().catch(() => ({}));
  if (response.status === 409 && result.error === 'device_rekey_required' && !rekeyed) {
    rotateDeviceId();
    return loadVipRanking(rankingId, true);
  }
  if (response.status === 423 && result.error === 'vip_password_required') {
    renderVipGate(result.ranking || { id: rankingId, q: 'Ranking protegido' });
    return false;
  }
  if (response.status === 404) {
    feed.innerHTML =
      '<div class="loading">Ranking não encontrado.<br><a class="backLink" href="/vip">← Voltar para o Meu Topo</a></div>';
    return false;
  }
  if (!response.ok || !result.ranking) throw new Error('vip_ranking');
  activeVipRankingId = result.ranking.id;
  const existingIndex = rankings.findIndex((ranking) => ranking.id === result.ranking.id);
  if (existingIndex >= 0) rankings[existingIndex] = result.ranking;
  else rankings.push(result.ranking);
  vipOwnerEditorState =
    result.ranking.vipOwned && new URLSearchParams(location.search).get('gerenciar') === '1'
      ? { rankingId: result.ranking.id }
      : vipOwnerEditorState?.rankingId === result.ranking.id
        ? vipOwnerEditorState
        : null;
  if (result.viewer) viewer = result.viewer;
  renderAccount();
  syncExperienceNavigation();
  renderInternal();
  return true;
}

function pageLoadingHTML(kind) {
  if (kind === 'auth')
    return '<div class="authPreload"><span class="loadingSpinner" aria-hidden="true"></span><strong>Abrindo seu acesso…</strong><span>Pode levar alguns segundos.</span></div>';
  if (kind === 'profile')
    return '<div class="authPreload"><span class="loadingSpinner" aria-hidden="true"></span><strong>Carregando seu perfil…</strong></div>';
  if (kind === 'moderation')
    return '<div class="authPreload"><span class="loadingSpinner" aria-hidden="true"></span><strong>Abrindo a moderação…</strong></div>';
  if (kind === 'vip')
    return '<div class="authPreload"><span class="loadingSpinner" aria-hidden="true"></span><strong>Abrindo o Meu Topo…</strong></div>';
  if (kind === 'favorites')
    return '<div class="authPreload"><span class="loadingSpinner" aria-hidden="true"></span><strong>Abrindo os favoritos…</strong></div>';
  return '<div class="loading">carregando…</div>';
}
function revealClientPage() {
  feed.removeAttribute('data-server-rendered');
  document.documentElement.classList.remove('clientBooting');
}
async function load() {
  const kind = pageKind();
  if (feed.dataset.serverRendered !== 'true') feed.innerHTML = pageLoadingHTML(kind);
  try {
    const data = await fetchBootstrap();
    viewer = data.viewer || viewer;
    community = communityFrom(data);
    localCityCatalog = Array.isArray(data.localCities) ? data.localCities : [];
    rankings = smartShuffle(data.rankings || []);
    initializeCity(data.location || {});
    renderAccount();
    renderCommunityPulse();
    if (kind === 'home') {
      renderGroups();
      renderHome();
    } else {
      groupsEl.innerHTML = '';
      if (kind === 'ranking') {
        if (rankings.some((ranking) => ranking.id === internalId())) renderInternal();
        else await loadVipRanking(internalId());
      } else if (kind === 'auth') await renderAuth();
      else if (kind === 'profile') await renderProfile();
      else if (kind === 'moderation') await renderModeration();
      else if (kind === 'vip') await loadVipArea();
      else if (kind === 'favorites') await loadFavoriteCollection();
    }
    revealClientPage();
  } catch (e) {
    feed.innerHTML =
      '<div class="loading">Não consegui carregar.<br><button class="retry" onclick="load()">Tentar de novo</button></div>';
    revealClientPage();
  }
}
function reshuffle() {
  sessionHeroId = '';
  rankings = smartShuffle(rankings);
  categoryVisibleCount = CATEGORY_PAGE_SIZE;
  renderHome();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function visibleRankings() {
  const hasSearch = searchTerms(homeSearch).length > 0,
    experienceSource = localRankingsForSelectedCity(),
    source = hasSearch
      ? globalSearchRankings()
      : activeGroup === 'Todos'
        ? experienceSource
        : experienceSource.filter((r) => belongsToGroup(r, activeGroup)),
    matched = hasSearch
      ? source.filter((r) => searchMatches(rankingSearchText(r), homeSearch))
      : source;
  if (hasSearch || isLocalExperience() || activeGroup !== 'Futebol') return matched;
  return matched.filter((ranking) =>
    activeFootballSection === 'times'
      ? isClubPlayerRanking(ranking)
      : !isClubPlayerRanking(ranking),
  );
}
function homeEligibleRankings(list) {
  return list.filter((ranking) => !isClubPlayerRanking(ranking));
}
function firstShowSeen() {
  try {
    const ids = JSON.parse(localStorage.getItem(firstShowKey) || '[]');
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}
function rememberFirstShow(id) {
  try {
    const ids = [...firstShowSeen().add(id)].slice(-200);
    localStorage.setItem(firstShowKey, JSON.stringify(ids));
  } catch {}
}
function choosePortalHero(list) {
  const pool = [...list.filter((r) => r.img), ...list.filter((r) => !r.img)];
  if (!pool.length) return null;
  if (homeSearch) return pool[0];
  if (sessionHeroId) {
    const current = pool.find((r) => r.id === sessionHeroId);
    if (current) return current;
  }
  const seen = firstShowSeen(),
    first = pool.find((r) => isFirstShowCandidate(r) && !seen.has(r.id)),
    previous = localStorage.getItem(lastHeroKey) || '',
    hero = first || pool.find((r) => r.id !== previous) || pool[0];
  sessionHeroId = hero.id;
  if (first) rememberFirstShow(first.id);
  try {
    localStorage.setItem(lastHeroKey, hero.id);
  } catch {}
  return hero;
}
function rankingPath(id) {
  return '/ranking/' + encodeURIComponent(id);
}
function rankingCategoryPath(ranking) {
  if (ranking.vip) return '/vip';
  if (topoLocal.isLocalRanking(ranking))
    return topoLocal.collectionPath(
      topoLocal.cityForRanking(ranking),
      topoLocal.groupForRanking(ranking),
    );
  if (isClubPlayerRanking(ranking)) return '/categoria/futebol/times';
  return `/categoria/${generalGroupSlugs[groupOf(ranking)] || 'vida'}`;
}
function internalId() {
  return decodeURIComponent(location.pathname.split('/ranking/')[1] || '');
}
function authReturn() {
  const path = queryParams.get('voltar') || '',
    safe =
      !path.startsWith('//') &&
      (path.startsWith('/ranking/') ||
        path.startsWith('/perfil') ||
        path === '/vip' ||
        path.startsWith('/moderacao'));
  return safe ? path : '/perfil';
}
function doubleVoteBadgeHTML(o) {
  return Number(o?.mine) !== 0 && Number(o?.mineWeight) === 2
    ? '<span class="doubleVoteBadge" title="Voto duplo ativo">2×</span>'
    : '';
}
function doubleVoteActionHTML(o, direction) {
  const mine = Number(o?.mine || 0),
    active = mine === direction && Number(o?.mineWeight || 1) === 2,
    available = Math.max(0, Number(viewer?.doubleVotes?.available || 0));
  if (!viewer.registered || mine !== direction || (!active && available === 0)) return '';
  const label = escapeHTML(o.label);
  return `<button class="doubleVoteAction ${active ? 'active' : ''}" type="button" data-double-vote data-id="${o.id}" data-dir="${direction}" data-active="${active ? '1' : '0'}" aria-pressed="${active}" aria-label="${active ? 'Voltar ao voto simples em' : 'Usar voto duplo em'} ${label}">2×</button>`;
}
function categoryVoteActionsHTML(r, o) {
  const path = `${rankingPath(r.id)}#votar`,
    mine = Number(o?.mine || 0),
    label = escapeHTML(o.label),
    upSelected = mine === 1,
    downSelected = mine === -1;
  return `<span class="actions categoryVoteActions"><a class="react up ${upSelected ? 'selected' : ''} categoryPreviewReact" href="${path}" aria-label="Abrir o ranking para ${upSelected ? 'alterar o voto em' : `fazer ${label} subir`}">↑</a><a class="react down ${downSelected ? 'selected' : ''} categoryPreviewReact" href="${path}" aria-label="Abrir o ranking para ${downSelected ? 'alterar o voto em' : `fazer ${label} descer`}">↓</a></span>`;
}
function rankMark(i) {
  const n = i + 1;
  if (n === 1)
    return '<span class="topBadge gold" title="Estou no topo · Ouro" aria-label="1º lugar, selo ouro">1</span>';
  if (n === 2)
    return '<span class="topBadge silver" title="Estou no topo · Prata" aria-label="2º lugar, selo prata">2</span>';
  if (n === 3)
    return '<span class="topBadge bronze" title="Estou no topo · Bronze" aria-label="3º lugar, selo bronze">3</span>';
  return n;
}
function topGap(r) {
  return r?.opts?.length > 1 ? Math.abs(Number(r.opts[0].score) - Number(r.opts[1].score)) : 0;
}
function gapText(r) {
  const g = topGap(r);
  return g === 0
    ? 'empate no topo'
    : g === 1
      ? '1 ponto separa o topo'
      : `${g} pontos separam o topo`;
}
function portalImageHTML(r, eager = false) {
  if (!r?.img) return '<span class="portalImageFallback">TOPO</span>';
  return `<img data-ranking-image src="${escapeHTML(r.img)}" alt="" ${eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}
function whatsAppIconHTML() {
  return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12.04 2C6.53 2 2.06 6.36 2.06 11.74c0 1.71.46 3.39 1.34 4.86L2 22l5.56-1.36a10.18 10.18 0 0 0 4.48 1.03h.01c5.5 0 9.98-4.37 9.98-9.74C22.02 6.36 17.55 2 12.04 2Zm0 17.77c-1.42 0-2.81-.37-4.03-1.07l-.29-.17-3.3.8.88-3.13-.19-.3a7.6 7.6 0 0 1-1.22-4.16c0-4.31 3.65-7.82 8.15-7.82 4.49 0 8.14 3.51 8.14 7.82 0 4.31-3.65 7.82-8.14 7.82Zm4.47-5.86c-.24-.12-1.45-.69-1.68-.77-.23-.08-.4-.12-.57.12-.16.24-.64.77-.79.93-.14.16-.29.18-.53.06-.25-.12-1.04-.37-1.98-1.18-.73-.63-1.23-1.42-1.37-1.66-.14-.24-.02-.37.11-.49.11-.11.24-.28.37-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.57-1.32-.78-1.81-.2-.47-.41-.41-.57-.42h-.48c-.16 0-.43.06-.65.3-.22.24-.85.81-.85 1.97s.87 2.29.99 2.45c.12.16 1.71 2.52 4.14 3.53.58.24 1.03.38 1.38.49.58.18 1.11.15 1.53.09.47-.07 1.45-.57 1.65-1.13.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.47-.28Z"></path></svg>';
}
function nativeShareIconHTML() {
  return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 11v8h14v-8"></path></svg>';
}
function incomingShareReferralToken(rankingId = internalId()) {
  const token = queryParams.get('via') || '';
  return rankingId === internalId() && /^[a-zA-Z0-9_-]{24,64}$/.test(token) ? token : '';
}
async function trackedRankingShareURL(rankingId, rawURL, channel = 'native') {
  const url = new URL(rawURL, location.origin),
    inboundToken = incomingShareReferralToken(rankingId);
  if (!viewer.registered) {
    if (inboundToken) url.searchParams.set('via', inboundToken);
    return url.toString();
  }

  url.searchParams.delete('via');
  try {
    const response = await fetch('/api?action=ranking-share', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, ranking_id: rankingId, channel }),
      }),
      result = await response.json().catch(() => ({}));
    if (response.ok && result.tracked && result.token) url.searchParams.set('via', result.token);
  } catch {}
  return url.toString();
}
function whatsAppShareURL(r, url = location.origin + rankingPath(r.id)) {
  const leader = r?.opts?.[0]?.label || '',
    text = `*${r.q}*\n${leader ? '🥇 ' + leader + ' está no topo agora.\n' : ''}Vote e mude o ranking no TOPO:\n${url}`;
  return 'https://wa.me/?text=' + encodeURIComponent(text);
}
function whatsAppShareHTML(r, compact = false) {
  return `<a class="whatsappShare ${compact ? 'compact' : ''}" href="${escapeHTML(whatsAppShareURL(r))}" data-whatsapp-share="${escapeHTML(r.id)}" target="_blank" rel="noopener noreferrer" aria-label="Compartilhar ${escapeHTML(r.q)} no WhatsApp">${whatsAppIconHTML()}${compact ? '' : '<span>WhatsApp</span>'}</a>`;
}
function nativeShareHTML(r, compact = false) {
  return `<button class="nativeShare ${compact ? 'compact' : ''}" type="button" data-native-share="${escapeHTML(r.id)}" title="Instagram e outros" aria-label="Compartilhar ${escapeHTML(r.q)} no Instagram ou em outro aplicativo">${nativeShareIconHTML()}${compact ? '' : '<span>Instagram e outros</span>'}</button>`;
}
function shareActionsHTML(r, compact = false) {
  return `<span class="shareActions ${compact ? 'compact' : ''}" role="group" aria-label="Opções para compartilhar">${whatsAppShareHTML(r, compact)}${nativeShareHTML(r, compact)}</span>`;
}
function favoriteIconHTML() {
  return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.8 4.9a5.5 5.5 0 0 0-7.8 0L12 5.9l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.3 1-1a5.5 5.5 0 0 0 0-7.8Z"></path></svg>';
}
function favoriteButtonHTML(r, { remove = false } = {}) {
  if (!r || r.vip) return '';
  const active = r.favorite === true,
    label = remove ? 'Remover' : active ? 'Favoritado' : 'Favoritar';
  const ariaLabel =
    remove || active ? `Remover ${r.q} dos favoritos` : `Adicionar ${r.q} aos favoritos`;
  return `<button class="favoriteToggle ${active ? 'active' : ''}" type="button" data-favorite-ranking="${escapeHTML(r.id)}" ${remove ? 'data-favorite-remove="1"' : ''} aria-pressed="${active}" aria-label="${escapeHTML(ariaLabel)}">${favoriteIconHTML()}<span>${label}</span></button>`;
}
function rankingPersonalActionsHTML(r, placement = 'desktop') {
  if (r.vip) return '';
  const placementClass =
    placement === 'mobile' ? 'rankingPersonalActionsMobile' : 'rankingPersonalActionsDesktop';
  return `<div class="rankingShareRow rankingPersonalActions ${placementClass}">${favoriteButtonHTML(r)}${shareActionsHTML(r)}</div>`;
}
function rankingPromotionOptionId() {
  const optionId = Number(new URLSearchParams(location.search).get('apoiar'));
  return Number.isSafeInteger(optionId) && optionId > 0 ? optionId : 0;
}
function rankingOptionPromotionURL(r, option) {
  const url = new URL(rankingPath(r.id), location.origin);
  url.searchParams.set('modo', 'livre');
  url.searchParams.set('apoiar', String(option.id));
  url.hash = `opcao-${option.id}`;
  return url.toString();
}
function rankingOptionPromotionText(r, option, url = rankingOptionPromotionURL(r, option)) {
  return `Estamos na disputa pelo TOPO!\n\nVote em ${option.label} no ranking “${r.q}”.\n\n${url}`;
}
function rankingOptionPromotionHTML(r) {
  if (r.vip || !r.opts?.length || !topoLocal.isLocalRanking(r)) return '';
  return '<button class="rankingOptionPromotionLauncher" type="button" data-ranking-option-promotion aria-haspopup="dialog"><span>TEM UM FAVORITO?</span><strong>Chame sua torcida</strong><b aria-hidden="true">→</b></button>';
}
function rankingPromotionWrapLines(context, text, maxWidth) {
  const words = String(text || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean),
    lines = [];
  let line = '';
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  });
  if (line) lines.push(line);
  return lines;
}
function rankingPromotionTextLayout(
  context,
  text,
  { maxWidth, maxLines, maxSize, minSize, weight = 900, lineHeight = 0.98 },
) {
  let lines = [],
    size = maxSize;
  for (; size >= minSize; size -= 2) {
    context.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
    lines = rankingPromotionWrapLines(context, text, maxWidth);
    if (
      lines.length <= maxLines &&
      lines.every((line) => context.measureText(line).width <= maxWidth)
    )
      break;
  }
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines.at(-1) || '';
    while (last && context.measureText(`${last}…`).width > maxWidth)
      last = last.slice(0, -1).trim();
    lines[lines.length - 1] = `${last}…`;
  }
  return { lines, size: Math.max(size, minSize), lineHeight: Math.max(size, minSize) * lineHeight };
}
function drawRankingPromotionText(context, text, settings) {
  const layout = rankingPromotionTextLayout(context, text, settings);
  context.font = `${settings.weight || 900} ${layout.size}px Arial, Helvetica, sans-serif`;
  context.fillStyle = settings.color || '#0a0a0a';
  context.textBaseline = 'top';
  layout.lines.forEach((line, index) =>
    context.fillText(line, settings.x, settings.y + index * layout.lineHeight),
  );
  return layout;
}
let rankingPromotionLogoPromise;
function loadRankingPromotionLogo() {
  if (!rankingPromotionLogoPromise) {
    rankingPromotionLogoPromise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => {
        rankingPromotionLogoPromise = null;
        reject(new Error('topo_logo_unavailable'));
      };
      image.src = '/logo-topo-v4.svg';
    });
  }
  return rankingPromotionLogoPromise;
}
function drawRankingPromotionLinkIcon(context, x, y) {
  context.save();
  context.translate(x, y);
  context.rotate(-Math.PI / 4);
  context.strokeStyle = '#ff513f';
  context.lineWidth = 11;
  context.lineCap = 'round';
  context.beginPath();
  context.roundRect(-37, -15, 58, 30, 15);
  context.stroke();
  context.beginPath();
  context.roundRect(-3, -15, 58, 30, 15);
  context.stroke();
  context.restore();
}
async function rankingOptionPromotionCanvas(r, option) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const context = canvas.getContext('2d'),
    ink = '#0a0a0a',
    paper = '#ffffff',
    coral = '#ff513f',
    contentX = 64,
    contentWidth = 952,
    city = topoLocal.cityForRanking(r) || 'Sua cidade';
  if (!context) throw new Error('canvas_unavailable');
  const logo = await loadRankingPromotionLogo();

  context.fillStyle = coral;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = paper;
  context.fillRect(0, 0, canvas.width, 252);
  context.drawImage(logo, contentX, 49, 370, (370 * 230) / 884);
  context.fillStyle = ink;
  context.textBaseline = 'top';
  context.font = '800 24px Arial, Helvetica, sans-serif';
  context.fillText('TUDO VIRA RANKING.', contentX + 2, 169);

  context.textAlign = 'right';
  context.fillStyle = coral;
  context.font = '900 29px Arial, Helvetica, sans-serif';
  context.fillText('TOPO LOCAL', contentX + contentWidth, 70);
  context.fillStyle = ink;
  context.font = '800 25px Arial, Helvetica, sans-serif';
  context.fillText(String(city).toLocaleUpperCase('pt-BR'), contentX + contentWidth, 121);
  context.textAlign = 'left';

  context.font = '900 31px Arial, Helvetica, sans-serif';
  const campaignLabel = 'ESTAMOS NA DISPUTA PELO TOPO!',
    campaignWidth = Math.min(contentWidth, context.measureText(campaignLabel).width + 48);
  context.fillStyle = ink;
  context.fillRect(contentX, 315, campaignWidth, 72);
  context.fillStyle = paper;
  context.fillText(campaignLabel, contentX + 24, 334);
  const questionLayout = drawRankingPromotionText(context, r.q, {
      x: contentX,
      y: 455,
      maxWidth: contentWidth,
      maxLines: 5,
      maxSize: 82,
      minSize: 48,
      weight: 900,
      lineHeight: 0.96,
      color: paper,
    }),
    questionBottom = 455 + questionLayout.lines.length * questionLayout.lineHeight,
    optionPanelY = Math.max(850, Math.min(920, Math.ceil(questionBottom + 56))),
    optionPanelBottom = 1400;

  context.fillStyle = paper;
  context.fillRect(contentX, optionPanelY, contentWidth, optionPanelBottom - optionPanelY);
  context.fillStyle = coral;
  context.font = '900 38px Arial, Helvetica, sans-serif';
  context.fillText('VOTE EM', contentX + 52, optionPanelY + 66);
  drawRankingPromotionText(context, option.label, {
    x: contentX + 52,
    y: optionPanelY + 158,
    maxWidth: contentWidth - 104,
    maxLines: 3,
    maxSize: 138,
    minSize: 58,
    weight: 900,
    lineHeight: 0.92,
    color: ink,
  });

  context.fillStyle = ink;
  context.fillRect(contentX, 1462, contentWidth, 4);
  context.fillStyle = paper;
  context.font = '900 61px Arial, Helvetica, sans-serif';
  context.fillText('CHAME SUA TORCIDA', contentX, 1513);
  context.textAlign = 'right';
  context.fillStyle = ink;
  context.font = '900 104px Arial, Helvetica, sans-serif';
  context.fillText('→', contentX + contentWidth, 1484);
  context.textAlign = 'left';

  context.fillStyle = paper;
  context.roundRect(contentX, 1630, 690, 120, 12);
  context.fill();
  drawRankingPromotionLinkIcon(context, contentX + 72, 1690);
  context.fillStyle = ink;
  context.font = '900 52px Arial, Helvetica, sans-serif';
  context.fillText('VOTE NO TOPO', contentX + 142, 1661);
  context.fillStyle = paper;
  context.font = '800 28px Arial, Helvetica, sans-serif';
  context.fillText('somostopo.com.br', contentX, 1815);
  return canvas;
}
function rankingPromotionFileName(option) {
  const stem = String(option?.label || 'opcao')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 52);
  return `${stem || 'opcao'}-story-topo.png`;
}
function rankingPromotionBlob(canvas) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('card_generation_failed'))),
      'image/png',
      1,
    ),
  );
}
async function copyRankingPromotionText(text) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.append(field);
    field.select();
    const copied = document.execCommand?.('copy') === true;
    field.remove();
    return copied;
  }
}
function downloadRankingPromotionCard(blob, option) {
  const objectURL = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = objectURL;
  link.download = rankingPromotionFileName(option);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectURL), 1000);
}
async function downloadRankingOptionStory(
  r,
  option,
  shareURL = rankingOptionPromotionURL(r, option),
) {
  const canvas = await rankingOptionPromotionCanvas(r, option),
    blob = await rankingPromotionBlob(canvas);
  downloadRankingPromotionCard(blob, option);
  const copied = await copyRankingPromotionText(shareURL);
  toast(
    copied
      ? 'Story baixado. Link copiado para o adesivo do Instagram.'
      : 'Story baixado. Copie o link que está pronto na tela.',
  );
  return true;
}
function openRankingOptionPromotion(r) {
  if (r.vip || !r.opts?.length) return;
  const requestedOptionId = rankingPromotionOptionId(),
    initialOption = r.opts.find((option) => Number(option.id) === requestedOptionId) || r.opts[0],
    options = r.opts
      .map(
        (option) =>
          `<option value="${option.id}" ${Number(option.id) === Number(initialOption.id) ? 'selected' : ''}>${escapeHTML(option.label)}</option>`,
      )
      .join('');
  showModal(
    `<div class="rankingPromotionModal"><div class="rankingPromotionModalHead"><div><div class="modalKicker">Apoie seu favorito</div><div class="modalTitle">Chame sua torcida.</div></div><button class="rankingPromotionClose" type="button" data-close aria-label="Fechar">×</button></div><p class="modalText">Escolha quem você quer apoiar e divulgue pelo WhatsApp ou no Story.</p><div class="rankingPromotionControls"><label class="rankingPromotionField"><span>Quem você quer apoiar?</span><select id="rankingPromotionOption">${options}</select></label><label class="rankingPromotionField"><span>Texto e link</span><textarea id="rankingPromotionText" rows="4" readonly></textarea></label><div class="modalActions rankingPromotionActions"><a class="main" id="rankingPromotionWhatsApp" target="_blank" rel="noopener noreferrer">WHATSAPP</a><button id="rankingPromotionStory" type="button">BAIXAR STORY</button><button id="rankingPromotionCopy" type="button">COPIAR TEXTO E LINK</button></div></div></div>`,
  );
  const layer = document.getElementById('modalLayer'),
    card = layer.querySelector('.modalCard'),
    select = layer.querySelector('#rankingPromotionOption'),
    textField = layer.querySelector('#rankingPromotionText'),
    whatsApp = layer.querySelector('#rankingPromotionWhatsApp'),
    storyButton = layer.querySelector('#rankingPromotionStory'),
    copyButton = layer.querySelector('#rankingPromotionCopy');
  card?.classList.add('rankingPromotionModalCard');
  let selectedOption = initialOption;
  const renderSelection = () => {
    selectedOption =
      r.opts.find((option) => Number(option.id) === Number(select.value)) || initialOption;
    const text = rankingOptionPromotionText(r, selectedOption);
    textField.value = text;
    whatsApp.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
  };
  select.onchange = renderSelection;
  whatsApp.onclick = async (event) => {
    event.preventDefault();
    const option = selectedOption,
      shareURL = await trackedRankingShareURL(
        r.id,
        rankingOptionPromotionURL(r, option),
        'promotion',
      ),
      text = rankingOptionPromotionText(r, option, shareURL);
    textField.value = text;
    location.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
  };
  copyButton.onclick = async () => {
    copyButton.disabled = true;
    try {
      const option = selectedOption,
        shareURL = await trackedRankingShareURL(
          r.id,
          rankingOptionPromotionURL(r, option),
          'promotion',
        ),
        text = rankingOptionPromotionText(r, option, shareURL),
        copied = await copyRankingPromotionText(text);
      textField.value = text;
      toast(copied ? 'Texto e link copiados.' : 'Não consegui copiar automaticamente.');
    } finally {
      copyButton.disabled = false;
    }
  };
  storyButton.onclick = async () => {
    const option = selectedOption,
      originalLabel = storyButton.textContent;
    storyButton.disabled = true;
    storyButton.textContent = 'PREPARANDO STORY…';
    try {
      const shareURL = await trackedRankingShareURL(
        r.id,
        rankingOptionPromotionURL(r, option),
        'promotion',
      );
      await downloadRankingOptionStory(r, option, shareURL);
    } catch {
      toast('Não consegui gerar o Story. Tente novamente.');
    } finally {
      storyButton.disabled = false;
      storyButton.textContent = originalLabel;
    }
  };
  renderSelection();
}
function bindRankingOptionPromotion(r) {
  document
    .querySelectorAll('[data-ranking-option-promotion]')
    .forEach((button) => (button.onclick = () => openRankingOptionPromotion(r)));
}
function focusRankingPromotionOption(r) {
  const optionId = rankingPromotionOptionId(),
    focusKey = `${r.id}:${optionId}`;
  if (!optionId || r.vip || rankingPromotionFocusKey === focusKey) return;
  const option = document.getElementById(`opcao-${optionId}`);
  if (!option) return;
  rankingPromotionFocusKey = focusKey;
  requestAnimationFrame(() => {
    option.scrollIntoView({ behavior: 'smooth', block: 'center' });
    option.setAttribute('tabindex', '-1');
    option.focus({ preventScroll: true });
  });
}
function syncFavoriteButtons(rankingId, active) {
  document.querySelectorAll('[data-favorite-ranking]').forEach((button) => {
    if (button.dataset.favoriteRanking !== rankingId) return;
    const remove = button.dataset.favoriteRemove === '1';
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
    const label = button.querySelector('span');
    if (label) label.textContent = remove ? 'Remover' : active ? 'Favoritado' : 'Favoritar';
  });
}
async function toggleFavorite(button) {
  const rankingId = button.dataset.favoriteRanking,
    ranking = rankings.find((item) => item.id === rankingId),
    active = ranking?.favorite === true || button.classList.contains('active'),
    next = !active;
  if (!viewer.registered) {
    location.assign(`/entrar?voltar=${encodeURIComponent(rankingPath(rankingId))}`);
    return;
  }
  button.disabled = true;
  try {
    const response = await fetch(
        next
          ? '/api?action=favorites'
          : `/api?action=favorites&ranking_id=${encodeURIComponent(rankingId)}`,
        next
          ? {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ rankingId }),
            }
          : { method: 'DELETE' },
      ),
      result = await response.json().catch(() => ({}));
    if (response.status === 401) {
      location.assign(`/entrar?voltar=${encodeURIComponent(rankingPath(rankingId))}`);
      return;
    }
    if (!response.ok) throw result;
    rankings.forEach((item) => {
      if (item.id === rankingId) item.favorite = next;
    });
    favoriteRankings.forEach((item) => {
      if (item.id === rankingId) item.favorite = next;
    });
    if (!next) favoriteRankings = favoriteRankings.filter((item) => item.id !== rankingId);
    syncFavoriteButtons(rankingId, next);
    toast(next ? 'Ranking salvo nos favoritos' : 'Ranking removido dos favoritos');
    if (pageKind() === 'vip') await loadVipArea();
  } catch {
    button.disabled = false;
    toast('Não consegui atualizar seus favoritos agora');
  } finally {
    button.disabled = false;
  }
}
function bindFavoriteButtons() {
  document
    .querySelectorAll('[data-favorite-ranking]')
    .forEach((button) => (button.onclick = () => toggleFavorite(button)));
}
function portalHeroHTML(r, secondary = false) {
  const heading = secondary ? `<h2>${escapeHTML(r.q)}</h2>` : `<h1>${escapeHTML(r.q)}</h1>`;
  return `<article class="portalHero ${secondary ? 'portalHeroSecondary' : 'portalHeroPrimary'}"><a class="portalHeroLink" href="${rankingPath(r.id)}"><span class="portalHeroMedia">${portalImageHTML(r, !secondary)}</span><span class="portalHeroCopy"><span class="portalHeroEyebrow">${secondary ? 'PARA DESCOBRIR' : 'RANKING DO MOMENTO'}</span><span class="portalKicker"><span class="portalHeroCategory">${escapeHTML(categoryLabel(r))}</span>${newBadgeHTML(r)}</span>${heading}<span class="portalHeroAction">abrir ranking →</span></span></a>${shareActionsHTML(r, true)}</article>`;
}
function popHomeLeadHTML(hero, secondary = null) {
  return `<div class="popHomeStats" aria-label="Números da comunidade"><span class="popHomeTagline">Tudo vira ranking.</span><span><strong>${fmt(community.rankings)}</strong> rankings</span><i></i><span><strong>${fmt(community.votes)}</strong> votos</span><button type="button" onclick="reshuffle()">trocar destaque ↻</button></div><section class="portalLeadGrid popHomeLead editorialHomeLead" aria-label="Rankings em destaque">${portalHeroHTML(hero)}${secondary ? portalHeroHTML(secondary, true) : ''}</section>`;
}
function popLocalCalloutHTML() {
  return `<section class="popLocalCallout"><div><span class="popEyebrow">PERTO DE VOCÊ</span><h2>TOPO <em>LOCAL</em></h2><p>Quem mora escolhe. Todo mundo descobre.</p></div><div class="popLocalCity"><span>●</span><strong>${escapeHTML(selectedCity || 'Sua cidade')}</strong></div><div class="popLocalTopics"><span>Restaurantes</span><span>Pizza</span><span>Cafés</span><span>Academias</span></div><a href="/local" aria-label="Abrir o TOPO LOCAL">↗</a></section>`;
}
function portalSideStoryHTML(r) {
  return `<article class="portalSideStory"><a class="portalSideMedia" href="${rankingPath(r.id)}">${portalImageHTML(r)}</a><div class="portalSideCopy"><span class="portalKicker">${escapeHTML(categoryLabel(r))} ${newBadgeHTML(r)}</span><a href="${rankingPath(r.id)}"><h2>${escapeHTML(r.q)}</h2></a><div class="portalSideFoot"><span class="portalStoryMeta">${voteCountText(r.votes)}</span>${shareActionsHTML(r, true)}</div></div></article>`;
}
function portalListHTML(title, list, tone = '') {
  return `<section class="portalRankPanel ${tone}"><div class="portalPanelTitle">${title}</div><ol>${list.map((r, i) => `<li><span class="portalListNum">${String(i + 1).padStart(2, '0')}</span><a href="${rankingPath(r.id)}"><strong>${escapeHTML(r.q)}</strong><small>${tone === 'disputed' ? escapeHTML(gapText(r)) : voteCountText(r.votes)}</small></a></li>`).join('')}</ol></section>`;
}
function portalStoryHTML(r, i) {
  const variant = !r.img || i % 4 === 2 ? 'compact' : i % 4 === 0 ? 'feature' : 'row';
  return `<article class="portalStory ${variant}">${variant !== 'compact' ? `<a class="portalStoryMedia" href="${rankingPath(r.id)}">${portalImageHTML(r)}</a>` : ''}<div class="portalStoryCopy"><span class="portalKicker">${escapeHTML(categoryLabel(r))} ${newBadgeHTML(r)}</span><a href="${rankingPath(r.id)}"><h2>${escapeHTML(r.q)}</h2></a><div class="portalStoryFoot"><span>${voteCountText(r.votes)}</span><div class="portalStoryActions">${shareActionsHTML(r, true)}<a href="${rankingPath(r.id)}">abrir ranking →</a></div></div></div></article>`;
}
function cityPriorityDelta(a, b) {
  if (!isLocalExperience() || !selectedCity) return 0;
  return (
    Number(topoLocal.cityMatches(b, selectedCity)) - Number(topoLocal.cityMatches(a, selectedCity))
  );
}
function sortForExperience(list, compare = () => 0) {
  return [...list].sort((a, b) => cityPriorityDelta(a, b) || compare(a, b));
}
function portalTrendingHTML(list, label = 'Em alta') {
  const hot = sortForExperience(
    list,
    (a, b) =>
      Number(b.todayVotes || 0) - Number(a.todayVotes || 0) ||
      Number(b.votes || 0) - Number(a.votes || 0),
  ).slice(0, 4);
  if (!hot.length) return '';
  return `<section class="portalTrending"><span class="portalTrendingLabel">${escapeHTML(label)}</span><div>${hot.map((r) => `<a href="${rankingPath(r.id)}"><span>${escapeHTML(r.q)}</span></a>`).join('')}</div></section>`;
}
function portalIdeaCalloutHTML() {
  return `<section class="portalIdeaCallout"><div><span class="portalKicker">A comunidade também cria</span><h2>Tem uma ideia de ranking?</h2><p>Sugira um tema no Meu Topo e acompanhe a análise.</p></div><a href="/vip#sugerir-ranking">Sugerir novo ranking →</a></section>`;
}
function clearHomeSearch() {
  homeSearch = '';
  categoryVisibleCount = CATEGORY_PAGE_SIZE;
  if (searchInput) searchInput.value = '';
  syncHomeSearchURL();
  renderGroups();
  renderHome();
  searchInput?.focus();
}
function categoryPriorityRankings(list) {
  return sortForExperience(
    list,
    (a, b) =>
      (myVoteCount(a) > 0) - (myVoteCount(b) > 0) ||
      Number(b.votes || 0) - Number(a.votes || 0) ||
      Number(b.todayVotes || 0) - Number(a.todayVotes || 0) ||
      (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0),
  );
}
function categorySortedRankings(list) {
  return categoryPriorityRankings(list);
}
function categoryVoteOptionHTML(r, o, index) {
  const voteHref = `${rankingPath(r.id)}#votar`,
    label = escapeHTML(o.label);
  return `<div class="categoryVoteOption" data-option-id="${o.id}"><span class="categoryVotePos">${index + 1}</span><a class="categoryVoteName" href="${voteHref}"><strong>${label}</strong>${doubleVoteBadgeHTML(o)}</a>${categoryVoteActionsHTML(r, o)}</div>`;
}
function categoryVoteListHTML(r) {
  const options = (r.opts || []).slice(0, 3);
  return `<div class="categoryVoteList" aria-label="Três primeiros itens de ${escapeHTML(r.q)}">${options.map((option, index) => categoryVoteOptionHTML(r, option, index)).join('')}</div>`;
}
function categoryRankCardHTML(r) {
  const path = rankingPath(r.id),
    rankingId = escapeHTML(r.id);
  return `<article class="categoryRankCard" data-ranking-id="${rankingId}"><div class="categoryRankMedia"><a class="categoryRankImageLink" href="${path}" aria-label="Abrir ${escapeHTML(r.q)}">${portalImageHTML(r)}</a><div class="categoryRankOverlay"><div class="categoryRankMeta"><span class="categoryWrap"><a class="category" href="${rankingCategoryPath(r)}">${escapeHTML(categoryLabel(r))}</a>${newBadgeHTML(r)}</span></div><a class="categoryRankTitle" href="${path}"><h2>${escapeHTML(r.q)}</h2></a></div></div>${categoryVoteListHTML(r)}<div class="categoryRankLinks categoryRankFooter">${shareActionsHTML(r, true)}<a class="categoryVoteCta" href="${path}#votar">VER RANKING <b>→</b></a></div></article>`;
}
function categoryRankCardsHTML(list) {
  return list.map(categoryRankCardHTML).join('');
}
function localCityExplorerHTML() {
  if (!isLocalExperience()) return '';
  const cities = catalogCities().filter((city) => city !== selectedCity);
  if (!cities.length) return '';
  return `<section class="localCatalogFooter"><div class="localCatalogFooterCopy"><span class="portalKicker">Trocar de lugar</span><h2>Quer explorar outra cidade?</h2><p>Escolha uma cidade para ver somente os rankings de lá.</p></div><button id="toggleLocalCityExplorer" class="localExploreButton" type="button" aria-expanded="false" aria-controls="localCityOptions">Explorar outra cidade</button><p class="localDataCredit">Dados iniciais: <a href="https://docs.overturemaps.org/attribution/" target="_blank" rel="noreferrer">Overture Maps Foundation</a> e diretórios públicos locais. A ordem é definida pelos votos da comunidade.</p><div class="localCityOptions" id="localCityOptions" hidden>${cities
    .map((city) => {
      const total = catalogCityCount(city);
      return `<a href="${topoLocal.collectionPath(city)}" data-local-city="${escapeHTML(city)}"><strong>${escapeHTML(city)}</strong><span>${fmt(total)} ranking${total === 1 ? '' : 's'}</span></a>`;
    })
    .join('')}</div></section>`;
}
function bindLocalCityExplorer() {
  const toggle = document.getElementById('toggleLocalCityExplorer'),
    options = document.getElementById('localCityOptions');
  if (toggle && options)
    toggle.onclick = () => {
      const opening = options.hidden;
      options.hidden = !opening;
      toggle.setAttribute('aria-expanded', String(opening));
      toggle.textContent = opening ? 'Fechar cidades' : 'Explorar outra cidade';
      if (opening) options.querySelector('a')?.focus();
    };
}
function bindCategoryControls() {
  document.getElementById('loadMoreRankings')?.addEventListener('click', () => {
    categoryVisibleCount += CATEGORY_PAGE_SIZE;
    renderHome();
    document.getElementById('loadMoreRankings')?.focus();
  });
  bindLocalCityExplorer();
}
function footballCategoryTabsHTML() {
  if (isLocalExperience() || activeGroup !== 'Futebol' || homeSearch) return '';
  const teamCount = experienceRankings().filter(isClubPlayerRanking).length,
    teamsActive = activeFootballSection === 'times';
  return `<nav class="footballCategoryTabs" aria-label="Seções de futebol"><a class="${teamsActive ? '' : 'active'}" href="/categoria/futebol" ${teamsActive ? '' : 'aria-current="page"'}>Geral</a><a class="${teamsActive ? 'active' : ''}" href="/categoria/futebol/times" ${teamsActive ? 'aria-current="page"' : ''}>Times <span>${fmt(teamCount)}</span></a></nav>`;
}
function renderCategoryHome(visible) {
  const sorted = categorySortedRankings(visible),
    shown = sorted.slice(0, categoryVisibleCount),
    remaining = Math.max(0, sorted.length - shown.length),
    isAll = activeGroup === 'Todos',
    local = isLocalExperience(),
    teamsSection = !local && activeGroup === 'Futebol' && activeFootballSection === 'times',
    preferredCount = visible.length,
    heading = teamsSection ? 'Times' : local && isAll ? `Rankings em ${selectedCity}` : activeGroup,
    kicker = teamsSection
      ? 'Futebol'
      : local
        ? `${selectedCity} no TOPO`
        : isAll
          ? 'Todos os rankings'
          : 'Categoria',
    description = teamsSection
      ? 'Os melhores jogadores da história de cada clube, reunidos numa seção própria.'
      : local
        ? `Só rankings de ${selectedCity}. Troque a cidade para explorar outro lugar.`
        : isAll
          ? 'Os mais votados que você ainda não avaliou aparecem primeiro.'
          : 'Abra um ranking, veja os itens e vote.';
  document.title = local
    ? `${isAll ? 'Rankings' : activeGroup} em ${selectedCity} — TOPO LOCAL`
    : teamsSection
      ? 'Times — rankings de futebol no TOPO'
      : `${activeGroup} — rankings no TOPO`;
  feed.innerHTML = `<section class="categoryLandingHead ${local ? 'localCatalogHead' : ''}"><div><span class="portalKicker">${kicker}</span><h1>${escapeHTML(heading)}</h1><p>${description}</p></div><div class="categoryLandingCount"><strong>${fmt(preferredCount)}</strong><span>${local ? 'na cidade' : `ranking${visible.length === 1 ? '' : 's'}`}</span></div></section>${footballCategoryTabsHTML()}<section class="categoryRankGrid">${categoryRankCardsHTML(shown)}</section>${remaining ? `<div class="categoryLoadMore"><button id="loadMoreRankings" type="button">${local ? `Ver mais rankings de ${escapeHTML(selectedCity)}` : `Mostrar mais ${fmt(Math.min(CATEGORY_PAGE_SIZE, remaining))} rankings`}</button><span>${fmt(shown.length)} de ${fmt(sorted.length)}</span></div>` : ''}${localCityExplorerHTML()}<div class="end">${local ? 'TOPO LOCAL' : 'TOPO'} · tudo vira ranking</div>`;
  bindCategoryControls();
  bindVotes();
}
function searchRelevance(r) {
  const needle = searchTerms(homeSearch).join(' '),
    title = searchTerms(r.q).join(' '),
    category = topoLocal.isLocalRanking(r)
      ? `${r.cat} ${topoLocal.groupForRanking(r)} TOPO LOCAL`
      : `${r.cat} ${groupOf(r)} TOPO`,
    items = r.searchText || (r.opts || []).map((o) => o.label).join(' ');
  if (title.startsWith(needle)) return 4;
  if (searchMatches(r.q, homeSearch)) return 3;
  if (searchMatches(category, homeSearch)) return 2;
  if (searchMatches(items, homeSearch)) return 1;
  return 0;
}
function renderSearchResults(visible) {
  const sorted = sortForExperience(
      visible,
      (a, b) =>
        searchRelevance(b) - searchRelevance(a) || Number(b.votes || 0) - Number(a.votes || 0),
    ),
    city = selectedCity || 'sua cidade';
  document.title = `Busca: ${homeSearch} — TOPO`;
  feed.innerHTML = `<section class="searchResultsHead"><div><span class="portalKicker">TOPO + TOPO LOCAL · ${escapeHTML(city)}</span><h1>Resultados para “${escapeHTML(homeSearch)}”</h1><p>${fmt(sorted.length)} ranking${sorted.length === 1 ? ' encontrado' : 's encontrados'} em todo o TOPO e nos rankings locais de ${escapeHTML(city)}. Abra um ranking para ver os itens e votar.</p></div><button id="clearHomeSearch" type="button">Limpar busca</button></section><section class="searchRankList">${sorted.map(categoryRankCardHTML).join('')}</section><div class="end">TOPO · tudo vira ranking</div>`;
  document.getElementById('clearHomeSearch')?.addEventListener('click', clearHomeSearch);
  bindVotes();
}
function duelHomeCalloutHTML() {
  return `<section class="duelHomeCallout"><div><span class="portalKicker">Modo Ganha, Fica</span><h2>Quem ganha, continua.</h2><p>O vencedor fica, soma pontos e enfrenta o próximo desafiante.</p></div><button type="button" data-start-random-duel>JOGAR</button></section>`;
}
function launchRandomDuel(excludeRankingId = '') {
  const ranking = randomDuelRanking(excludeRankingId);
  if (!ranking) {
    toast('Você já votou em quase tudo. Volte às flechas para rever suas escolhas.');
    return;
  }
  location.assign(`${rankingPath(ranking.id)}?modo=duelo#votar`);
}
function bindDuelLaunchers() {
  document.querySelectorAll('[data-start-random-duel]').forEach((button) => {
    button.onclick = () => launchRandomDuel(button.dataset.excludeRanking || '');
  });
}
renderHome = function () {
  const local = isLocalExperience(),
    visible = visibleRankings();
  document.title = local ? `TOPO LOCAL — rankings em ${selectedCity}` : 'TOPO — Tudo vira ranking';
  if (!visible.length) {
    const search = escapeHTML(homeSearch);
    feed.innerHTML = `<section class="portalEmpty"><span class="portalKicker">${local ? 'TOPO LOCAL' : 'Busca'}</span><h1>Nenhum ranking encontrado${search ? ' para “' + search + '”' : ''}.</h1><p>Tente outro termo ou volte a ver todos os temas.</p><button id="clearHomeSearch" type="button">Limpar busca</button></section>`;
    document.getElementById('clearHomeSearch')?.addEventListener('click', clearHomeSearch);
    return;
  }
  if (homeSearch) {
    renderSearchResults(visible);
    return;
  }
  if (local || !homePortal) {
    renderCategoryHome(visible);
    return;
  }
  const portalVisible = homeEligibleRankings(visible),
    hero = choosePortalHero(portalVisible),
    desktopLead = window.matchMedia?.('(min-width: 981px)').matches,
    secondaryHero = desktopLead
      ? portalVisible.find((ranking) => ranking.id !== hero.id && ranking.img) ||
        portalVisible.find((ranking) => ranking.id !== hero.id) ||
        null
      : null,
    used = new Set([hero.id, secondaryHero?.id].filter(Boolean)),
    disputed = sortForExperience(
      portalVisible.filter((r) => r.opts?.length > 1),
      (a, b) => topGap(a) - topGap(b) || Number(b.votes || 0) - Number(a.votes || 0),
    ).slice(0, 5),
    remaining = portalVisible.filter((r) => !used.has(r.id)),
    forYou = remaining.slice(0, 8),
    storySource = remaining.slice(8).length
      ? remaining.slice(8)
      : portalVisible.filter((r) => r.id !== hero.id),
    stories = storySource.slice(0, 8),
    more = storySource.slice(8, 14);
  feed.innerHTML = `${popHomeLeadHTML(hero, secondaryHero)}${portalTrendingHTML(portalVisible, 'Em alta')}<section class="popHomeSection" id="para-voce"><div class="portalSectionHead"><div><span>MAIS PARA DESCOBRIR</span><h2>Mais rankings</h2></div><button class="shuffleBtn portalShuffle" onclick="reshuffle()">↻ mudar seleção</button></div><section class="categoryRankGrid popHomeGrid">${forYou.map(categoryRankCardHTML).join('')}</section></section>${duelHomeCalloutHTML()}${popLocalCalloutHTML()}<div class="portalSectionHead"><div><span>ACABARAM DE CHEGAR</span><h2>Novos rankings</h2></div><button class="shuffleBtn portalShuffle" onclick="reshuffle()">↻ embaralhar</button></div><section class="portalNewsLayout"><div class="portalStoryFeed">${stories.map(portalStoryHTML).join('')}</div><aside>${portalListHTML('Mais polêmicos', disputed, 'disputed')}</aside></section>${more.length ? `<section class="portalMore"><div class="portalPanelTitle">Mais para explorar</div><div class="portalMoreGrid">${more.map(portalSideStoryHTML).join('')}</div></section>` : ''}<div class="end">TOPO · tudo vira ranking</div>`;
  feed.querySelector('.end')?.insertAdjacentHTML('beforebegin', portalIdeaCalloutHTML());
  bindVotes();
};
function editorialFor(id) {
  return (
    editorial[id] || {
      about:
        'Este tema reúne histórias, referências e preferências que mudam bastante de pessoa para pessoa.',
      facts: [
        'Rankings mudam com os votos e podem revelar preferências inesperadas.',
        'Novas leituras sobre o tema podem mudar bastante a disputa ao longo do tempo.',
      ],
      related: [],
    }
  );
}
const relatedStopWords = new Set([
  'melhor',
  'melhores',
  'maior',
  'maiores',
  'mais',
  'menos',
  'todos',
  'todas',
  'todo',
  'toda',
  'mundo',
  'brasil',
  'brasileiro',
  'brasileira',
  'brasileiros',
  'brasileiras',
  'tempo',
  'historia',
  'gostoso',
  'gostosa',
  'gostosos',
  'gostosas',
  'incrivel',
  'incriveis',
  'irresistivel',
  'irresistiveis',
]);
const strongRelatedWords = new Set([
  'sushi',
  'pizza',
  'pizzarias',
  'padarias',
  'cafes',
  'cafe',
  'hoteis',
  'hotel',
  'restaurantes',
  'restaurante',
  'hamburguer',
  'hamburgueres',
  'vegano',
  'veganos',
  'futebol',
  'filmes',
  'cinema',
  'bandas',
  'musica',
  'musicas',
  'jogos',
  'videogames',
  'moda',
  'plantas',
  'animais',
]);
function relatedTokens(r) {
  return new Set(
    foldText(`${r.q} ${r.cat}`)
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 3 && !relatedStopWords.has(word)),
  );
}
function relatedPlace(r) {
  const text = foldText(`${r.q} ${r.cat}`);
  if (text.includes('florianopolis') || text.includes('floripa')) return 'florianopolis';
  if (text.includes('sao paulo')) return 'sao-paulo';
  if (text.includes('rio de janeiro')) return 'rio-de-janeiro';
  if (text.includes('balneario camboriu')) return 'balneario-camboriu';
  return '';
}
function relatedScore(r, candidate, explicitIds) {
  let score = 0;
  if (r.cat === candidate.cat) score += 18;
  if (groupOf(r) === groupOf(candidate)) score += 12;
  const place = relatedPlace(r);
  if (place && place === relatedPlace(candidate)) score += 22;
  const candidateTokens = relatedTokens(candidate);
  for (const word of relatedTokens(r)) {
    if (candidateTokens.has(word)) score += strongRelatedWords.has(word) ? 20 : 8;
  }
  const explicitIndex = explicitIds.indexOf(candidate.id);
  if (explicitIndex >= 0) score += Math.max(2, 8 - explicitIndex * 2);
  return score;
}
function rankingsInSameExperience(r) {
  const local = topoLocal.isLocalRanking(r);
  if (!local) return rankings.filter((candidate) => !topoLocal.isLocalRanking(candidate));
  const city = topoLocal.cityForRanking(r);
  return rankings.filter(
    (candidate) => topoLocal.isLocalRanking(candidate) && topoLocal.cityMatches(candidate, city),
  );
}
function relatedFor(r) {
  const explicitIds = editorialFor(r.id).related || [],
    scored = rankingsInSameExperience(r)
      .filter((candidate) => candidate.id !== r.id && !isClubPlayerRanking(candidate))
      .map((candidate) => ({
        candidate,
        score: relatedScore(r, candidate, explicitIds),
        unvoted: myVoteCount(candidate) === 0,
      }))
      .filter((item) => item.score > 0)
      .sort(
        (a, b) =>
          Number(b.unvoted) - Number(a.unvoted) ||
          b.score - a.score ||
          Number(b.candidate.votes || 0) - Number(a.candidate.votes || 0),
      );
  return scored.slice(0, 3).map((item) => item.candidate);
}
function nextRankingFor(r) {
  const sequence = [...rankingsInSameExperience(r)].sort(rankingSequenceCompare),
    currentGroup = experienceGroupOf(r),
    currentGroupRankings = sequence.filter(
      (candidate) => experienceGroupOf(candidate) === currentGroup,
    ),
    currentIndex = currentGroupRankings.findIndex((candidate) => candidate.id === r.id),
    eligible = (candidate) =>
      candidate.id !== r.id &&
      !isClubPlayerRanking(candidate) &&
      rankingNeedsParticipation(candidate),
    laterInCurrentGroup = currentGroupRankings.slice(currentIndex + 1).filter(eligible);
  if (laterInCurrentGroup.length) return laterInCurrentGroup[0];

  const configuredGroups = experienceGroupNames().filter((group) => group !== 'Todos'),
    discoveredGroups = [...new Set(sequence.map(experienceGroupOf))],
    groups = [
      ...configuredGroups,
      ...discoveredGroups.filter((group) => !configuredGroups.includes(group)),
    ],
    currentGroupIndex = groups.indexOf(currentGroup),
    followingGroups =
      currentGroupIndex < 0
        ? groups
        : [...groups.slice(currentGroupIndex + 1), ...groups.slice(0, currentGroupIndex)];
  for (const group of followingGroups) {
    const next = sequence.find(
      (candidate) => experienceGroupOf(candidate) === group && eligible(candidate),
    );
    if (next) return next;
  }

  return (
    currentGroupRankings.slice(0, Math.max(0, currentIndex)).find(eligible) ||
    randomGeneralRankingFor(r)
  );
}
function randomGeneralRankingFor(r) {
  if (!topoLocal.isLocalRanking(r)) return null;
  const pool = rankings.filter(
    (candidate) =>
      !candidate.vip &&
      !topoLocal.isLocalRanking(candidate) &&
      !isClubPlayerRanking(candidate) &&
      rankingNeedsParticipation(candidate),
  );
  return pool[Math.floor(Math.random() * pool.length)] || null;
}
function randomRankingFor(r) {
  const pool = rankingsInSameExperience(r).filter(
    (candidate) =>
      candidate.id !== r.id &&
      !isClubPlayerRanking(candidate) &&
      rankingNeedsParticipation(candidate),
  );
  return pool[Math.floor(Math.random() * pool.length)] || randomGeneralRankingFor(r);
}
function relatedCardsHTML(rels) {
  return rels
    .map(
      (x) =>
        `<a class="relatedCard" href="${rankingPath(x.id)}"><div class="relatedThumb">${x.img ? `<img data-ranking-image src="${escapeHTML(x.img)}" alt="" loading="lazy" decoding="async">` : '<span class="portalImageFallback">TOPO</span>'}</div><div><div class="relatedCat">${escapeHTML(categoryLabel(x))}</div><div class="relatedTitle">${escapeHTML(x.q)}</div></div></a>`,
    )
    .join('');
}
function rankingFlowActionsHTML(r, extraClass = '') {
  const next = nextRankingFor(r),
    random = randomRankingFor(r),
    sameCategory = next && experienceGroupOf(next) === experienceGroupOf(r),
    leavesLocal = next && topoLocal.isLocalRanking(r) && !topoLocal.isLocalRanking(next),
    nextHint = next
      ? leavesLocal
        ? `${categoryLabel(next)} · outro ranking do TOPO`
        : sameCategory
          ? `${categoryLabel(next)} · ainda não concluído`
          : `${categoryLabel(next)} · próxima categoria`
      : 'Continuar descobrindo',
    randomHint = 'Uma surpresa ainda não concluída',
    className = `rankingFlowActions${extraClass ? ` ${extraClass}` : ''}`;
  return `<div class="${className}">${next ? `<a class="rankingFlowButton primary" href="${rankingPath(next.id)}"><span><strong>Próximo ranking</strong><small>${escapeHTML(nextHint)}</small></span><b>→</b></a>` : ''}${random ? `<a class="rankingFlowButton" href="${rankingPath(random.id)}"><span><strong>Ranking aleatório</strong><small>${randomHint}</small></span><b>↻</b></a>` : ''}</div>`;
}
function rankingContinuationHTML(r) {
  if (r.vip) return '';
  const rels = relatedFor(r);
  return `<section class="rankingContinuation"><div class="rankingContinuationHead"><div><div class="sectionLabel">Continue votando</div><h2>Rankings relacionados</h2></div><span>sem voltar para a Home</span></div><div class="relatedGrid">${relatedCardsHTML(rels)}</div>${rankingFlowActionsHTML(r)}</section>`;
}
function editorialHTML(r) {
  if (r.vip) return '';
  const e = editorialFor(r.id);
  return `<section class="contentSection"><div class="sectionLabel">Sobre o tema</div><p class="aboutText">${e.about}</p></section><section class="contentSection"><div class="sectionLabel">2 curiosidades</div><div class="curiosGrid">${e.facts
    .slice(0, 2)
    .map(
      (f, i) =>
        `<div class="curioCard"><div class="curioNum">0${i + 1}</div><div class="curioText">${f}</div></div>`,
    )
    .join('')}</div></section>`;
}
function commentsShellHTML() {
  return `<section class="commentsSection" id="commentsSection"><div class="commentsTitle">Deixe um comentário</div><p class="commentsIntro">Escolha uma opção e conte o que você pensa. Um comentário por pessoa, com até 200 caracteres — você pode editar depois.</p><div class="commentsLoading">carregando comentários…</div></section>`;
}
function commentCardHTML(comment) {
  const date = new Date(comment.createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
  return `<article class="commentCard"><div class="commentMeta"><span class="commentName">${escapeHTML(comment.name)}</span><span class="commentDate">${escapeHTML(date)}${comment.edited ? ' · editado' : ''}</span></div><div class="commentOption">Sobre: ${escapeHTML(comment.option)}</div><p class="commentBody">${escapeHTML(comment.body)}</p></article>`;
}
function renderComments(r, data) {
  const section = document.getElementById('commentsSection');
  if (!section || internalId() !== r.id) return;
  const recent = Array.isArray(data.comments) ? data.comments : [],
    mine = data.mine || null,
    total = Number(data.total || 0);
  const recentHTML = recent.length
    ? recent.map(commentCardHTML).join('')
    : '<div class="commentsEmpty">Ainda não há comentários. O primeiro pode ser seu.</div>';
  const formHTML = viewer.registered
    ? `<form class="commentForm" id="commentForm"><div class="commentFormTitle">${mine ? 'Edite seu comentário' : 'Seu comentário'}</div><label class="commentField"><span>Sobre qual opção você quer comentar?</span><select id="commentOption" required>${r.opts.map((o) => `<option value="${o.id}" ${Number(mine?.optionId) === Number(o.id) ? 'selected' : ''}>${escapeHTML(o.label)}</option>`).join('')}</select></label><label class="commentField"><span>Comentário</span><textarea id="commentBody" rows="3" required aria-describedby="commentCounter">${escapeHTML(mine?.body || '')}</textarea></label><div class="commentFormFoot"><span class="commentCounter" id="commentCounter">0/200</span><button class="commentSubmit" type="submit">${mine ? 'Salvar edição' : 'Publicar'}</button></div><div class="commentStatus" id="commentStatus" role="status"></div></form>`
    : `<div class="commentsLogin"><span>Para deixar um comentário, entre ou crie uma conta.</span><a href="/entrar?voltar=${encodeURIComponent(rankingPath(r.id))}">Entrar para comentar</a></div>`;
  const allCommentsHTML =
    total > 2
      ? `<button class="viewAllComments" id="viewAllComments" type="button">Ver todos os ${fmt(total)} comentários</button>`
      : '';
  section.innerHTML = `<div class="commentsTitle">Deixe um comentário</div><p class="commentsIntro">Escolha uma opção e conte o que você pensa. Um comentário por pessoa, com até 200 caracteres — você pode editar depois.</p>${formHTML}<div class="commentsListHead"><span>Os 2 mais recentes</span><span>${fmt(total)} no total</span></div><div class="commentsList">${recentHTML}</div>${allCommentsHTML}`;
  if (viewer.registered) bindCommentForm(r, mine);
  document
    .getElementById('viewAllComments')
    ?.addEventListener('click', () => showAllComments(r, total));
}
function bindCommentForm(r, mine) {
  const form = document.getElementById('commentForm'),
    textarea = document.getElementById('commentBody'),
    counter = document.getElementById('commentCounter');
  const updateCounter = () => {
    const chars = [...textarea.value];
    if (chars.length > 200) textarea.value = chars.slice(0, 200).join('');
    counter.textContent = `${[...textarea.value].length}/200`;
  };
  textarea.addEventListener('input', updateCounter);
  updateCounter();
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const button = form.querySelector('button[type=submit]'),
      status = document.getElementById('commentStatus'),
      payload = {
        ranking_id: r.id,
        option_id: Number(document.getElementById('commentOption').value),
        body: textarea.value,
      };
    button.disabled = true;
    status.textContent = '';
    try {
      const res = await fetch('/api?action=comments', {
          method: mine ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        }),
        result = await res.json();
      if (res.status === 401) {
        location.href = `/entrar?modo=entrar&voltar=${encodeURIComponent(rankingPath(r.id))}`;
        return;
      }
      if (!res.ok) throw result;
      toast(mine ? 'Comentário atualizado' : 'Comentário publicado');
      await loadComments(r);
    } catch (error) {
      status.textContent =
        error?.error === 'comment_exists'
          ? 'Você já comentou aqui. Recarregue a página para editar.'
          : error?.error === 'invalid_comment'
            ? 'Escreva entre 1 e 200 caracteres.'
            : 'Não consegui salvar. Tente novamente.';
    } finally {
      button.disabled = false;
    }
  };
}
async function loadComments(r) {
  try {
    const res = await fetch(`/api?action=comments&ranking_id=${encodeURIComponent(r.id)}`, {
        cache: 'no-store',
      }),
      data = await res.json();
    if (!res.ok) throw data;
    renderComments(r, data);
  } catch {
    const section = document.getElementById('commentsSection');
    if (section)
      section.innerHTML = `<div class="commentsTitle">Deixe um comentário</div><div class="commentsEmpty">Não consegui carregar os comentários. <button class="commentsRetry" type="button">Tentar de novo</button></div>`;
    document.querySelector('.commentsRetry')?.addEventListener('click', () => loadComments(r));
  }
}
function showAllComments(r, total) {
  showModal(
    `<div class="allCommentsModal"><div class="allCommentsHead"><div><div class="modalKicker">Comentários</div><div class="modalTitle">Todos os comentários</div><div class="modalText">${fmt(total)} comentário${total === 1 ? '' : 's'} neste ranking.</div></div><button class="allCommentsClose" type="button" data-close aria-label="Fechar">×</button></div><div class="allCommentsList" id="allCommentsList"><div class="commentsLoading">carregando…</div></div><div class="allCommentsMore" id="allCommentsMore"></div></div>`,
  );
  loadAllCommentsPage(r, 0, false);
}
async function loadAllCommentsPage(r, page, append) {
  const list = document.getElementById('allCommentsList'),
    more = document.getElementById('allCommentsMore');
  if (!list || !more) return;
  more.innerHTML = '<span class="commentsLoading">carregando…</span>';
  try {
    const res = await fetch(
        `/api?action=comments&view=all&page=${page}&ranking_id=${encodeURIComponent(r.id)}`,
        { cache: 'no-store' },
      ),
      data = await res.json();
    if (!res.ok) throw data;
    const html = data.comments.length
      ? data.comments.map(commentCardHTML).join('')
      : '<div class="commentsEmpty">Ainda não há comentários.</div>';
    if (append) list.insertAdjacentHTML('beforeend', html);
    else list.innerHTML = html;
    more.innerHTML = data.hasMore
      ? '<button class="viewAllComments" id="loadMoreComments" type="button">Carregar mais</button>'
      : '';
    document
      .getElementById('loadMoreComments')
      ?.addEventListener('click', () => loadAllCommentsPage(r, page + 1, true));
  } catch {
    more.innerHTML =
      '<button class="commentsRetry" id="retryAllComments" type="button">Tentar de novo</button>';
    document
      .getElementById('retryAllComments')
      ?.addEventListener('click', () => loadAllCommentsPage(r, page, append));
  }
}
function rankingVoteModeHTML(r, votingOpen = true) {
  if (!votingOpen) return '';
  const mode = activeRankingVoteMode();
  return `<nav class="rankingVoteModes" aria-label="Escolher forma de votar" role="tablist"><button class="${mode === 'duelo' ? 'active' : ''}" type="button" role="tab" data-ranking-vote-mode="duelo" aria-selected="${mode === 'duelo'}" aria-controls="rankingVotingPanel"><span>→</span> GANHA, FICA</button><button class="${mode === 'livre' ? 'active' : ''}" type="button" role="tab" data-ranking-vote-mode="livre" aria-selected="${mode === 'livre'}" aria-controls="rankingVotingPanel"><span>↑↓</span> VOTO LIVRE</button></nav>`;
}
function votingModeStateFor(r) {
  return rankingVotingState?.rankingId === r.id && rankingVotingState.loaded
    ? rankingVotingState
    : null;
}
function votingModesLoadingHTML() {
  return `<section class="rankingModeLoading"><span class="loadingSpinner" aria-hidden="true"></span><strong>Carregando Ganha, Fica…</strong></section>`;
}
function votingModesErrorHTML() {
  return `<section class="rankingModeLoading error"><strong>Não consegui carregar o Ganha, Fica.</strong><button type="button" data-voting-modes-retry>TENTAR DE NOVO</button></section>`;
}
function duelChoiceHTML(option) {
  const incumbent = option.role === 'incumbent',
    challenger = option.role === 'challenger';
  return `<button class="duelChoice ${incumbent ? 'incumbent' : challenger ? 'challenger' : ''}" type="button" data-duel-choice data-id="${option.optionId}" aria-label="Escolher ${escapeHTML(option.label)} para continuar"><strong>${escapeHTML(option.label)}</strong></button>`;
}
function duelShareButtonHTML(pair) {
  if (pair.length !== 2) return '';
  return `<div class="duelShareBar"><button class="duelShareButton" type="button" data-share-duel>${nativeShareIconHTML()}<span>COMPARTILHAR ESTE DUELO</span></button></div>`;
}
function rankingDuelHTML(r) {
  const state = votingModeStateFor(r);
  if (!state) {
    return rankingVotingState?.rankingId === r.id && rankingVotingState.error
      ? votingModesErrorHTML()
      : votingModesLoadingHTML();
  }
  const pair = state.duel.pair || [],
    champion = state.duel.champion,
    progress = `${fmt(state.duel.seenOptions)} de ${fmt(state.duel.totalOptions)} opções vistas`,
    nextActions = rankingFlowActionsHTML(r, 'duelNextActions'),
    duelCard =
      pair.length === 2
        ? `<section class="rankingDuel" data-duel-pair><div class="duelChoices">${duelChoiceHTML(pair[0])}<span class="duelVersus" aria-hidden="true">OU</span>${duelChoiceHTML(pair[1])}</div><div class="duelFooter"><button type="button" data-duel-skip>${champion ? 'TROCAR DESAFIANTE' : 'PULAR'} · NÃO CONHEÇO</button><span>${progress}</span></div>${duelShareButtonHTML(pair)}${nextActions}</section>`
        : champion
          ? `<section class="rankingDuel rankingDuelComplete"><span class="duelEyebrow">Partida concluída</span><h2>Seu vencedor: ${escapeHTML(champion.label)}</h2><div class="duelEndActions"><button type="button" data-duel-restart>REFAZER DUELO</button></div>${nextActions}<div class="duelResultMeta"><span>O resultado foi guardado no Meu Topo.</span><a href="${viewer.registered ? '/vip' : `/entrar?voltar=${encodeURIComponent('/vip')}`}">${viewer.registered ? 'Ver no Meu Topo →' : 'Entrar para guardar →'}</a></div></section>`
          : `<section class="rankingDuel rankingDuelComplete"><span class="duelEyebrow">Partida concluída</span><h2>Nenhuma opção foi escolhida.</h2><div class="duelEndActions"><button type="button" data-duel-restart>REFAZER DUELO</button></div>${nextActions}</section>`;
  return duelCard;
}

function syncRankingContinuationFlow() {
  const flow = document.querySelector('.rankingContinuation > .rankingFlowActions');
  if (flow) flow.hidden = activeRankingVoteMode() === 'duelo';
}
function rankingFreeVoteHTML(r, votingOpen = true) {
  const visibleLimit = Math.min(visibleOptionCount, r.opts.length),
    visibleOptions = r.opts.slice(0, visibleLimit),
    promotionOptionId = rankingPromotionOptionId(),
    footerVoteText = r.vip
      ? votingOpen
        ? 'Entre com a senha e vote sem cadastro.'
        : 'A votação está encerrada.'
      : `Até ${Math.min(r.opts.length, viewer.rankingLimit || 20)} votos por ranking.`;
  return `<div class="rankingFreeIntro"><strong>Agora é com você!</strong><span>↑ soma 1 · ↓ tira 1 · Duelo do Topo conta mais</span></div><div class="rankingResultHead"><span>Ranking oficial</span><strong>Top ${visibleLimit}</strong></div><div class="options">${visibleOptions.map((o, i) => rankingVoteRowHTML(r, o, i, Number(o.id) === promotionOptionId ? 'promotionFocus' : '', votingOpen)).join('')}</div><div class="rankFoot"><span>${footerVoteText}</span><span>${viewer.registered && votingOpen ? 'Vote normalmente · 2× reforça' : votingOpen ? '↑ sobe · ↓ desce' : 'resultado preservado'}</span></div>${allItemsExplorerHTML(r)}`;
}
function rankingVotePanelHTML(r, votingOpen = true) {
  if (!votingOpen) return rankingFreeVoteHTML(r, false);
  const mode = activeRankingVoteMode();
  if (mode === 'duelo') return rankingDuelHTML(r);
  return rankingFreeVoteHTML(r, true);
}
function updateVoteModeUrl(mode) {
  const url = new URL(location.href);
  if (mode === 'duelo') url.searchParams.delete('modo');
  else url.searchParams.set('modo', mode);
  history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
}
function applyVotingModeResult(r, result) {
  const scoreUpdate = result.scoreUpdate,
    updatedOption = scoreUpdate
      ? r.opts.find((option) => Number(option.id) === Number(scoreUpdate.optionId))
      : null;
  if (updatedOption && Number.isFinite(Number(scoreUpdate.score))) {
    updatedOption.score = Number(scoreUpdate.score);
    r.opts.sort((a, b) => b.score - a.score || a.originalPosition - b.originalPosition);
  }
  r.duelCompleted = result.duel?.completed === true;
  rankingVotingState = {
    ...result,
    rankingId: r.id,
    loaded: true,
    loading: false,
    error: '',
  };
  if (result.viewer) {
    viewer = result.viewer;
    renderAccount();
  }
  renderRankingVoteExperience(r, false);
}
async function loadRankingVotingModes(r, force = false) {
  if (
    !force &&
    rankingVotingState?.rankingId === r.id &&
    (rankingVotingState.loaded || rankingVotingState.loading)
  )
    return;
  const requestId = ++rankingVotingRequest;
  rankingVotingState = { rankingId: r.id, loaded: false, loading: true, error: '' };
  try {
    const params = new URLSearchParams({
        action: 'ranking-vote-modes',
        ranking_id: r.id,
        device_id: deviceId,
      }),
      startOptionIds = sharedDuelStartOptionIds();
    if (startOptionIds.length === 2) params.set('start_option_ids', startOptionIds.join('-'));
    const response = await fetch(`/duel-bottom-api?${params}`, { cache: 'no-store' }),
      result = await response.json().catch(() => ({}));
    if (requestId !== rankingVotingRequest || internalId() !== r.id) return;
    if (response.status === 409 && result.error === 'device_rekey_required') {
      rotateDeviceId();
      rankingVotingState = null;
      await load();
      return;
    }
    if (response.status === 403 && result.error === 'vip_password_required') {
      renderVipGate({ id: r.id, q: r.q, img: r.img });
      return;
    }
    if (!response.ok) throw result;
    applyVotingModeResult(r, result);
  } catch {
    if (requestId !== rankingVotingRequest) return;
    rankingVotingState = {
      rankingId: r.id,
      loaded: false,
      loading: false,
      error: 'load_failed',
    };
    renderRankingVoteExperience(r, false);
  }
}
function handleVotingModeBlock(response, result, r) {
  if (response.status === 403 && result.error === 'registration_required') {
    if (result.viewer) viewer = result.viewer;
    const reason = result.reason || viewer.anonymousLimitReason || 'votes';
    if (reason === 'votes' && !result.viewer) {
      viewer.anonymousUsed = viewer.anonymousLimit || DEFAULT_ANONYMOUS_LIMIT;
      viewer.anonymousAccessExhausted = true;
    } else if (reason === 'duels' && !result.viewer) {
      viewer.anonymousDuelsUsed = viewer.anonymousDuelLimit || DEFAULT_ANONYMOUS_DUEL_LIMIT;
      viewer.anonymousAccessExhausted = true;
    }
    renderAccount();
    showRegistrationWall(reason);
    return true;
  }
  if (response.status === 403 && result.error === 'account_required_on_this_device') {
    viewer.votingRequiresAccount = true;
    renderAccount();
    showAccountRequired();
    return true;
  }
  if (response.status === 403 && result.error === 'vip_password_required') {
    renderVipGate({ id: r.id, q: r.q, img: r.img });
    return true;
  }
  if (response.status === 409 && result.error === 'ranking_voting_closed') {
    toast('A votação deste ranking foi encerrada');
    return true;
  }
  if (response.status === 409 && result.error === 'device_rekey_required') {
    rotateDeviceId();
    rankingVotingState = null;
    void load();
    return true;
  }
  return false;
}
async function submitDuelResult(button, r, winnerOptionId = null) {
  const pair = votingModeStateFor(r)?.duel?.pair || [],
    optionIds = pair.map((option) => Number(option.optionId));
  if (optionIds.length !== 2) return;
  const controls = [...document.querySelectorAll('[data-duel-choice], [data-duel-skip]')];
  controls.forEach((control) => (control.disabled = true));
  try {
    const payload = {
        device_id: deviceId,
        ranking_id: r.id,
        option_ids: optionIds,
        winner_option_id: winnerOptionId,
        referral_token: incomingShareReferralToken(r.id),
      },
      startOptionIds = sharedDuelStartOptionIds();
    if (startOptionIds.length === 2) payload.start_option_ids = startOptionIds;
    const response = await fetch('/duel-bottom-api?action=ranking-duel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      result = await response.json().catch(() => ({}));
    if (handleVotingModeBlock(response, result, r)) return;
    if (response.status === 409 && result.error === 'duel_state_changed') {
      applyVotingModeResult(r, result);
      return;
    }
    if (!response.ok) throw result;
    applyVotingModeResult(r, result);
  } catch {
    controls.forEach((control) => (control.disabled = false));
    toast('Não consegui registrar esta partida');
  }
}
async function restartDuel(button, r) {
  button.disabled = true;
  const label = button.textContent;
  button.textContent = 'REINICIANDO…';
  try {
    const response = await fetch('/api?action=ranking-duel-reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, ranking_id: r.id }),
      }),
      result = await response.json().catch(() => ({}));
    if (handleVotingModeBlock(response, result, r)) return;
    if (!response.ok) throw result;
    rankingVotingState = null;
    await load();
  } catch {
    button.disabled = false;
    button.textContent = label;
    toast('Não consegui reiniciar o duelo');
  }
}
function chooseDuelOption(button, r) {
  return submitDuelResult(button, r, Number(button.dataset.id));
}
function sharedDuelURL(r, pair) {
  const url = new URL(rankingPath(r.id), location.origin);
  url.searchParams.set('duelo', pair.map((option) => Number(option.optionId)).join('-'));
  url.hash = 'votar';
  return url.toString();
}
async function shareCurrentDuel(r) {
  const pair = votingModeStateFor(r)?.duel?.pair || [];
  if (pair.length !== 2) return;
  const url = await trackedRankingShareURL(r.id, sharedDuelURL(r, pair), 'duel'),
    versus = `${pair[0].label} × ${pair[1].label}`,
    data = {
      title: `${versus} — Duelo do Topo`,
      text: `🔥 Desempata isso pra mim:\n${versus}\nQuem ganha este duelo no TOPO?`,
      url,
    };
  if (navigator.share) {
    try {
      await navigator.share(data);
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
    await navigator.clipboard.writeText(url);
    toast('Duelo copiado. Agora é só enviar.');
  } catch {
    toast('Não consegui abrir o compartilhamento neste navegador.');
  }
}
function bindDuelMode(r) {
  document
    .querySelectorAll('[data-duel-choice]')
    .forEach((button) => (button.onclick = () => chooseDuelOption(button, r)));
  const skip = document.querySelector('[data-duel-skip]');
  if (skip) skip.onclick = () => submitDuelResult(skip, r, null);
  const share = document.querySelector('[data-share-duel]');
  if (share) share.onclick = () => shareCurrentDuel(r);
  const restart = document.querySelector('[data-duel-restart]');
  if (restart) restart.onclick = () => restartDuel(restart, r);
  bindDuelLaunchers();
}
function bindRankingVoteModes(r) {
  document.querySelectorAll('[data-ranking-vote-mode]').forEach((button) => {
    button.onclick = () => {
      const nextMode = button.dataset.rankingVoteMode;
      if (nextMode === activeRankingVoteMode()) return;
      updateVoteModeUrl(nextMode);
      renderRankingVoteExperience(r);
      document.querySelector(`[data-ranking-vote-mode="${nextMode}"]`)?.focus();
    };
  });
}
function renderRankingVoteExperience(r, loadState = true) {
  const panel = document.getElementById('rankingVotingPanel');
  if (!panel) return;
  document.querySelectorAll('[data-ranking-vote-mode]').forEach((button) => {
    const active = button.dataset.rankingVoteMode === activeRankingVoteMode();
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  panel.innerHTML = rankingVotePanelHTML(r, true);
  syncRankingContinuationFlow();
  bindRankingVoteModes(r);
  if (activeRankingVoteMode() === 'duelo') bindDuelMode(r);
  else {
    bindVotes();
    bindAllItems(r);
  }
  document.querySelector('[data-voting-modes-retry]')?.addEventListener('click', () => {
    loadRankingVotingModes(r, true);
  });
  if (loadState && activeRankingVoteMode() !== 'livre') void loadRankingVotingModes(r);
}
function normalizedGooglePlaceOptionLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
function googlePlaceProfileForOption(r, o) {
  const optionLabel = normalizedGooglePlaceOptionLabel(o?.label);
  return (
    Object.values(googlePlaceProfiles).find(
      (profile) => profile.rankingId === r?.id && profile.optionLabels.includes(optionLabel),
    ) || null
  );
}
function rankingVoteOptionNameHTML(r, o) {
  const label = escapeHTML(o.label),
    newBadge = o.isNew ? '<span class="vipNewOption">NOVO</span>' : '',
    profile = googlePlaceProfileForOption(r, o);
  if (!profile) return `<div class="name">${label}${newBadge}</div>`;
  return `<div class="name"><button class="googlePlaceTrigger" type="button" data-google-place="${profile.id}" aria-label="Ver nota e avaliações de ${label} no Google Maps"><span>${label}</span><small>Nota no Google Maps ↗</small></button>${newBadge}</div>`;
}
function openGooglePlaceProfile(profileId) {
  const profile = googlePlaceProfiles[profileId];
  if (!profile) return;
  showModal(
    `<section class="googlePlaceModal" role="dialog" aria-modal="true" aria-labelledby="googlePlaceTitle"><header class="googlePlaceModalHead"><div><div class="modalKicker">Google Maps</div><div class="modalTitle" id="googlePlaceTitle">${escapeHTML(profile.displayName)}</div><p>Perfil oficial do estabelecimento.</p></div><button class="googlePlaceClose" type="button" data-close aria-label="Fechar">×</button></header><div class="googlePlaceRatingCard" aria-label="Nota ${escapeHTML(profile.rating)} de 5, com ${profile.reviewCount} avaliações no Google Maps"><div class="googlePlaceRatingScore"><strong>${escapeHTML(profile.rating)}</strong><span aria-hidden="true">★</span><small>de 5</small></div><div class="googlePlaceRatingDetails"><strong>${profile.reviewCount} avaliações</strong><span>Google Maps · conferido em ${escapeHTML(profile.ratingCheckedAt)}</span></div><a class="googlePlaceRatingLink" href="${escapeHTML(profile.mapUrl)}" target="_blank" rel="noopener noreferrer">VER AVALIAÇÕES ↗</a></div><iframe class="googlePlaceFrame" src="${escapeHTML(profile.embedUrl)}" title="Google Maps — ${escapeHTML(profile.displayName)}" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe><footer class="googlePlaceModalFoot"><span>A nota pode mudar; confira o valor mais recente no perfil oficial.</span><div class="modalActions googlePlaceModalActions"><button type="button" data-close>VOLTAR AO RANKING</button><a class="main" href="${escapeHTML(profile.mapUrl)}" target="_blank" rel="noopener noreferrer">ABRIR NO GOOGLE MAPS</a></div></footer></section>`,
  );
  document.querySelector('#modalLayer .modalCard')?.classList.add('googlePlaceModalCard');
}
function bindGooglePlaceProfiles() {
  document.querySelectorAll('[data-google-place]').forEach((button) => {
    button.onclick = () => openGooglePlaceProfile(button.dataset.googlePlace);
  });
}
function rankingVoteRowHTML(r, o, i, extraClass = '', votingOpen = true) {
  const upSelected = Number(o.mine) === 1,
    downSelected = Number(o.mine) === -1,
    label = escapeHTML(o.label),
    disabled = votingOpen ? '' : 'disabled';
  return `<div class="option ${extraClass}" id="opcao-${o.id}" data-option-id="${o.id}" data-option-label="${label}"><div class="pos">${rankMark(i)}</div><div>${rankingVoteOptionNameHTML(r, o)}<div class="score">${pointCountText(o.score)} · ${i + 1}º lugar ${doubleVoteBadgeHTML(o)}</div></div><div class="actions"><button class="react up ${upSelected ? 'selected' : ''}" data-id="${o.id}" data-mine="${o.mine}" data-dir="1" aria-label="${upSelected ? 'Remover voto em' : 'Fazer'} ${label}${upSelected ? '' : ' subir'}" ${disabled}>↑</button>${votingOpen ? doubleVoteActionHTML(o, 1) : ''}<button class="react down ${downSelected ? 'selected' : ''}" data-id="${o.id}" data-mine="${o.mine}" data-dir="-1" aria-label="${downSelected ? 'Remover voto em' : 'Fazer'} ${label}${downSelected ? '' : ' descer'}" ${disabled}>↓</button>${votingOpen ? doubleVoteActionHTML(o, -1) : ''}</div></div>`;
}
function allItemsExplorerHTML(r) {
  const total = r.opts.length;
  const shown = Math.min(visibleOptionCount, total);
  if (shown >= total) return '';
  const next = Math.min(10, total - shown);
  return `<section class="allItemsExplorer"><button class="allItemsToggle" id="allItemsToggle" type="button"><span><strong>Ver mais ${next}</strong><small>${shown} de ${total} opções abertas</small></span><b aria-hidden="true">+</b></button></section>`;
}
function bindAllItems(r) {
  const toggle = document.getElementById('allItemsToggle');
  if (!toggle) return;
  toggle.onclick = () => {
    visibleOptionCount = Math.min(r.opts.length, visibleOptionCount + 10);
    renderInternal();
  };
}
function suggestionErrorText(error) {
  return (
    {
      authentication_required: 'Entre na sua conta para sugerir.',
      invalid_option_suggestion: 'Escreva uma opção entre 2 e 80 caracteres.',
      option_already_exists: 'Essa opção já está no ranking.',
      suggestion_already_pending: 'Essa sugestão já está aguardando análise.',
      option_suggestion_limit: 'Você já enviou 3 sugestões nas últimas 24 horas.',
      invalid_ranking_suggestion: 'Escreva o nome ou a frase do ranking.',
      ranking_already_exists: 'Já existe um ranking com esse título.',
      ranking_suggestion_limit: 'Você já sugeriu um ranking nos últimos 7 dias.',
    }[error] || 'Não consegui enviar agora. Tente novamente.'
  );
}
function rankingOptionSuggestionHTML(r) {
  if (r.vipUserCreated) return '';
  if (!viewer.registered)
    return `<section class="rankingSuggestion"><span class="suggestionEyebrow">Faltou alguma coisa?</span><h3>Sugira uma opção</h3><p>Entre na sua conta para enviar. Depois da aprovação, ela aparece no final do ranking com zero pontos.</p><a href="/entrar?voltar=${encodeURIComponent(rankingPath(r.id))}">Entrar para sugerir</a></section>`;
  return `<section class="rankingSuggestion"><span class="suggestionEyebrow">Faltou alguma coisa?</span><h3>Sugira uma opção</h3><p>Ela será analisada antes de entrar no ranking.</p><form id="optionSuggestionForm"><label for="optionSuggestionLabel">Nome da opção</label><div><input id="optionSuggestionLabel" name="label" type="text" minlength="2" maxlength="80" autocomplete="off" placeholder="Ex.: uma opção que ficou de fora" required><button type="submit">Enviar</button></div><small>${viewer.isModerator ? 'Sugestões ilimitadas durante o teste.' : 'Até 3 sugestões por dia.'}</small><span class="suggestionFormStatus" id="optionSuggestionStatus" aria-live="polite"></span></form></section>`;
}
function bindRankingSuggestion(r) {
  const form = document.getElementById('optionSuggestionForm');
  if (!form) return;
  form.onsubmit = async (event) => {
    event.preventDefault();
    const input = document.getElementById('optionSuggestionLabel'),
      button = form.querySelector('button[type=submit]'),
      status = document.getElementById('optionSuggestionStatus'),
      label = input.value.trim();
    button.disabled = true;
    status.className = 'suggestionFormStatus';
    status.textContent = 'Enviando…';
    try {
      const response = await fetch('/api?action=suggestions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: 'option', rankingId: r.id, label }),
        }),
        result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        location.assign(`/entrar?voltar=${encodeURIComponent(rankingPath(r.id))}`);
        return;
      }
      if (!response.ok) throw result;
      input.value = '';
      status.classList.add('success');
      status.textContent = result.possibleDuplicate
        ? `Sugestão enviada. Pode ser parecida com “${result.possibleDuplicate.label}”; a moderação vai conferir.`
        : 'Sugestão enviada para análise.';
      toast('Sugestão enviada');
    } catch (error) {
      status.classList.add('error');
      status.textContent = suggestionErrorText(error?.error);
    } finally {
      button.disabled = false;
    }
  };
}

function moderatorRankingBarHTML(editing = false) {
  return `<aside class="rankingModeratorBar" aria-label="Ferramentas de moderação"><div><span>MODERAÇÃO</span><strong>${editing ? 'Editando este ranking' : 'Você pode corrigir este ranking aqui mesmo'}</strong></div>${
    editing
      ? '<span class="rankingModeratorEditing">Alterações privadas até salvar</span>'
      : '<button id="rankingEditStart" type="button">Editar ranking</button>'
  }</aside>`;
}

function beginRankingEdit(r) {
  if (!viewer.isModerator) return;
  rankingEditorState = {
    rankingId: r.id,
    originalVip: r.vip === true,
    originalImageUrl: r.img || null,
    imagePreview: r.img || '',
    imageMode: 'keep',
    imageData: '',
    imageUrl: String(r.img || '').startsWith('https://') ? r.img : '',
  };
  renderInternal();
}

function rankingEditorHTML(r, categoryPath) {
  const state = rankingEditorState,
    photo = state.imagePreview
      ? `<img id="rankingEditorImagePreview" src="${escapeHTML(state.imagePreview)}" alt="Prévia da foto de ${escapeHTML(r.q)}">`
      : '<span class="rankingEditorPhotoEmpty" id="rankingEditorImagePreview">Sem foto</span>',
    options = r.opts
      .map(
        (option, index) =>
          `<label class="rankingEditorOption"><span>${index + 1}</span><input data-ranking-editor-option data-id="${option.id}" type="text" minlength="2" maxlength="80" value="${escapeHTML(option.label)}" required></label>`,
      )
      .join('');
  return `<form class="rankingEditor" id="rankingEditorForm"><header class="rankingEditorHead"><div><span class="category"><a href="${categoryPath}">${escapeHTML(categoryLabel(r))}</a></span><h1>Editar ranking</h1><p>Altere somente o que precisa. A posição, os votos e o histórico das opções serão preservados.</p></div></header><label class="rankingEditorField rankingEditorTitleField"><span>Título do ranking</span><input id="rankingEditorTitle" type="text" minlength="8" maxlength="120" value="${escapeHTML(r.q)}" required></label><section class="rankingEditorPhoto"><div class="rankingEditorSectionHead"><div><span>FOTO</span><strong>Imagem de capa</strong></div><small>A prévia muda antes de publicar.</small></div><div class="rankingEditorPhotoPreview">${photo}</div><div class="rankingEditorPhotoActions"><button class="rankingEditorSuggestButton" id="rankingEditorSuggestPhotos" type="button">Buscar fotos que combinam</button><label class="rankingEditorFileButton">Escolher foto do aparelho<input id="rankingEditorFile" type="file" accept="image/jpeg,image/png,image/webp"></label><button id="rankingEditorKeepPhoto" type="button">Manter atual</button><button id="rankingEditorRemovePhoto" type="button">Remover foto</button></div><div class="rankingEditorSuggestions" id="rankingEditorSuggestions" aria-live="polite"></div><label class="rankingEditorField rankingEditorUrlField"><span>Ou cole o link de uma imagem</span><input id="rankingEditorImageUrl" type="url" inputmode="url" placeholder="https://..." value="${escapeHTML(state.imageUrl)}"><small>Se escolher um arquivo, ele terá prioridade sobre o link.</small></label></section><section class="rankingEditorVip"><div class="rankingEditorSectionHead"><div><span>ACESSO</span><strong>Meu Topo</strong></div><small>Uma senha exclusiva para este ranking</small></div><label class="rankingEditorVipToggle"><input id="rankingEditorVip" type="checkbox" ${r.vip ? 'checked' : ''}><span><strong>Colocar este ranking no Meu Topo</strong><small>Ele deixa de aparecer na Home, nas categorias, na busca e no Google.</small></span></label><label class="rankingEditorField rankingEditorVipPassword"><span>${r.vipHasPassword ? 'Trocar a senha' : 'Criar a senha'}</span><input id="rankingEditorVipPassword" type="password" minlength="4" maxlength="80" autocomplete="new-password" placeholder="${r.vipHasPassword ? 'Deixe vazio para manter a senha atual' : 'No mínimo 4 caracteres'}"><small>${r.vipHasPassword ? 'A senha atual nunca é exibida. Digite outra somente se quiser trocá-la.' : 'A senha não será salva em texto e não poderá ser recuperada, apenas trocada.'}</small></label></section><section class="rankingEditorOptions"><div class="rankingEditorSectionHead"><div><span>OPÇÕES</span><strong>Corrigir os nomes</strong></div><small>${r.opts.length} opções · votos preservados</small></div><div class="rankingEditorOptionList">${options}</div></section><div class="rankingEditorSaveBar"><span id="rankingEditorStatus" role="status" aria-live="polite"></span><div><button class="rankingEditorCancel" id="rankingEditorCancel" type="button">Cancelar</button><button class="rankingEditorSave" type="submit">Salvar alterações</button></div></div></form>`;
}

function renderRankingEditorScreen(r, homePath, homeLabel, categoryPath) {
  feed.innerHTML = `<div class="internalHead"><a class="backLink" href="${homePath}">← ${homeLabel}</a><span class="internalMeta">Modo privado</span></div>${moderatorRankingBarHTML(true)}${rankingEditorHTML(r, categoryPath)}<div class="end"><a class="backLink" href="${rankingPath(r.id)}">← cancelar edição</a></div>`;
  bindRankingEditor(r);
}

function setRankingEditorPreview(source, alt) {
  const preview = document.querySelector('.rankingEditorPhotoPreview');
  if (!preview) return;
  preview.innerHTML = source
    ? `<img id="rankingEditorImagePreview" src="${escapeHTML(source)}" alt="${escapeHTML(alt)}">`
    : '<span class="rankingEditorPhotoEmpty" id="rankingEditorImagePreview">Sem foto</span>';
}

function rankingImageSuggestionsHTML(suggestions, brief) {
  if (!suggestions.length) {
    const fallbackUrl = `https://unsplash.com/s/photos/${encodeURIComponent(brief || 'editorial photography')}`;
    return `<div class="rankingEditorSuggestionsEmpty"><strong>Nenhuma foto segura apareceu nessa busca.</strong><span>Não vou sugerir uma imagem só porque ela tem palavras parecidas.</span><a href="${escapeHTML(fallbackUrl)}" target="_blank" rel="noopener noreferrer">Abrir busca ampliada</a></div>`;
  }
  return `<div class="rankingEditorSuggestionsHead"><div><strong>Escolha pela imagem</strong><span>Busca guiada por: ${escapeHTML(brief)}</span></div><small>CC0 ou domínio público</small></div><div class="rankingEditorSuggestionGrid">${suggestions
    .map(
      (suggestion, index) =>
        `<button type="button" data-ranking-image-suggestion="${index}" aria-pressed="false"><img src="${escapeHTML(suggestion.imageUrl)}" alt="${escapeHTML(suggestion.title)}" loading="lazy"><span>${escapeHTML(suggestion.title)}</span><small>${escapeHTML(suggestion.license)}</small></button>`,
    )
    .join('')}</div>`;
}

function bindRankingImageSuggestions(r, urlInput, status) {
  const button = document.getElementById('rankingEditorSuggestPhotos'),
    container = document.getElementById('rankingEditorSuggestions');
  if (!button || !container) return;
  button.onclick = async () => {
    button.disabled = true;
    button.textContent = 'Buscando pelo assunto…';
    container.innerHTML =
      '<div class="rankingEditorSuggestionsLoading">Analisando título, categoria e opções…</div>';
    try {
      const response = await fetch(
          `/api?action=ranking-image-suggestions&ranking_id=${encodeURIComponent(r.id)}`,
        ),
        result = await response.json().catch(() => ({}));
      if (!response.ok) throw result;
      const suggestions = Array.isArray(result.suggestions) ? result.suggestions : [];
      container.innerHTML = rankingImageSuggestionsHTML(suggestions, result.brief || r.q);
      container.querySelectorAll('[data-ranking-image-suggestion]').forEach((candidate) => {
        candidate.onclick = () => {
          const suggestion = suggestions[Number(candidate.dataset.rankingImageSuggestion)];
          if (!suggestion?.imageUrl?.startsWith('https://')) return;
          rankingEditorState.imageMode = 'url';
          rankingEditorState.imageData = '';
          rankingEditorState.imageUrl = suggestion.imageUrl;
          rankingEditorState.imagePreview = suggestion.imageUrl;
          urlInput.value = suggestion.imageUrl;
          setRankingEditorPreview(suggestion.imageUrl, r.q);
          container.querySelectorAll('[data-ranking-image-suggestion]').forEach((item) => {
            item.setAttribute('aria-pressed', String(item === candidate));
          });
          status.textContent = 'Foto selecionada. Confira a prévia e salve para publicar.';
        };
      });
      if (!suggestions.length && result.unavailable) {
        status.textContent = 'A busca de fotos está indisponível agora. Tente novamente depois.';
      }
    } catch (error) {
      container.innerHTML = '';
      status.textContent =
        error?.error === 'authentication_required'
          ? 'Sua sessão terminou. Entre novamente.'
          : 'Não consegui buscar fotos agora. A imagem atual não foi alterada.';
    } finally {
      button.disabled = false;
      button.textContent = 'Buscar fotos que combinam';
    }
  };
}

async function optimizeRankingPhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file?.type)) {
    throw new Error('unsupported_photo');
  }
  if (Number(file.size || 0) > 8 * 1024 * 1024) {
    throw new Error('photo_too_large');
  }
  const objectUrl = URL.createObjectURL(file),
    image = new Image();
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = objectUrl;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('photo_processing');
    const scale = Math.min(1, 1280 / image.naturalWidth, 960 / image.naturalHeight),
      canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('photo_processing');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let quality = 0.84,
      data = canvas.toDataURL('image/jpeg', quality);
    while (data.length > 1950000 && quality > 0.52) {
      quality -= 0.08;
      data = canvas.toDataURL('image/jpeg', quality);
    }
    if (data.length > 2000000) throw new Error('photo_too_large');
    return data;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function rankingEditorErrorText(error) {
  return (
    {
      invalid_ranking_content: 'Confira o título e tente novamente.',
      invalid_ranking_options: 'Confira os nomes das opções.',
      duplicate_ranking_option: 'Há duas opções com o mesmo nome.',
      ranking_options_changed: 'As opções mudaram em outra tela. Recarregue antes de salvar.',
      invalid_ranking_image: 'Essa foto não pôde ser usada.',
      invalid_ranking_image_url: 'Use um link de imagem começando com https://.',
      invalid_vip_settings: 'Confira a configuração do Meu Topo.',
      invalid_vip_password: 'A senha precisa ter entre 4 e 80 caracteres.',
      vip_password_required: 'Crie uma senha para colocar este ranking no Meu Topo.',
      moderator_required: 'Esta conta não tem acesso de moderador.',
      authentication_required: 'Sua sessão terminou. Entre novamente.',
    }[error] || 'Não consegui salvar agora. Tente novamente.'
  );
}

function bindRankingEditor(r) {
  const form = document.getElementById('rankingEditorForm'),
    status = document.getElementById('rankingEditorStatus'),
    fileInput = document.getElementById('rankingEditorFile'),
    urlInput = document.getElementById('rankingEditorImageUrl'),
    vipToggle = document.getElementById('rankingEditorVip'),
    vipPasswordInput = document.getElementById('rankingEditorVipPassword');
  if (!form || !rankingEditorState) return;

  const syncVipEditor = () => {
    const enabled = vipToggle.checked;
    vipPasswordInput.disabled = !enabled;
    vipPasswordInput.required = enabled && !r.vipHasPassword;
    document.querySelector('.rankingEditorVip')?.classList.toggle('enabled', enabled);
  };
  vipToggle.addEventListener('change', syncVipEditor);
  syncVipEditor();

  document.getElementById('rankingEditorTitle')?.focus();
  document.getElementById('rankingEditorCancel').onclick = () => {
    rankingEditorState = null;
    visibleOptionCount = 10;
    renderInternal();
  };
  bindRankingImageSuggestions(r, urlInput, status);
  document.getElementById('rankingEditorKeepPhoto').onclick = () => {
    rankingEditorState.imageMode = 'keep';
    rankingEditorState.imageData = '';
    rankingEditorState.imagePreview = rankingEditorState.originalImageUrl || '';
    urlInput.value = String(rankingEditorState.originalImageUrl || '').startsWith('https://')
      ? rankingEditorState.originalImageUrl
      : '';
    setRankingEditorPreview(rankingEditorState.imagePreview, r.q);
    status.textContent = 'Foto atual mantida.';
  };
  document.getElementById('rankingEditorRemovePhoto').onclick = () => {
    rankingEditorState.imageMode = 'remove';
    rankingEditorState.imageData = '';
    rankingEditorState.imagePreview = '';
    urlInput.value = '';
    setRankingEditorPreview('', r.q);
    status.textContent = 'A foto será removida quando você salvar.';
  };
  urlInput.addEventListener('change', () => {
    const value = urlInput.value.trim();
    if (!value) {
      rankingEditorState.imageMode = 'keep';
      rankingEditorState.imagePreview = rankingEditorState.originalImageUrl || '';
      setRankingEditorPreview(rankingEditorState.imagePreview, r.q);
      return;
    }
    if (!value.startsWith('https://')) {
      status.textContent = 'O link precisa começar com https://.';
      return;
    }
    rankingEditorState.imageMode = 'url';
    rankingEditorState.imageData = '';
    rankingEditorState.imageUrl = value;
    rankingEditorState.imagePreview = value;
    setRankingEditorPreview(value, r.q);
    status.textContent = 'Prévia atualizada. Salve para publicar.';
  });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    fileInput.disabled = true;
    status.textContent = 'Preparando a foto…';
    try {
      const imageData = await optimizeRankingPhoto(file);
      rankingEditorState.imageMode = 'upload';
      rankingEditorState.imageData = imageData;
      rankingEditorState.imagePreview = imageData;
      urlInput.value = '';
      setRankingEditorPreview(imageData, r.q);
      status.textContent = 'Foto pronta. Salve para publicar.';
    } catch {
      fileInput.value = '';
      status.textContent = 'Não consegui preparar essa foto. Use JPG, PNG ou WebP.';
    } finally {
      fileInput.disabled = false;
    }
  });

  form.onsubmit = async (event) => {
    event.preventDefault();
    const title = document.getElementById('rankingEditorTitle').value.trim(),
      optionInputs = [...form.querySelectorAll('[data-ranking-editor-option]')],
      options = optionInputs.map((input) => ({
        id: Number(input.dataset.id),
        label: input.value.trim(),
      })),
      normalized = options.map((option) => foldText(option.label)),
      isVip = vipToggle.checked,
      vipPassword = vipPasswordInput.value.normalize('NFKC').trim(),
      saveButton = form.querySelector('.rankingEditorSave');
    if (title.length < 8 || options.some((option) => option.label.length < 2)) {
      status.textContent = 'Confira o título e todas as opções.';
      return;
    }
    if (new Set(normalized).size !== normalized.length) {
      status.textContent = 'Há duas opções com o mesmo nome.';
      return;
    }
    if (isVip && !r.vipHasPassword && vipPassword.length < 4) {
      status.textContent = 'Crie uma senha com pelo menos 4 caracteres para o Meu Topo.';
      vipPasswordInput.focus();
      return;
    }

    const payload = { rankingId: r.id, title, options, isVip };
    if (isVip && vipPassword) payload.vipPassword = vipPassword;
    if (rankingEditorState.imageMode === 'upload') {
      payload.imageData = rankingEditorState.imageData;
    } else if (rankingEditorState.imageMode === 'url') {
      payload.imageUrl = urlInput.value.trim();
    } else if (rankingEditorState.imageMode === 'remove') {
      payload.imageUrl = '';
    }

    saveButton.disabled = true;
    status.textContent = 'Salvando…';
    try {
      const response = await fetch('/api?action=ranking-content', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        }),
        result = await response.json().catch(() => ({}));
      if (!response.ok) throw result;
      const labels = new Map(
        (result.ranking?.opts || []).map((option) => [Number(option.id), option.label]),
      );
      r.q = result.ranking?.q || title;
      r.img = result.ranking?.img || null;
      r.vip = result.ranking?.vip === true;
      r.vipHasPassword = result.ranking?.vipHasPassword === true;
      r.vipUnlocked = r.vip ? true : undefined;
      activeVipRankingId = r.vip ? r.id : '';
      r.opts.forEach((option) => {
        if (labels.has(Number(option.id))) option.label = labels.get(Number(option.id));
      });
      rankingEditorState = null;
      visibleOptionCount = 10;
      renderInternal();
      toast(result.unchanged ? 'Nada foi alterado' : 'Ranking atualizado');
    } catch (error) {
      status.textContent = rankingEditorErrorText(error?.error);
      saveButton.disabled = false;
    }
  };
}

function vipOwnerBarHTML(r) {
  const status = r.vipVotingOpen === false ? 'Votação encerrada' : 'Votação aberta';
  return `<section class="vipOwnerBar"><div><span>Seu ranking privado</span><strong>${status}</strong></div><div><button type="button" id="vipOwnerCopy">COPIAR LINK</button><button class="primary" type="button" id="vipOwnerManage">GERENCIAR</button></div></section>`;
}

function vipOwnerEditorErrorText(error) {
  return (
    {
      invalid_vip_content: 'Confira o título e a descrição.',
      invalid_vip_voting_state: 'Confira o estado da votação.',
      invalid_vip_options: 'O ranking precisa ter de 3 a 20 nomes diferentes.',
      duplicate_vip_option: 'Há nomes repetidos no ranking.',
      invalid_vip_password: 'A nova senha precisa ter de 4 a 80 caracteres.',
      invalid_ranking_image: 'Essa foto não pôde ser usada. Tente outra imagem.',
      vip_options_changed: 'A lista mudou em outro acesso. Recarregue e tente novamente.',
      ranking_not_found: 'Este ranking não está mais disponível.',
    }[error] || 'Não consegui salvar agora. Tente novamente.'
  );
}

function vipOwnerOptionRowHTML(option) {
  return `<div class="vipOwnerOptionRow" data-vip-owner-option data-option-id="${option.id}"><span>${option.originalPosition}</span><input type="text" minlength="2" maxlength="80" value="${escapeHTML(option.label)}" aria-label="Nome ou opção ${option.originalPosition}"><button type="button" data-remove-owner-option aria-label="Apagar ${escapeHTML(option.label)}">APAGAR</button></div>`;
}

function closeVipOwnerEditor(r) {
  vipOwnerEditorState = null;
  history.replaceState({}, '', rankingPath(r.id));
  renderInternal();
}

function renderVipOwnerEditorScreen(r) {
  const hasVotes = Number(r.votes || 0) > 0,
    orderedOptions = [...r.opts].sort(
      (left, right) => Number(left.originalPosition) - Number(right.originalPosition),
    );
  document.title = `Gerenciar ${r.q} — TOPO`;
  feed.innerHTML = `<div class="internalHead"><button class="backLink vipOwnerBack" id="vipOwnerBack" type="button">← Voltar ao ranking</button><span class="internalMeta">Privado · ${fmt(r.votes || 0)} votos</span></div><form class="vipOwnerEditor" id="vipOwnerEditorForm"><header class="vipOwnerEditorHead"><span class="portalKicker">Meu Topo</span><h1>Editar ranking</h1><p>Corrija a pergunta, escolha uma foto para o topo e ajuste os nomes. Os votos das opções mantidas continuam iguais.</p></header><label class="vipOwnerField" for="vipOwnerTitle"><span>Pergunta ou título</span><input id="vipOwnerTitle" type="text" minlength="8" maxlength="120" value="${escapeHTML(r.q)}" required></label><label class="vipOwnerField" for="vipOwnerDescription"><span>Descrição <small>opcional</small></span><textarea id="vipOwnerDescription" maxlength="280" rows="3">${escapeHTML(r.vipDescription || '')}</textarea></label>${vipCoverEditorHTML('vipOwner', r.img || '')}<section class="vipOwnerOptions"><div class="vipOptionEditorHead"><label>Nomes atuais</label><small id="vipOwnerOptionCount">${orderedOptions.length}/20</small></div><div id="vipOwnerOptions">${orderedOptions.map(vipOwnerOptionRowHTML).join('')}</div><p class="vipOwnerEditNote"><strong>Corrigir mantém os votos.</strong> Ao apagar, os votos e comentários ligados àquele nome também serão removidos quando você salvar.</p><label class="vipOwnerField" for="vipOwnerNewOptions"><span>Adicionar novos nomes <small>um por linha</small></span><textarea id="vipOwnerNewOptions" maxlength="1700" rows="4" placeholder="Ex.:&#10;João&#10;Maria"></textarea></label>${hasVotes ? '<p class="vipOwnerNewNote">Os novos nomes entram com zero votos e recebem o selo “Novo”.</p>' : ''}</section><section class="vipOwnerAccess"><label class="vipOwnerVotingToggle"><input id="vipOwnerVotingOpen" type="checkbox" ${r.vipVotingOpen === false ? '' : 'checked'}><span><strong>Votação aberta</strong><small>Desmarque para encerrar temporariamente.</small></span></label><label class="vipOwnerField" for="vipOwnerPassword"><span>Trocar a senha <small>opcional</small></span><input id="vipOwnerPassword" type="password" minlength="4" maxlength="80" autocomplete="new-password" placeholder="Deixe vazio para manter a senha atual"></label></section><span class="vipCreateStatus" id="vipOwnerStatus" role="status" aria-live="polite"></span><div class="vipOwnerEditorActions"><button class="danger" id="vipOwnerDelete" type="button">APAGAR RANKING</button><div><button id="vipOwnerCancel" type="button">CANCELAR</button><button class="primary" type="submit">SALVAR ALTERAÇÕES</button></div></div></form>`;

  const form = document.getElementById('vipOwnerEditorForm'),
    options = document.getElementById('vipOwnerOptions'),
    status = document.getElementById('vipOwnerStatus'),
    newOptionsInput = document.getElementById('vipOwnerNewOptions'),
    removedOptionIds = new Set(),
    cover = bindVipCoverPicker('vipOwner', r.img || ''),
    updateOptionCount = () => {
      const newCount = newOptionsInput.value
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean).length;
      document.getElementById('vipOwnerOptionCount').textContent =
        `${options.querySelectorAll('[data-vip-owner-option]').length + newCount}/20`;
    };
  document.getElementById('vipOwnerBack').onclick = () => closeVipOwnerEditor(r);
  document.getElementById('vipOwnerCancel').onclick = () => closeVipOwnerEditor(r);
  options.querySelectorAll('[data-remove-owner-option]').forEach((button) => {
    button.onclick = () => {
      const row = button.closest('[data-vip-owner-option]'),
        label = row?.querySelector('input')?.value.trim() || 'este nome';
      if (
        !row ||
        !window.confirm(
          `Apagar “${label}”? Ao salvar, os votos e comentários ligados a este nome também serão removidos.`,
        )
      )
        return;
      removedOptionIds.add(Number(row.dataset.optionId));
      row.remove();
      updateOptionCount();
    };
  });
  newOptionsInput.addEventListener('input', updateOptionCount);
  document.getElementById('vipOwnerDelete').onclick = async () => {
    if (!window.confirm(`Apagar “${r.q}”? Todos os votos e comentários também serão apagados.`)) {
      return;
    }
    const button = document.getElementById('vipOwnerDelete');
    button.disabled = true;
    try {
      const response = await fetch(
          `/api?action=vip-rankings&ranking_id=${encodeURIComponent(r.id)}`,
          { method: 'DELETE' },
        ),
        result = await response.json().catch(() => ({}));
      if (!response.ok) throw result;
      toast('Ranking privado apagado');
      location.assign('/vip#rankings-privados');
    } catch {
      button.disabled = false;
      status.className = 'vipCreateStatus error';
      status.textContent = 'Não consegui apagar agora.';
    }
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type=submit]'),
      retained = [...options.querySelectorAll('[data-vip-owner-option]')].map((row) => ({
        id: Number(row.dataset.optionId),
        label: row.querySelector('input').value.trim(),
      })),
      newOptions = newOptionsInput.value
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      payload = {
        rankingId: r.id,
        title: document.getElementById('vipOwnerTitle').value.trim(),
        description: document.getElementById('vipOwnerDescription').value.trim(),
        votingOpen: document.getElementById('vipOwnerVotingOpen').checked,
        password: document.getElementById('vipOwnerPassword').value,
        options: retained,
        newOptions,
        removedOptionIds: [...removedOptionIds],
      };
    if (cover.processing) {
      status.className = 'vipCreateStatus';
      status.textContent = 'Espere a foto terminar de ser preparada.';
      return;
    }
    if (cover.mode === 'upload') payload.imageData = cover.imageData;
    if (cover.mode === 'remove') payload.removeImage = true;
    if (retained.length + newOptions.length < 3 || retained.length + newOptions.length > 20) {
      status.className = 'vipCreateStatus error';
      status.textContent = 'O ranking precisa ter de 3 a 20 nomes.';
      return;
    }
    submit.disabled = true;
    status.className = 'vipCreateStatus';
    status.textContent = 'Salvando…';
    try {
      const response = await fetch('/api?action=vip-rankings', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        }),
        result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        location.assign(`/entrar?voltar=${encodeURIComponent(rankingPath(r.id) + '?gerenciar=1')}`);
        return;
      }
      if (!response.ok) throw result;
      vipOwnerEditorState = null;
      history.replaceState({}, '', rankingPath(r.id));
      toast('Ranking privado atualizado');
      await loadVipRanking(r.id);
    } catch (error) {
      status.className = 'vipCreateStatus error';
      status.textContent = vipOwnerEditorErrorText(error?.error);
      submit.disabled = false;
    }
  };
}

function renderInternal() {
  const id = internalId(),
    r = rankings.find((x) => x.id === id);
  if (!r) {
    feed.innerHTML =
      '<div class="loading">Ranking não encontrado.<br><a class="backLink" href="/">← Voltar para a Home</a></div>';
    return;
  }
  const vip = r.vip === true,
    local = !vip && topoLocal.isLocalRanking(r),
    homePath = vip
      ? r.vipOwned
        ? '/vip#rankings-privados'
        : '/vip'
      : local
        ? topoLocal.collectionPath(topoLocal.cityForRanking(r))
        : '/',
    homeLabel = vip ? (r.vipOwned ? 'Meus rankings' : 'Meu Topo') : local ? 'TOPO LOCAL' : 'TOPO',
    categoryPath = rankingCategoryPath(r);
  syncExperienceNavigation();
  document.title = `${r.q} — ${homeLabel}`;
  if (r.vipOwned && vipOwnerEditorState?.rankingId === r.id) {
    renderVipOwnerEditorScreen(r);
    return;
  }
  if (vipOwnerEditorState?.rankingId === r.id) vipOwnerEditorState = null;
  if (viewer.isModerator && !r.vipUserCreated && rankingEditorState?.rankingId === r.id) {
    renderRankingEditorScreen(r, homePath, homeLabel, categoryPath);
    return;
  }
  if (rankingEditorState?.rankingId === r.id) rankingEditorState = null;
  const promotedOptionIndex = r.vip
    ? -1
    : r.opts.findIndex((option) => Number(option.id) === rankingPromotionOptionId());
  if (promotedOptionIndex >= visibleOptionCount)
    visibleOptionCount = Math.min(r.opts.length, promotedOptionIndex + 1);
  const visibleLimit = Math.min(visibleOptionCount, r.opts.length),
    votingOpen = !vip || r.vipVotingOpen !== false,
    ownerBar = r.vipOwned ? vipOwnerBarHTML(r) : '',
    description =
      vip && r.vipDescription
        ? `<p class="vipRankingDescription">${escapeHTML(r.vipDescription)}</p>`
        : '',
    closedNotice = votingOpen
      ? ''
      : '<div class="vipVotingClosed"><strong>Votação encerrada</strong><span>O resultado continua visível, mas novos votos estão pausados.</span></div>';
  const cover = r.img
    ? `<div class="imageStrip ${vip ? 'vipRankingCover' : ''}"><img data-ranking-image src="${escapeHTML(r.img)}" alt="${escapeHTML(r.q)}" decoding="async"></div>`
    : '';
  const rankingHead = `<div class="rankHead"><span class="categoryWrap"><a class="category" href="${categoryPath}">${vip ? 'Meu Topo' : escapeHTML(categoryLabel(r))}</a>${newBadgeHTML(r)}</span><span class="total">Top ${visibleLimit}</span></div>`,
    compactHero = `<div class="rankingCompactHero${cover ? '' : ' rankingCompactHeroNoImage'}${rankingTitleSizeClass(r.q)}">${cover}<div class="rankingCompactHeroCopy">${rankingHead}<h1>${escapeHTML(r.q)}</h1>${description}</div></div>`;
  feed.innerHTML = `${ownerBar}<article class="rank rankingMain" id="votar">${compactHero}${rankingPersonalActionsHTML(r, 'desktop')}${closedNotice}${rankingPersonalActionsHTML(r, 'mobile')}${rankingOptionPromotionHTML(r)}${rankingVoteModeHTML(r, votingOpen)}<div id="rankingVotingPanel" role="tabpanel">${rankingVotePanelHTML(r, votingOpen)}</div>${rankingOptionSuggestionHTML(r)}</article>${rankingContinuationHTML(r)}${commentsShellHTML()}${editorialHTML(r)}<div class="end"><a class="backLink" href="${homePath}">← voltar para ${r.vipOwned ? 'seus rankings privados' : vip ? 'o Meu Topo' : `todos os rankings ${local ? 'locais' : ''}`}</a></div>`;
  syncRankingContinuationFlow();
  if (r.vipOwned) {
    document.getElementById('vipOwnerCopy').onclick = () => copyVipRankingLink(r.id);
    document.getElementById('vipOwnerManage').onclick = () => {
      vipOwnerEditorState = { rankingId: r.id };
      history.replaceState({}, '', `${rankingPath(r.id)}?gerenciar=1`);
      renderInternal();
    };
  }
  if (viewer.isModerator) {
    if (!r.vipUserCreated) {
      feed
        .querySelector('.rankingMain')
        ?.insertAdjacentHTML('beforebegin', moderatorRankingBarHTML(false));
      document
        .getElementById('rankingEditStart')
        ?.addEventListener('click', () => beginRankingEdit(r));
    }
  }
  bindVotes();
  bindRankingOptionPromotion(r);
  bindRankingVoteModes(r);
  if (votingOpen && activeRankingVoteMode() === 'duelo') bindDuelMode(r);
  else bindAllItems(r);
  if (votingOpen && activeRankingVoteMode() !== 'livre') void loadRankingVotingModes(r);
  bindRankingSuggestion(r);
  focusRankingPromotionOption(r);
  loadComments(r);
}
function suggestionStatusInfo(status) {
  return (
    {
      pending: { label: 'Em análise', className: 'pending' },
      approved: { label: 'Aprovada', className: 'approved' },
      rejected: { label: 'Não aprovada', className: 'rejected' },
      duplicate: { label: 'Já existe', className: 'duplicate' },
      published: { label: 'Publicada', className: 'published' },
      removed: { label: 'Nome removido', className: 'rejected' },
      dismissed: { label: 'Nome mantido', className: 'approved' },
    }[status] || { label: 'Em análise', className: 'pending' }
  );
}
function suggestionDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function profileSuggestionHistoryHTML(suggestions = {}) {
  const optionItems = (suggestions.options || []).map((item) => ({ ...item, kind: 'option' })),
    rankingItems = (suggestions.rankings || []).map((item) => ({ ...item, kind: 'ranking' })),
    items = [...optionItems, ...rankingItems].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );
  if (!items.length)
    return '<p class="suggestionHistoryEmpty">Suas sugestões e o andamento delas aparecerão aqui.</p>';
  return `<div class="suggestionHistoryList">${items
    .map((item) => {
      const isOption = item.kind === 'option',
        status =
          !isOption && item.status === 'approved'
            ? { label: 'Em preparação', className: 'approved' }
            : suggestionStatusInfo(item.status),
        title = isOption ? item.label : item.title,
        context = isOption
          ? item.question
          : item.category === 'A definir'
            ? 'Categoria e opções pela equipe'
            : item.category,
        rankingId = isOption ? item.rankingId : item.publishedRankingId,
        content = `<span class="suggestionHistoryType">${isOption ? 'Opção para ranking' : 'Novo ranking'}</span><strong>${escapeHTML(title)}</strong><small>${escapeHTML(context || '')} · enviada em ${suggestionDate(item.createdAt)}</small>${item.moderationNote ? `<em>${escapeHTML(item.moderationNote)}</em>` : ''}`;
      return `<article class="suggestionHistoryItem">${rankingId ? `<a href="${rankingPath(rankingId)}">${content}</a>` : `<div>${content}</div>`}<span class="suggestionStatus ${status.className}">${status.label}</span></article>`;
    })
    .join('')}</div>`;
}
function profileSuggestionCenterHTML(data = {}) {
  return `<div class="profileSuggestionCenter" id="profileSuggestionCenter"><section class="profileSection rankingSuggestionForm" id="sugerir-ranking"><div class="profileSectionHead"><div><span class="suggestionEyebrow">Sua ideia pode virar TOPO</span><div class="sectionLabel">Sugerir um novo ranking</div></div><span>1 por semana</span></div><p>Escreva somente o nome ou a frase do ranking. A equipe do TOPO ajusta o título, escolhe a categoria, cria as opções e seleciona a foto.</p><form id="rankingSuggestionForm"><label class="suggestionField"><span>Nome ou frase do ranking</span><input name="title" type="text" minlength="8" maxlength="120" placeholder="Ex.: Qual é o melhor filme para ver em família?" required><small>É só a ideia. O restante fica por nossa conta.</small></label><button class="suggestionSubmit" type="submit">Enviar ideia para análise</button><span class="suggestionFormStatus" id="rankingSuggestionStatus" aria-live="polite"></span></form></section><section class="profileSection suggestionHistorySection"><div class="profileSectionHead"><div class="sectionLabel">Minhas sugestões</div><span>acompanhe por aqui</span></div>${profileSuggestionHistoryHTML(data.suggestions)}</section>${data.isModerator ? '<a class="moderationProfileLink" href="/moderacao"><span>Painel privado</span><strong>Abrir moderação →</strong></a>' : ''}</div>`;
}
function bindProfileSuggestionForm() {
  const form = document.getElementById('rankingSuggestionForm');
  if (!form) return;
  form.onsubmit = async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type=submit]'),
      status = document.getElementById('rankingSuggestionStatus'),
      formData = new FormData(form);
    button.disabled = true;
    status.className = 'suggestionFormStatus';
    status.textContent = 'Enviando…';
    try {
      const response = await fetch('/api?action=suggestions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind: 'ranking',
            title: String(formData.get('title') || '').trim(),
          }),
        }),
        result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        location.assign('/entrar?voltar=%2Fvip%23sugerir-ranking');
        return;
      }
      if (!response.ok) throw result;
      toast('Ideia enviada para análise');
      document.getElementById('profileSuggestionCenter')?.remove();
      await loadProfileSuggestionCenter();
      document.getElementById('sugerir-ranking')?.scrollIntoView({ block: 'start' });
    } catch (error) {
      status.classList.add('error');
      status.textContent = suggestionErrorText(error?.error);
    } finally {
      button.disabled = false;
    }
  };
}
async function loadProfileSuggestionCenter() {
  const recent = document.querySelector('.profileRecentSection');
  if (!recent || document.getElementById('profileSuggestionCenter')) return;
  const loading = document.createElement('div');
  loading.id = 'profileSuggestionCenter';
  loading.className = 'profileSuggestionCenter suggestionCenterLoading';
  loading.innerHTML = '<span class="commentsLoading">carregando suas sugestões…</span>';
  recent.insertAdjacentElement('afterend', loading);
  try {
    const response = await fetch('/api?action=suggestions', { cache: 'no-store' }),
      data = await response.json().catch(() => ({}));
    if (!response.ok) throw data;
    loading.outerHTML = profileSuggestionCenterHTML(data);
    bindProfileSuggestionForm();
    if (location.hash === '#sugerir-ranking')
      document.getElementById('sugerir-ranking')?.scrollIntoView({ block: 'start' });
  } catch (error) {
    loading.innerHTML =
      '<section class="profileSection"><p class="profileHint">Não consegui carregar suas sugestões agora. <button class="suggestionRetry" type="button">Tentar novamente</button></p></section>';
    loading.querySelector('.suggestionRetry')?.addEventListener('click', () => {
      loading.remove();
      loadProfileSuggestionCenter();
    });
  }
}
function clerkErrorCode(error) {
  return error?.errors?.[0]?.code || error?.code || error?.error || '';
}
function clerkErrorText(error) {
  const code = clerkErrorCode(error);
  return (
    {
      form_param_format_invalid: 'Confira o e-mail digitado.',
      form_identifier_not_found: 'Não encontrei essa conta. Tente novamente.',
      form_code_incorrect: 'O código não confere. Digite os seis números do e-mail.',
      verification_expired: 'Esse código venceu. Peça um novo.',
      verification_failed: 'O código não confere. Tente novamente.',
      too_many_requests: 'Muitas tentativas seguidas. Aguarde um pouco e tente novamente.',
      strategy_for_user_invalid: 'Não foi possível usar o código nesta conta.',
      not_allowed_to_sign_up: 'Não foi possível criar a conta agora.',
      signup_rate_limit_exceeded: 'Muitas tentativas seguidas. Aguarde um pouco e tente novamente.',
      session_exists: 'Você já está conectado.',
      oauth_access_denied: 'O acesso com Google foi cancelado.',
      oauth_callback_error: 'Não consegui concluir o acesso com Google. Tente novamente.',
      oauth_connection_not_enabled:
        'O acesso com Google ainda não está disponível. Use o e-mail abaixo.',
      external_account_exists:
        'Este e-mail já está ligado a outra forma de acesso. Entre pelo e-mail abaixo.',
    }[code] || 'Não consegui concluir agora. Tente novamente.'
  );
}
function temporaryClerkPassword() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return 'Topo!9' + Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
async function finishClerkAuth(clerk, resource, temporaryPassword = '') {
  if (resource?.status !== 'complete' || !resource?.createdSessionId)
    throw new Error('clerk_session_incomplete');
  await clerk.setActive({ session: resource.createdSessionId });
  if (temporaryPassword && clerk.user?.removePassword) {
    try {
      await clerk.user.removePassword({ currentPassword: temporaryPassword });
    } catch (problem) {
      console.warn(
        'A conta foi criada, mas a credencial temporária não pôde ser removida.',
        problem,
      );
    }
  }
  location.assign(authReturn());
}
async function finishPendingClerkSignUp(clerk, signUp) {
  if (signUp?.status === 'complete') {
    await finishClerkAuth(clerk, signUp);
    return true;
  }
  const missing = signUp?.missingFields || [];
  if (signUp?.status === 'missing_requirements' && missing.includes('password')) {
    const password = temporaryClerkPassword(),
      completed = await clerk.client.signUp.update({ password });
    if (completed.status === 'complete') {
      await finishClerkAuth(clerk, completed, password);
      return true;
    }
  }
  return false;
}
async function transferClerkSignUp(clerk) {
  let signUp = await clerk.client.signUp.create({ transfer: true });
  if (await finishPendingClerkSignUp(clerk, signUp)) return true;
  throw new Error('clerk_session_incomplete');
}
function googleMarkHTML() {
  return `<svg class="googleAuthMark" aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"></path><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.06v2.62A10 10 0 0 0 12 22Z"></path><path fill="#FBBC05" d="M6.4 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.12-1.32.32-1.93V7.45H3.06A10 10 0 0 0 2 12c0 1.64.39 3.2 1.06 4.55l3.34-2.62Z"></path><path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.94 5.45l3.34 2.62c.79-2.37 3-4.13 5.6-4.13Z"></path></svg>`;
}
async function startClerkGoogle(clerk) {
  const button = document.getElementById('clerkGoogleAuth'),
    label = button?.querySelector('span'),
    error = document.getElementById('clerkSocialError');
  if (!button || !label || !error) return;
  button.disabled = true;
  label.textContent = 'Abrindo acesso seguro…';
  error.textContent = '';
  try {
    const redirectUrl = new URL('/sso-callback', location.origin).href,
      redirectUrlComplete = new URL(authReturn(), location.origin).href;
    await clerk.client.signUp.authenticateWithRedirect({
      strategy: 'oauth_google',
      redirectUrl,
      redirectUrlComplete,
    });
  } catch (problem) {
    console.error('Não foi possível abrir o acesso seguro.', problem);
    button.disabled = false;
    label.textContent = 'Continuar com Google';
    error.textContent = clerkErrorText(problem);
  }
}
function renderClerkStart(mount, clerk) {
  mount.innerHTML = `<div class="passwordlessAuth"><button class="googleAuthButton" id="clerkGoogleAuth" type="button">${googleMarkHTML()}<span>Continuar com Google</span></button><div class="formError clerkSocialError" id="clerkSocialError" aria-live="polite"></div><div class="authChoiceDivider"><span>ou continue por e-mail</span></div><form id="emailCodeStart"><label class="field"><span>E-mail</span><input id="clerkEmail" name="email" type="email" inputmode="email" autocomplete="email" maxlength="160" placeholder="voce@email.com" value="${escapeHTML(clerkAuthFlow.email)}" required></label><div id="clerk-captcha"></div><div class="formError clerkFlowError" id="clerkFlowError" aria-live="polite"></div><button class="primaryBtn" type="submit">Receber código por e-mail</button></form><p class="authFine">Se for seu primeiro acesso, sua conta será criada automaticamente.</p></div>`;
  document.getElementById('clerkGoogleAuth').onclick = () => startClerkGoogle(clerk);
  document.getElementById('emailCodeStart').onsubmit = (event) =>
    startClerkEmail(event, clerk, mount);
}
function renderClerkCode(mount, clerk, message = 'Código enviado.') {
  mount.innerHTML = `<div class="passwordlessAuth clerkCodeStep"><div class="codeSentMark" aria-hidden="true">✓</div><h2>Confira seu e-mail.</h2><p>${escapeHTML(message)} Enviamos seis números para <strong>${escapeHTML(clerkAuthFlow.email)}</strong>.</p><form id="emailCodeVerify"><label class="field codeField"><span>Código de acesso</span><input id="clerkCode" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" minlength="6" maxlength="6" pattern="[0-9]{6}" placeholder="000000" required></label><div class="formError clerkFlowError" id="clerkFlowError" aria-live="polite"></div><button class="primaryBtn" type="submit">Entrar no TOPO</button></form><div class="codeStepActions"><button id="resendClerkCode" type="button">Reenviar código</button><button id="changeClerkEmail" type="button">Trocar e-mail</button></div></div>`;
  document.getElementById('emailCodeVerify').onsubmit = (event) =>
    verifyClerkEmail(event, clerk, mount);
  document.getElementById('resendClerkCode').onclick = () => resendClerkEmail(clerk, mount);
  document.getElementById('changeClerkEmail').onclick = () => renderClerkStart(mount, clerk);
  document.getElementById('clerkCode')?.focus();
}
async function startClerkEmail(event, clerk, mount) {
  event.preventDefault();
  const form = event.currentTarget,
    button = form.querySelector('button[type=submit]'),
    error = document.getElementById('clerkFlowError'),
    email = String(new FormData(form).get('email') || '')
      .trim()
      .toLowerCase();
  button.disabled = true;
  button.textContent = 'Enviando…';
  error.textContent = '';
  clerkAuthFlow = { email, kind: 'signin' };
  try {
    const signIn = await clerk.client.signIn.create({
      identifier: email,
      strategy: 'email_code',
      signUpIfMissing: true,
    });
    if (signIn.status === 'complete') {
      await finishClerkAuth(clerk, signIn);
      return;
    }
    const signUp = clerk.client.signUp;
    if (
      signUp?.id &&
      signUp.emailAddress === email &&
      signUp.verifications?.emailAddress?.strategy === 'email_code'
    )
      clerkAuthFlow.kind = 'signup';
    renderClerkCode(mount, clerk);
  } catch (problem) {
    button.disabled = false;
    button.textContent = 'Receber código por e-mail';
    error.textContent = clerkErrorText(problem);
  }
}
async function verifyClerkEmail(event, clerk, mount) {
  event.preventDefault();
  const form = event.currentTarget,
    button = form.querySelector('button[type=submit]'),
    error = document.getElementById('clerkFlowError'),
    code = String(new FormData(form).get('code') || '').replace(/\D/g, '');
  button.disabled = true;
  button.textContent = 'Verificando…';
  error.textContent = '';
  try {
    let result;
    if (clerkAuthFlow.kind === 'signup')
      result = await clerk.client.signUp.attemptEmailAddressVerification({ code });
    else result = await clerk.client.signIn.attemptFirstFactor({ strategy: 'email_code', code });
    if (result.status === 'complete') {
      await finishClerkAuth(clerk, result);
      return;
    }
    if (
      clerkAuthFlow.kind === 'signin' &&
      result.firstFactorVerification?.status === 'transferable'
    ) {
      await transferClerkSignUp(clerk);
      return;
    }
    if (clerk.client.signUp?.status === 'complete') {
      await finishClerkAuth(clerk, clerk.client.signUp);
      return;
    }
    const missing = result?.missingFields || [];
    if (missing.includes('password')) throw { error: 'passwordless_not_enabled' };
    throw new Error('clerk_session_incomplete');
  } catch (problem) {
    if (
      clerkAuthFlow.kind === 'signin' &&
      clerkErrorCode(problem) === 'sign_up_if_missing_transfer'
    ) {
      try {
        await transferClerkSignUp(clerk);
        return;
      } catch (transferProblem) {
        problem = transferProblem;
      }
    }
    console.error('Não foi possível concluir o código de acesso.', problem);
    button.disabled = false;
    button.textContent = 'Entrar no TOPO';
    error.textContent =
      problem?.error === 'passwordless_not_enabled'
        ? 'Não consegui concluir o acesso por código agora. Tente novamente.'
        : clerkErrorText(problem);
  }
}
async function resendClerkEmail(clerk, mount) {
  const button = document.getElementById('resendClerkCode'),
    error = document.getElementById('clerkFlowError');
  button.disabled = true;
  error.textContent = '';
  try {
    const signIn = await clerk.client.signIn.create({
      identifier: clerkAuthFlow.email,
      strategy: 'email_code',
      signUpIfMissing: true,
    });
    clerkAuthFlow.kind = 'signin';
    const signUp = clerk.client.signUp;
    if (
      signUp?.id &&
      signUp.emailAddress === clerkAuthFlow.email &&
      signUp.verifications?.emailAddress?.strategy === 'email_code'
    )
      clerkAuthFlow.kind = 'signup';
    renderClerkCode(mount, clerk, 'Novo código enviado.');
  } catch (problem) {
    button.disabled = false;
    error.textContent = clerkErrorText(problem);
  }
}
async function renderAuth() {
  if (viewer.registered) {
    location.replace(authReturn());
    return;
  }
  document.title = 'Entrar — TOPO';
  feed.innerHTML = `<div class="authShell clerkAuthShell"><div class="authCard clerkAuthCard"><div class="authEyebrow">Sua conta no TOPO</div><div class="authTitle">Entre em segundos.</div><p class="authIntro">Continue com Google ou use seu e-mail. Na primeira vez, sua conta é criada automaticamente.</p><div class="clerkAuthMount" id="clerkAuthMount"><span class="commentsLoading">preparando acesso seguro…</span></div><div class="authNote">Seus votos deste aparelho serão ligados à sua conta quando você entrar.</div></div></div>`;
  const clerk = await initClerk(true),
    mount = document.getElementById('clerkAuthMount');
  if (!mount) return;
  if (!clerk) {
    mount.innerHTML =
      '<div class="clerkAuthError">Não consegui abrir o acesso agora.<br><button class="retry" type="button" id="retryClerk">Tentar novamente</button></div>';
    document.getElementById('retryClerk').onclick = () => {
      clerkLoadPromise = null;
      renderAuth();
    };
    return;
  }
  if (location.pathname === '/sso-callback') {
    mount.innerHTML =
      '<div class="clerkCallback"><span class="commentsLoading">concluindo seu acesso…</span><div id="clerk-captcha"></div></div>';
    try {
      await clerk.handleRedirectCallback(
        {
          signInForceRedirectUrl: authReturn(),
          signInFallbackRedirectUrl: authReturn(),
          signUpForceRedirectUrl: authReturn(),
          signUpFallbackRedirectUrl: authReturn(),
          signInUrl: '/entrar',
          signUpUrl: '/entrar',
          continueSignUpUrl: '/entrar',
          transferable: true,
        },
        async (to) => {
          const signIn = clerk.client.signIn,
            signUp = clerk.client.signUp;
          console.info(
            'Estado do retorno Google: ' +
              JSON.stringify({
                destination: to,
                signInStatus: signIn?.status,
                signUpStatus: signUp?.status,
                missingSignUpFields: signUp?.missingFields || [],
                transferable: Boolean(signIn?.isTransferable),
              }),
          );
          if (clerk.session || clerk.user) {
            location.assign(authReturn());
            return;
          }
          if (signIn?.status === 'complete') {
            await finishClerkAuth(clerk, signIn);
            return;
          }
          if (signUp?.status === 'complete') {
            await finishClerkAuth(clerk, signUp);
            return;
          }
          if (signUp?.status === 'missing_requirements') {
            if (await finishPendingClerkSignUp(clerk, signUp)) return;
          }
          if (signIn?.isTransferable) {
            await transferClerkSignUp(clerk);
            return;
          }
          location.assign(to || '/entrar');
        },
      );
    } catch (problem) {
      console.error('Não foi possível concluir o acesso com Google.', problem);
      mount.innerHTML = `<div class="clerkAuthError">${escapeHTML(clerkErrorText(problem))}<br><a class="retry authButtonLink" href="/entrar">Voltar para entrar</a></div>`;
    }
    return;
  }
  mount.innerHTML = '';
  try {
    await clerk.mountSignIn(mount, {
      routing: 'hash',
      withSignUp: true,
      forceRedirectUrl: authReturn(),
      fallbackRedirectUrl: authReturn(),
      signUpForceRedirectUrl: authReturn(),
      signUpFallbackRedirectUrl: authReturn(),
      appearance: {
        elements: {
          rootBox: { width: '100%' },
          cardBox: { width: '100%', boxShadow: 'none' },
          card: { width: '100%', boxShadow: 'none' },
        },
      },
    });
  } catch (problem) {
    console.error('Não foi possível abrir o componente de acesso do Clerk.', problem);
    renderClerkStart(mount, clerk);
  }
}
const doubleVoteThresholds = [20, 75, 200];
function profileProgressInfo(votes) {
  const total = Math.max(0, Number(votes || 0)),
    unlocked = doubleVoteThresholds.filter((threshold) => total >= threshold).length,
    next = doubleVoteThresholds[unlocked] || null;
  return {
    total,
    unlocked,
    next,
    remaining: next ? Math.max(0, next - total) : 0,
    progress: next ? Math.min(100, Math.round((total / next) * 100)) : 100,
  };
}
function profileLevel(votes) {
  if (votes >= 200) return 'Referência no TOPO';
  if (votes >= 75) return 'Curador do TOPO';
  if (votes >= 20) return 'Explorador de rankings';
  return 'Começando no TOPO';
}
function profileInitial(name) {
  return Array.from(String(name || 'T').trim())[0]?.toUpperCase() || 'T';
}
function profileNameDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
function profileNameEditorHTML(user = {}) {
  const canChange = user.canChangeName !== false,
    hasChosenName = user.hasChosenName === true,
    title = hasChosenName ? 'Nome público' : 'Escolha seu nome no TOPO',
    availableDate = profileNameDate(user.nameChangeAvailableAt);
  return `<div class="profileIdentityPanel" id="profileIdentityPanel"><div class="profilePhotoTitle">${title}</div>${canChange ? `<form class="profileNameForm" id="profileNameForm"><label for="profileNameInput">Como você aparece no TOPO</label><div><input id="profileNameInput" name="displayName" type="text" minlength="3" maxlength="24" autocomplete="nickname" value="${escapeHTML(user.name || '')}" required><button type="submit">Salvar nome</button></div></form><p class="profilePhotoNote">Aparece nos comentários e no ranking da comunidade.</p><p class="profileNameCooldown">Depois de salvar, a próxima troca fica disponível em 30 dias.</p>` : `<div class="profileIdentityCurrent">${escapeHTML(user.name || 'Pessoa no TOPO')}</div><p class="profileNameCooldown">Nova troca disponível em ${escapeHTML(availableDate || '30 dias')}.</p>`}<div class="profileNameStatus" id="profileNameStatus" aria-live="polite"></div></div>`;
}
function profileDoubleVotesHTML(state = {}) {
  const votes = Math.max(0, Number(state.totalVotes || 0)),
    unlockedCount = Math.max(0, Number(state.unlocked || 0)),
    assignments = Array.isArray(state.assignments) ? state.assignments : [];
  return doubleVoteThresholds
    .map((threshold, index) => {
      const slot = index + 1,
        unlocked = index < unlockedCount,
        assignment = assignments.find((item) => Number(item.slot) === slot),
        next = !unlocked && index === unlockedCount,
        remaining = Math.max(0, threshold - votes),
        status = assignment
          ? 'em uso'
          : unlocked
            ? 'livre'
            : next
              ? `${fmt(remaining)} voto${remaining === 1 ? '' : 's'}`
              : 'bloqueado',
        detail = assignment
          ? `${assignment.direction === 1 ? '↑' : '↓'} ${escapeHTML(assignment.option)} · ${escapeHTML(assignment.question)}`
          : unlocked
            ? 'Pronto para usar em qualquer ranking'
            : `Libera com ${fmt(threshold)} votos`;
      return `<div class="profilePowerRow"><span class="profilePowerIcon ${unlocked ? 'unlocked' : next ? 'next' : ''}" aria-hidden="true">${unlocked || next ? '⚡' : '◦'}</span><span class="profilePowerCopy"><strong>Voto duplo ${slot}</strong><small>${detail}</small></span><span class="profilePowerStatus ${assignment ? 'inUse' : unlocked ? 'available' : ''}">${status}</span></div>`;
    })
    .join('');
}
function groupedProfileCategories(categories = []) {
  const grouped = new Map();
  for (const category of categories) {
    const name = groupOf({ id: '', cat: String(category.name || '') });
    grouped.set(name, (grouped.get(name) || 0) + Number(category.votes || 0));
  }
  return [...grouped]
    .map(([name, votes]) => ({ name, votes }))
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, 3);
}
function profileCategoriesHTML(categories = []) {
  const grouped = groupedProfileCategories(categories);
  if (!grouped.length)
    return '<p class="profileHint">Vote em alguns rankings para descobrir seus temas favoritos.</p>';
  const max = Math.max(...grouped.map((category) => category.votes), 1);
  return `<div class="profileCategoryList">${grouped.map((category) => `<div class="profileCategory"><div class="profileCategoryLabel"><span>${escapeHTML(category.name)}</span><strong>${fmt(category.votes)}</strong></div><div class="profileCategoryTrack"><span style="width:${Math.round((category.votes / max) * 100)}%"></span></div></div>`).join('')}</div>`;
}
function profileRecentHTML(recent = []) {
  if (!recent.length) return '<p class="profileHint">Você ainda não tem votos salvos.</p>';
  return recent
    .slice(0, 5)
    .map(
      (v) =>
        `<a class="recentVote" href="${rankingPath(v.rankingId)}"><span class="voteArrow ${v.direction === 1 ? 'up' : 'down'}">${v.direction === 1 ? '↑' : '↓'}</span><span><span class="recentOption">${escapeHTML(v.option)} ${Number(v.weight) === 2 ? '<em class="recentDoubleVote">2×</em>' : ''}</span><span class="recentQuestion">${escapeHTML(v.question)}</span></span><span class="recentTime">${new Date(v.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span></a>`,
    )
    .join('');
}
const PROFILE_RANKING_ACTIVITY_PAGE_SIZE = 5;

function profileRankingActivityHTML(items = []) {
  const activity = Array.isArray(items) ? items : [];
  if (!activity.length)
    return `<section class="profileSection profileRankingActivity"><div class="profileSectionHead"><div class="sectionLabel">Rankings votados e jogados</div><span>seu histórico</span></div><p class="profileHint">Os rankings em que você votar ou jogar aparecerão aqui.</p></section>`;
  const cards = activity
    .map((item, index) => {
      const href = `${rankingPath(item.rankingId)}${item.played ? '?modo=duelo' : ''}`,
        tags = [
          item.voted ? '<em>VOTO LIVRE</em>' : '',
          item.played ? '<em>GANHA, FICA</em>' : '',
        ].join(''),
        winnerLabel = item.played
          ? item.completed
            ? item.winner
              ? 'Seu vencedor'
              : 'Partida sem vencedor'
            : item.winner
              ? 'Seu líder até agora'
              : 'Partida em andamento'
          : 'Você votou neste ranking',
        winner = item.winner
          ? `<strong>${escapeHTML(item.winner)}</strong>`
          : item.played && !item.completed
            ? '<strong>Continuar escolhendo</strong>'
            : '',
        continueAction =
          item.played && !item.completed
            ? '<span class="profileRankingActivityContinue">CONTINUAR DUELO →</span>'
            : '';
      return `<a class="profileRankingActivityCard" data-profile-activity-card href="${escapeHTML(href)}" ${index >= PROFILE_RANKING_ACTIVITY_PAGE_SIZE ? 'hidden' : ''}><span class="profileRankingActivityImage">${item.image ? `<img src="${escapeHTML(item.image)}" alt="" loading="lazy">` : '<b aria-hidden="true">TOPO</b>'}</span><span class="profileRankingActivityCopy"><span>${tags}</span><b>${escapeHTML(item.question)}</b><small>${escapeHTML(item.category || '')}</small></span><span class="profileRankingActivityWinner"><small>${winnerLabel}</small>${winner}${continueAction}</span></a>`;
    })
    .join('');
  const remaining = Math.max(0, activity.length - PROFILE_RANKING_ACTIVITY_PAGE_SIZE),
    moreButton = remaining
      ? `<button class="profileRankingActivityMore" type="button" data-profile-activity-more aria-controls="profileRankingActivityList" aria-expanded="false"><span>VER MAIS RANKINGS</span><small>${fmt(remaining)} restantes</small></button>`
      : '';
  return `<section class="profileSection profileRankingActivity"><div class="profileSectionHead"><div class="sectionLabel">Rankings votados e jogados</div><span>${fmt(activity.length)} no seu histórico</span></div><div class="profileRankingActivityList" id="profileRankingActivityList">${cards}</div>${moreButton}</section>`;
}

function bindProfileRankingActivityMore(root = document) {
  const button = root.querySelector('[data-profile-activity-more]');
  if (!button) return;
  button.onclick = () => {
    const section = button.closest('.profileRankingActivity'),
      hiddenCards = [...(section?.querySelectorAll('[data-profile-activity-card][hidden]') || [])];
    hiddenCards
      .slice(0, PROFILE_RANKING_ACTIVITY_PAGE_SIZE)
      .forEach((card) => card.removeAttribute('hidden'));
    button.setAttribute('aria-expanded', 'true');
    const remaining = Math.max(0, hiddenCards.length - PROFILE_RANKING_ACTIVITY_PAGE_SIZE);
    if (!remaining) {
      button.remove();
      return;
    }
    const count = button.querySelector('small');
    if (count) count.textContent = `${fmt(remaining)} restantes`;
  };
}
function profileLeaderboardHTML(entries = []) {
  if (!entries.length)
    return '<p class="profileHint">O ranking começa assim que as pessoas votam.</p>';
  let previousPosition = 0;
  return `<div class="profileLeaderboardList">${entries
    .map((entry) => {
      const position = Math.max(0, Number(entry.position || 0)),
        points = Math.max(0, Number(entry.points ?? entry.votes ?? 0)),
        rankingsCount = Math.max(0, Number(entry.rankings || 0)),
        gap =
          previousPosition && position > previousPosition + 1
            ? '<div class="profileLeaderboardGap">•••</div>'
            : '',
        avatar = entry.avatarData
          ? `<img src="${escapeHTML(entry.avatarData)}" alt="Foto de ${escapeHTML(entry.name)}">`
          : `<span>${escapeHTML(profileInitial(entry.name))}</span>`,
        reportAction = entry.isCurrent
          ? ''
          : `<button class="profileNameReport ${entry.reportedByCurrent ? 'reported' : ''}" type="button" data-report-name data-user-id="${escapeHTML(entry.userId)}" data-user-name="${escapeHTML(entry.name || 'Pessoa no TOPO')}" ${entry.reportedByCurrent ? 'disabled' : ''}>${entry.reportedByCurrent ? 'nome denunciado' : 'denunciar nome'}</button>`,
        row = `<div class="profileLeaderboardRow ${entry.isCurrent ? 'current' : ''}"><span class="profileLeaderboardPosition top${Math.min(position, 3)}">${position}</span><span class="profileLeaderboardAvatar">${avatar}</span><span class="profileLeaderboardPerson"><strong>${escapeHTML(entry.name || 'Pessoa no TOPO')}${entry.isCurrent ? '<em>você</em>' : ''}</strong><small>${escapeHTML(profileLevel(points))} · ${fmt(rankingsCount)} ranking${rankingsCount === 1 ? '' : 's'}</small>${reportAction}</span><span class="profileLeaderboardScore"><strong>${fmt(points)}</strong><small>pontos</small></span></div>`;
      previousPosition = position;
      return gap + row;
    })
    .join(
      '',
    )}</div><p class="profileLeaderboardNote">Flecha: 1 ponto · ranking novo: 5 · Duelo completo: 10 · dia ativo: 10 · compartilhamento com voto: 20. Até 3 compartilhamentos por dia.</p>`;
}
function bindProfileLeaderboardReports(root = document) {
  root.querySelectorAll('[data-report-name]').forEach((button) => {
    button.onclick = async () => {
      const name = button.dataset.userName || 'este nome';
      if (!window.confirm(`Enviar “${name}” para análise da moderação?`)) return;
      button.disabled = true;
      button.textContent = 'enviando…';
      try {
        const response = await fetch('/api?action=name-reports', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ userId: button.dataset.userId }),
          }),
          result = await response.json().catch(() => ({}));
        if (response.status === 401) {
          location.assign('/entrar?voltar=%2Fvip');
          return;
        }
        if (!response.ok) throw result;
        button.classList.add('reported');
        button.textContent = 'nome denunciado';
        toast(
          result.alreadyReported ? 'Esse nome já estava em análise' : 'Nome enviado para análise',
        );
      } catch (error) {
        button.disabled = false;
        button.textContent = 'denunciar nome';
        toast(
          error?.error === 'name_report_limit'
            ? 'Limite diário de denúncias atingido'
            : 'Não consegui enviar a denúncia',
        );
      }
    };
  });
}
async function loadProfileLeaderboard() {
  const recentSection = document.querySelector('.profileRecentSection');
  if (!recentSection || document.getElementById('profileLeaderboardSection')) return;
  const section = document.createElement('section');
  section.className = 'profileSection profileLeaderboardSection';
  section.id = 'profileLeaderboardSection';
  section.innerHTML =
    '<div class="profileSectionHead"><div class="sectionLabel">Ranking da comunidade</div><span>mais participativos</span></div><p class="profileHint">carregando ranking…</p>';
  recentSection.before(section);
  try {
    const res = await fetch('/api?action=leaderboard', { cache: 'no-store' });
    if (!res.ok) throw new Error('leaderboard_load_failed');
    const data = await res.json(),
      entries = Array.isArray(data.leaderboard) ? data.leaderboard : [],
      current = entries.find((entry) => entry.isCurrent);
    section.innerHTML = `<div class="profileSectionHead"><div class="sectionLabel">Ranking da comunidade</div><span>Top 10</span></div>${profileLeaderboardHTML(entries)}`;
    bindProfileLeaderboardReports(section);
    const scorecardPosition = document.getElementById('profileScorecardPosition');
    if (current && scorecardPosition) scorecardPosition.textContent = `${fmt(current.position)}º`;
  } catch {
    section.innerHTML =
      '<div class="profileSectionHead"><div class="sectionLabel">Ranking da comunidade</div><span>Top 10</span></div><p class="profileHint">Não consegui carregar o ranking agora.</p>';
  }
}
function profileImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file),
      image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não consegui abrir essa imagem.'));
    };
    image.src = url;
  });
}
async function prepareProfileAvatar(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Escolha uma foto em JPG, PNG ou WebP.');
  if (file.size > 8 * 1024 * 1024) throw new Error('A foto precisa ter menos de 8 MB.');
  const image = await profileImageFromFile(file),
    side = Math.min(image.naturalWidth, image.naturalHeight);
  if (!side) throw new Error('Essa imagem não parece válida.');
  const canvas = document.createElement('canvas'),
    size = 320;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, size, size);
  context.drawImage(
    image,
    (image.naturalWidth - side) / 2,
    (image.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  let data = canvas.toDataURL('image/jpeg', 0.84);
  if (data.length > 240000) data = canvas.toDataURL('image/jpeg', 0.7);
  if (data.length > 240000) throw new Error('Não consegui reduzir essa foto. Tente outra imagem.');
  return data;
}
async function saveProfilePatch(patch) {
  const res = await fetch('/api?action=profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    }),
    result = await res.json().catch(() => ({}));
  if (res.status === 401) {
    location.replace('/entrar?modo=entrar');
    throw new Error('Sua sessão terminou.');
  }
  if (!res.ok) {
    const nameErrors = {
        length: 'Use um nome com 3 a 24 caracteres.',
        characters: 'Use apenas letras, números, espaços, ponto, hífen ou apóstrofo.',
        contact: 'Não coloque e-mail, link ou contato no nome.',
        repeated: 'Evite repetir o mesmo caractere muitas vezes.',
        reserved: 'Esse nome pode ser confundido com a equipe do TOPO.',
        offensive: 'Esse nome não pode ser usado no TOPO.',
      },
      message =
        result.error === 'invalid_profile_image'
          ? 'Essa imagem não pôde ser salva.'
          : result.error === 'invalid_display_name'
            ? nameErrors[result.reason] || 'Escolha outro nome para aparecer no TOPO.'
            : result.error === 'display_name_cooldown'
              ? `Você poderá mudar o nome novamente em ${profileNameDate(result.availableAt) || '30 dias'}.`
              : 'Não consegui salvar agora.',
      error = new Error(message);
    error.code = result.error;
    error.availableAt = result.availableAt;
    throw error;
  }
  return result;
}
function setProfileName(name) {
  const publicName = String(name || 'Pessoa no TOPO'),
    heading = document.querySelector('.profileName'),
    image = document.getElementById('profileAvatarImage'),
    initial = document.getElementById('profileAvatarInitial');
  if (heading) heading.textContent = publicName;
  if (image) image.alt = `Foto de perfil de ${publicName}`;
  if (initial && image?.hidden) initial.textContent = profileInitial(publicName);
}
function bindProfileNameControl() {
  const form = document.getElementById('profileNameForm'),
    panel = document.getElementById('profileIdentityPanel'),
    status = document.getElementById('profileNameStatus');
  if (!form || !panel || !status) return;
  form.onsubmit = async (event) => {
    event.preventDefault();
    const input = document.getElementById('profileNameInput'),
      button = form.querySelector('button[type=submit]'),
      displayName = String(input?.value || '').trim();
    if (!input || !button) return;
    button.disabled = true;
    input.disabled = true;
    status.textContent = 'Salvando…';
    try {
      const result = await saveProfilePatch({ displayName }),
        savedUser = result.user || { name: displayName, canChangeName: false };
      setProfileName(savedUser.name || displayName);
      panel.outerHTML = profileNameEditorHTML(savedUser);
      bindProfileNameControl();
      toast('Nome público atualizado');
    } catch (error) {
      button.disabled = false;
      input.disabled = false;
      status.textContent = error.message || 'Não consegui salvar o nome.';
      input.focus();
    }
  };
}
function setProfileAvatar(data) {
  const image = document.getElementById('profileAvatarImage'),
    initial = document.getElementById('profileAvatarInitial'),
    remove = document.getElementById('removeProfilePhoto'),
    upload = document.getElementById('chooseProfilePhoto');
  if (!image || !initial) return;
  if (data) {
    image.src = data;
    image.hidden = false;
    initial.hidden = true;
    if (remove) remove.hidden = false;
    if (upload) upload.textContent = 'Trocar foto';
  } else {
    image.removeAttribute('src');
    image.hidden = true;
    initial.hidden = false;
    if (remove) remove.hidden = true;
    if (upload) upload.textContent = 'Adicionar foto';
  }
}
function bindProfileControls() {
  bindProfileNameControl();
  const input = document.getElementById('profilePhotoInput'),
    upload = document.getElementById('chooseProfilePhoto'),
    remove = document.getElementById('removeProfilePhoto'),
    visibility = document.getElementById('profilePhotoVisibility'),
    status = document.getElementById('profilePhotoStatus');
  if (!input || !upload || !status) return;
  upload.onclick = () => input.click();
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    upload.disabled = true;
    status.textContent = 'Preparando a foto…';
    try {
      const data = await prepareProfileAvatar(file);
      status.textContent = 'Salvando…';
      await saveProfilePatch({ avatarData: data });
      setProfileAvatar(data);
      status.textContent = 'Foto atualizada.';
      toast('Foto do perfil atualizada');
    } catch (error) {
      status.textContent = error.message || 'Não consegui salvar a foto.';
    } finally {
      input.value = '';
      upload.disabled = false;
    }
  };
  if (remove)
    remove.onclick = async () => {
      remove.disabled = true;
      status.textContent = 'Removendo…';
      try {
        await saveProfilePatch({ avatarData: null });
        setProfileAvatar(null);
        status.textContent = 'Foto removida.';
        toast('Foto removida');
      } catch (error) {
        status.textContent = error.message || 'Não consegui remover a foto.';
      } finally {
        remove.disabled = false;
      }
    };
  if (visibility)
    visibility.onchange = async () => {
      const selected = visibility.checked;
      visibility.disabled = true;
      status.textContent = 'Salvando preferência…';
      try {
        await saveProfilePatch({ showAvatarOnLeaderboard: selected });
        status.textContent = 'Preferência salva.';
      } catch (error) {
        visibility.checked = !selected;
        status.textContent = error.message || 'Não consegui salvar a preferência.';
      } finally {
        visibility.disabled = false;
      }
    };
}
async function renderProfile() {
  document.title = 'Perfil — Meu Topo — TOPO';
  if (!viewer.registered) {
    location.replace('/entrar?modo=entrar');
    return;
  }
  if (queryParams.get('criar') === '1') {
    location.replace('/vip?criar=1');
    return;
  }
  if (location.hash === '#sugerir-ranking' || location.hash === '#rankings-privados') {
    location.replace('/vip' + location.hash);
    return;
  }
  try {
    const res = await fetch('/api?action=profile&device_id=' + encodeURIComponent(deviceId), {
      cache: 'no-store',
    });
    if (res.status === 401) {
      location.replace('/entrar?modo=entrar');
      return;
    }
    if (!res.ok) throw new Error('profile_load_failed');
    const p = await res.json(),
      avatar = p.profile?.avatarData || '',
      showAvatar = p.profile?.showAvatarOnLeaderboard !== false;
    const profileSettings = `<section class="profileSection profileSettingsSection" id="perfil-publico"><div class="profileSectionHead"><div class="sectionLabel">Perfil público</div><span>nome e foto</span></div><div class="profileSettingsGrid">${profileNameEditorHTML(p.user)}<div class="profilePhotoPanel"><div class="profilePhotoTitle">Foto do perfil</div><input id="profilePhotoInput" type="file" accept="image/jpeg,image/png,image/webp" hidden><div class="profilePhotoActions"><button type="button" id="chooseProfilePhoto">${avatar ? 'Trocar foto' : 'Adicionar foto'}</button><button type="button" id="removeProfilePhoto" ${avatar ? '' : 'hidden'}>Remover</button></div><label class="profilePhotoCheck"><input id="profilePhotoVisibility" type="checkbox" ${showAvatar ? 'checked' : ''}><span>Mostrar minha foto no ranking da comunidade</span></label><p class="profilePhotoNote">A imagem é recortada antes de ser salva.</p><div class="profilePhotoStatus" id="profilePhotoStatus" aria-live="polite"></div></div></div></section>`,
      accountSection = `<section class="profileSection profileAccountSection"><div class="profileSectionHead"><div class="sectionLabel">Conta</div><span>acesso e segurança</span></div><div class="profileAccountRow"><span>E-mail de acesso</span><strong>${escapeHTML(p.user.email || '')}</strong></div><button class="logoutBtn" id="logoutBtn" type="button">Sair da conta</button></section>`;
    feed.innerHTML = `${personalAreaHeaderHTML('profile')}<section class="profileHero profileGameHero profileIdentityHero"><div class="profileHeroIntro"><div class="profileAvatarProgress"><div class="profileAvatarRing"><div class="profileAvatar"><img id="profileAvatarImage" alt="Foto de perfil de ${escapeHTML(p.user.name)}" ${avatar ? `src="${escapeHTML(avatar)}"` : 'hidden'}><span id="profileAvatarInitial" ${avatar ? 'hidden' : ''}>${escapeHTML(profileInitial(p.user.name))}</span></div></div></div><div class="profileHeroHeading"><div><span class="portalKicker">Perfil</span><h2 class="profileName">${escapeHTML(p.user.name)}</h2><p>É assim que você aparece para a comunidade do TOPO.</p></div></div></div></section>${profileSettings}${accountSection}`;
    document.getElementById('logoutBtn').onclick = logout;
    bindProfileControls();
  } catch (e) {
    console.error('Não foi possível carregar o perfil.', e);
    feed.innerHTML =
      '<div class="loading">Não consegui carregar seu perfil.<br><button class="retry" onclick="load()">Tentar de novo</button></div>';
  }
}
async function logout() {
  try {
    await fetch('/api?action=logout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    const clerk = window.Clerk || (await initClerk());
    if (clerk?.user) await clerk.signOut();
  } finally {
    location.href = '/';
  }
}
function showModal(content) {
  let layer = document.getElementById('modalLayer');
  layer.innerHTML = `<div class="modalCard">${content}</div>`;
  layer.classList.add('show');
  layer
    .querySelectorAll('[data-close]')
    .forEach((b) => (b.onclick = () => layer.classList.remove('show')));
}
function showVoteHelp() {
  if (localStorage.getItem('topo_vote_help_seen')) return;
  localStorage.setItem('topo_vote_help_seen', '1');
  showModal(
    `<div class="modalKicker">Como funciona</div><div class="modalTitle">Você mexe no ranking.</div><div class="modalText">Se concorda com a posição, deixe como está.</div><div class="howRows"><div class="howRow"><span class="howIcon up">↑</span><span class="howCopy">Acha que deveria estar mais acima.</span></div><div class="howRow"><span class="howIcon down">↓</span><span class="howCopy">Acha que deveria estar mais abaixo.</span></div><div class="howRow"><span class="howIcon double">2×</span><span class="howCopy">Depois de votar, use o pequeno botão 2× ao lado da seta para reforçar esse voto.</span></div></div><div class="modalText">Você pode mexer em até <b>20 opções, conforme o ranking</b>. Sem cadastro, pode usar <b>${viewer.anonymousLimit || DEFAULT_ANONYMOUS_LIMIT} votos livres</b> ou concluir <b>${viewer.anonymousDuelLimit || DEFAULT_ANONYMOUS_DUEL_LIMIT} Duelos</b> — vale o limite que chegar primeiro. Os votos duplos aparecem na sua atividade no Meu Topo.</div><div class="modalActions"><button class="main" data-close>Entendi</button></div>`,
  );
}
function showRegistrationWall(reason = viewer.anonymousLimitReason || 'votes') {
  const voteLimit = viewer.anonymousLimit || DEFAULT_ANONYMOUS_LIMIT,
    duelLimit = viewer.anonymousDuelLimit || DEFAULT_ANONYMOUS_DUEL_LIMIT,
    kicker =
      reason === 'votes'
        ? `${voteLimit} votos livres usados`
        : reason === 'duel_slots'
          ? `${duelLimit} Duelos já iniciados`
          : `${duelLimit} Duelos concluídos`,
    explanation =
      reason === 'votes'
        ? `Você já usou seus ${voteLimit} votos livres.`
        : reason === 'duel_slots'
          ? `Você já iniciou seus ${duelLimit} Duelos gratuitos.`
          : `Você já concluiu seus ${duelLimit} Duelos gratuitos.`;
  showModal(
    `<div class="modalKicker">${kicker}</div><div class="modalTitle">Para continuar, faça seu cadastro.</div><div class="modalText">${explanation} Entre para continuar votando e guardar seus vencedores no Meu Topo. Use Google ou receba um código por e-mail.</div><div class="modalActions"><button data-close>Agora não</button><a class="main" href="/entrar">Entrar ou criar conta</a></div>`,
  );
}
function showAccountRequired() {
  showModal(
    `<div class="modalKicker">Conta protegida</div><div class="modalTitle">Entre novamente para votar.</div><div class="modalText">Este aparelho já foi ligado a uma conta. Assim ninguém cria votos extras apenas saindo e entrando novamente.</div><div class="modalActions"><button data-close>Agora não</button><a class="main" href="/entrar">Entrar</a></div>`,
  );
}
function mountInternalShare() {
  if (pageKind() !== 'ranking' || document.querySelector('.rankingShareRow')) return;
  const r = rankings.find((x) => x.id === internalId()),
    title = feed.querySelector('.rankingMain h1, .rankingMain h2'),
    image = feed.querySelector('.rankingMain .imageStrip'),
    anchor = image || title;
  if (r && anchor)
    anchor.insertAdjacentHTML(
      'afterend',
      `<div class="rankingShareRow">${shareActionsHTML(r)}</div>`,
    );
}
async function shareRanking(button) {
  const r = rankings.find((ranking) => ranking.id === button.dataset.nativeShare);
  if (!r) return;
  const url = await trackedRankingShareURL(r.id, location.origin + rankingPath(r.id), 'native'),
    leader = r.opts?.[0]?.label || '',
    data = {
      title: r.q,
      text: `${r.q}${leader ? `\n🥇 ${leader} está no topo agora.` : ''}\nVote e mude o ranking no TOPO:`,
      url,
    };
  if (navigator.share) {
    try {
      await navigator.share(data);
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
    await navigator.clipboard.writeText(url);
    toast('Link copiado. Agora é só colar no Instagram.');
  } catch {
    toast('Não consegui abrir o compartilhamento neste navegador.');
  }
}
async function shareRankingWhatsApp(button) {
  const r = rankings.find((ranking) => ranking.id === button.dataset.whatsappShare);
  if (!r) return;
  button.setAttribute('aria-busy', 'true');
  const url = await trackedRankingShareURL(r.id, location.origin + rankingPath(r.id), 'whatsapp');
  button.removeAttribute('aria-busy');
  location.href = whatsAppShareURL(r, url);
}
function bindWhatsAppShares() {
  document.querySelectorAll('[data-whatsapp-share]').forEach((button) => {
    button.onclick = (event) => {
      event.preventDefault();
      void shareRankingWhatsApp(button);
    };
  });
}
function bindNativeShares() {
  document
    .querySelectorAll('[data-native-share]')
    .forEach((button) => (button.onclick = () => shareRanking(button)));
}
function replaceBrokenRankingImage(image) {
  if (!image?.matches?.('img[data-ranking-image]') || image.dataset.fallbackApplied) return;
  image.dataset.fallbackApplied = 'true';
  const fallback = document.createElement('span');
  fallback.className = 'portalImageFallback';
  fallback.textContent = 'TOPO';
  image.replaceWith(fallback);
}
document.addEventListener('error', (event) => replaceBrokenRankingImage(event.target), true);
function bindVotes() {
  document.querySelectorAll('button.react').forEach((b) => (b.onclick = () => react(b)));
  document
    .querySelectorAll('[data-double-vote]')
    .forEach((b) => (b.onclick = () => toggleDoubleVote(b)));
  mountInternalShare();
  bindWhatsAppShares();
  bindNativeShares();
  bindFavoriteButtons();
  bindDuelLaunchers();
  bindGooglePlaceProfiles();
}
async function refreshVoteState(rankOrder) {
  const fresh = await fetchBootstrap(),
    data = fresh.rankings || [],
    order = new Map(rankOrder.map((id, i) => [id, i]));
  viewer = fresh.viewer || viewer;
  community = communityFrom(fresh);
  rankings = data.sort((a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999));
  renderAccount();
  renderCommunityPulse();
  if (pageKind() === 'ranking') renderInternal();
  else renderHome();
}

function updateRankingPreviewCards(ranking) {
  const cards = [...document.querySelectorAll('.categoryRankCard[data-ranking-id]')].filter(
    (card) => card.dataset.rankingId === ranking.id,
  );
  if (!cards.length) return false;
  cards.forEach((card) => {
    const template = document.createElement('template');
    template.innerHTML = categoryRankCardHTML(ranking).trim();
    card.replaceWith(template.content.firstElementChild);
  });
  bindVotes();
  return true;
}

function applyVoteResult(optionId, result) {
  const ranking = rankings.find((item) =>
    item.opts?.some((option) => Number(option.id) === Number(optionId)),
  );
  const option = ranking?.opts?.find((item) => Number(item.id) === Number(optionId));
  const score = Number(result.score);
  const rankingVotes = Number(result.rankingVotes);
  const todayVotes = Number(result.todayVotes);
  const communityVotes = Number(result.communityVotes);

  if (
    !ranking ||
    !option ||
    (result.rankingId && result.rankingId !== ranking.id) ||
    ![score, rankingVotes, todayVotes, communityVotes].every(Number.isFinite)
  ) {
    return false;
  }

  const previousDirection = Number(option.mine || 0),
    nextDirection = Number(result.direction || 0),
    previousVoteCount = myVoteCount(ranking);
  option.score = score;
  option.mine = nextDirection;
  option.mineWeight = option.mine === 0 ? 1 : Number(result.weight) === 2 ? 2 : 1;
  if (previousDirection === 0 && nextDirection !== 0) ranking.myVoteCount = previousVoteCount + 1;
  else if (previousDirection !== 0 && nextDirection === 0)
    ranking.myVoteCount = Math.max(0, previousVoteCount - 1);
  ranking.votes = rankingVotes;
  ranking.todayVotes = todayVotes;
  ranking.opts.sort((a, b) => b.score - a.score || a.originalPosition - b.originalPosition);
  community.votes = communityVotes;
  if (result.viewer) viewer = result.viewer;

  renderAccount();
  renderCommunityPulse();
  if (pageKind() === 'ranking') renderInternal();
  else if (!updateRankingPreviewCards(ranking)) renderHome();
  return true;
}

async function submitVoteChange(button, { optionId, direction, weight, showHelp = false }) {
  const rankOrder = rankings.map((r) => r.id),
    rankingForVote = rankings.find((ranking) =>
      ranking.opts?.some((option) => Number(option.id) === Number(optionId)),
    ),
    controls = [
      ...((button.closest('[data-duel-pair]') || button.closest('.actions'))?.querySelectorAll(
        'button',
      ) || [button]),
    ];
  controls.forEach((item) => (item.disabled = true));
  try {
    const res = await fetch('/api', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          option_id: optionId,
          direction,
          weight,
          referral_token: incomingShareReferralToken(rankingForVote?.id),
        }),
      }),
      result = await res.json();
    if (res.status === 403 && result.error === 'registration_required') {
      if (result.viewer) viewer = result.viewer;
      const reason = result.reason || viewer.anonymousLimitReason || 'votes';
      if (reason === 'votes' && !result.viewer) {
        viewer.anonymousUsed = viewer.anonymousLimit || DEFAULT_ANONYMOUS_LIMIT;
        viewer.anonymousAccessExhausted = true;
      } else if (reason === 'duels' && !result.viewer) {
        viewer.anonymousDuelsUsed = viewer.anonymousDuelLimit || DEFAULT_ANONYMOUS_DUEL_LIMIT;
        viewer.anonymousAccessExhausted = true;
      }
      renderAccount();
      showRegistrationWall(reason);
      return false;
    }
    if (res.status === 403 && result.error === 'account_required_on_this_device') {
      viewer.votingRequiresAccount = true;
      renderAccount();
      showAccountRequired();
      return false;
    }
    if (res.status === 403 && result.error === 'vip_password_required') {
      const ranking = rankings.find((item) =>
        item.opts?.some((option) => Number(option.id) === Number(optionId)),
      );
      if (ranking?.vip) renderVipGate({ id: ranking.id, q: ranking.q, img: ranking.img });
      return false;
    }
    if (
      (res.status === 403 && result.error === 'double_vote_requires_account') ||
      (res.status === 409 &&
        ['double_vote_locked', 'double_vote_limit', 'double_vote_requires_vote'].includes(
          result.error,
        ))
    ) {
      await refreshVoteState(rankOrder);
      return false;
    }
    if (res.status === 409 && result.error === 'ranking_vote_limit') {
      toast(`Máximo de ${result.limit || 10} votos neste ranking`);
      return false;
    }
    if (res.status === 409 && result.error === 'ranking_voting_closed') {
      toast('A votação deste ranking foi encerrada');
      await refreshVoteState(rankOrder);
      return false;
    }
    if (res.status === 409 && result.error === 'device_rekey_required') {
      rotateDeviceId();
      await load();
      toast('Conta protegida. Tente votar novamente.');
      return false;
    }
    if (!res.ok) throw result;
    if (!applyVoteResult(optionId, result)) await refreshVoteState(rankOrder);
    else if (pageKind() !== 'ranking')
      document
        .querySelector(
          `.categoryRankCard .react[data-id="${optionId}"][data-dir="${button.dataset.dir}"]`,
        )
        ?.focus();
    if (viewer.registered) void loadNotifications({ force: true });
    if (showHelp && direction !== 0) showVoteHelp();
    return true;
  } catch (e) {
    toast('Não consegui registrar. Tente novamente.');
    return false;
  } finally {
    controls.forEach((item) => (item.disabled = false));
  }
}
function react(button) {
  const optionId = Number(button.dataset.id),
    mine = Number(button.dataset.mine),
    clicked = Number(button.dataset.dir),
    direction = mine === clicked ? 0 : clicked;
  return submitVoteChange(button, { optionId, direction, weight: 1, showHelp: mine === 0 });
}
function toggleDoubleVote(button) {
  const optionId = Number(button.dataset.id),
    direction = Number(button.dataset.dir),
    active = button.dataset.active === '1';
  return submitVoteChange(button, { optionId, direction, weight: active ? 1 : 2 });
}
function moderationDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'data indisponível'
    : date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
}
function moderationCategoryOptions(selected) {
  const needsChoice = !groupNames.includes(selected) || selected === 'Todos';
  return (
    `<option value="" ${needsChoice ? 'selected' : ''} disabled>Escolha uma categoria</option>` +
    groupNames
      .filter((name) => name !== 'Todos')
      .map(
        (name) =>
          `<option value="${escapeHTML(name)}" ${name === selected ? 'selected' : ''}>${escapeHTML(name)}</option>`,
      )
      .join('')
  );
}
function rankingIdeaExamples(item) {
  const examples = Array.isArray(item.exampleOptions) ? item.exampleOptions : [];
  return item.category === 'A definir' ? [] : examples;
}
function moderationRankingReviewHTML(item) {
  return `<div class="moderationRankingReview"><p><strong>Aprove apenas o nome e a categoria.</strong> Depois eu crio os 14 itens, escolho a foto e publico para você.</p><div><label class="suggestionField"><span>Nome final do ranking</span><input data-ranking-title type="text" minlength="8" maxlength="120" value="${escapeHTML(item.title)}" required></label><label class="suggestionField"><span>Categoria</span><select data-ranking-category required>${moderationCategoryOptions(item.category)}</select></label></div></div>`;
}
function moderationCreationReadyHTML() {
  return `<div class="moderationCreationReady"><strong>Pronto para eu criar</strong><span>Nome e categoria aprovados. Você não precisa montar nem revisar a lista: eu preparo os 14 itens, escolho a foto e publico.</span></div>`;
}
function moderationOptionReviewHTML(item) {
  const options = Array.isArray(item.existingOptions) ? item.existingOptions : [],
    match = item.possibleDuplicate || null,
    percent = match ? Math.round(Number(match.similarity || 0) * 100) : 0,
    choices =
      `<option value="" ${match ? '' : 'selected'}>Escolha uma opção existente</option>` +
      options
        .map(
          (option) =>
            `<option value="${escapeHTML(String(option.optionId))}" ${String(option.optionId) === String(match?.optionId) ? 'selected' : ''}>${escapeHTML(option.label)}</option>`,
        )
        .join('');
  return `<div class="moderationOptionReview"><label class="suggestionField"><span>Nome que entrará no ranking</span><input data-option-label type="text" minlength="2" maxlength="80" value="${escapeHTML(item.label)}" required><small>Corrija a grafia aqui antes de aprovar.</small></label>${match ? `<div class="moderationDuplicateHint"><strong>Possível duplicata</strong><span>Pode ser “${escapeHTML(match.label)}” · ${percent}% parecido. Confira antes de decidir.</span></div>` : '<p class="moderationDuplicateClear">Nenhuma opção muito parecida foi detectada automaticamente.</p>'}<label class="suggestionField moderationDuplicateTarget"><span>Se já existe, escolha qual opção</span><select data-duplicate-target>${choices}</select></label></div>`;
}
function moderationCardHTML(item) {
  const isOption = item.kind === 'option',
    ready = !isOption && item.status === 'approved',
    status = ready
      ? { label: 'Pronto para criação', className: 'approved' }
      : suggestionStatusInfo(item.status),
    pending = item.status === 'pending',
    target = queryParams.get('tipo') === item.kind && queryParams.get('id') === item.id,
    examples = isOption
      ? Array.isArray(item.exampleOptions)
        ? item.exampleOptions
        : []
      : rankingIdeaExamples(item),
    title = isOption ? item.label : item.title,
    context = isOption
      ? `Para “${item.question}”`
      : item.category === 'A definir'
        ? 'Escolha a categoria antes de aprovar'
        : item.category,
    publishedLink =
      !isOption && item.status === 'published' && item.publishedRankingId
        ? `<div class="moderationPublished"><a href="${rankingPath(item.publishedRankingId)}">Abrir ranking publicado →</a></div>`
        : '';
  return `<article class="moderationCard ${target ? 'targeted' : ''} ${ready ? 'preparing' : ''}" id="sugestao-${escapeHTML(item.id)}" data-status="${escapeHTML(item.status)}"><div class="moderationCardHead"><div><span class="moderationKind">${isOption ? 'Opção sugerida' : 'Ideia de ranking'}</span><h3>${escapeHTML(title)}</h3><p>${escapeHTML(context || '')}</p></div><span class="suggestionStatus ${status.className}">${status.label}</span></div>${pending && isOption ? moderationOptionReviewHTML(item) : ''}${pending && !isOption ? moderationRankingReviewHTML(item) : ''}${examples.length && !ready ? `<div class="moderationExamples"><strong>Opções iniciais</strong><ol>${examples.map((option) => `<li>${escapeHTML(option)}</li>`).join('')}</ol></div>` : ''}${item.flagReason ? `<div class="moderationFlag"><strong>Revisar com atenção</strong><span>${escapeHTML(item.flagReason)}</span></div>` : ''}<div class="moderationMeta"><span>Por <strong>${escapeHTML(item.userName || 'Pessoa')}</strong> · ${escapeHTML(item.userEmail || '')}</span><time>${moderationDate(item.createdAt)}</time></div>${item.moderationNote ? `<div class="moderationNote"><strong>Nota da moderação:</strong> ${escapeHTML(item.moderationNote)}</div>` : ''}${pending ? `<div class="moderationActions"><button class="approve" type="button" data-moderate data-kind="${item.kind}" data-id="${escapeHTML(item.id)}" data-decision="approve">${isOption ? 'Aprovar e incluir' : 'Aprovar nome e categoria'}</button>${isOption ? `<button class="duplicate" type="button" data-moderate data-kind="option" data-id="${escapeHTML(item.id)}" data-decision="duplicate">Já existe</button>` : ''}<button class="reject" type="button" data-moderate data-kind="${item.kind}" data-id="${escapeHTML(item.id)}" data-decision="reject">Recusar</button></div>` : ''}${ready ? moderationCreationReadyHTML() : ''}${publishedLink}</article>`;
}
function moderationNameCardHTML(item) {
  const pending = item.status === 'pending',
    status = suggestionStatusInfo(item.status),
    target = queryParams.get('tipo') === 'name' && queryParams.get('id') === item.id,
    changed = item.currentName && item.currentName !== item.reportedName,
    reports = Math.max(1, Number(item.pendingReports || 1));
  return `<article class="moderationCard moderationNameCard ${target ? 'targeted' : ''}" id="sugestao-${escapeHTML(item.id)}" data-status="${escapeHTML(item.status)}" data-reported-name="${escapeHTML(item.reportedName)}"><div class="moderationCardHead"><div><span class="moderationKind">Nome denunciado</span><h3>${escapeHTML(item.reportedName || 'Sem nome')}</h3><p>${pending ? `${reports} denúncia${reports === 1 ? '' : 's'} pendente${reports === 1 ? '' : 's'}` : 'Denúncia analisada'}${changed ? ` · atualmente aparece como “${escapeHTML(item.currentName)}”` : ''}</p></div><span class="suggestionStatus ${status.className}">${status.label}</span></div><div class="moderationMeta"><span>Enviado por <strong>${escapeHTML(item.userName || 'Pessoa')}</strong> · ${escapeHTML(item.userEmail || '')}</span><time>${moderationDate(item.createdAt)}</time></div>${item.moderationNote ? `<div class="moderationNote"><strong>Nota da moderação:</strong> ${escapeHTML(item.moderationNote)}</div>` : ''}${pending ? `<div class="moderationActions"><button class="reject" type="button" data-moderate data-kind="name" data-id="${escapeHTML(item.id)}" data-decision="remove">Substituir por nome neutro</button><button class="duplicate" type="button" data-moderate data-kind="name" data-id="${escapeHTML(item.id)}" data-decision="dismiss">Manter este nome</button></div>` : ''}</article>`;
}
function moderationSectionHTML(title, items, emptyText) {
  return `<section class="moderationSection"><div class="moderationSectionHead"><h2>${title}</h2><span>${items.length}</span></div>${items.length ? `<div class="moderationList">${items.map((item) => (item.kind === 'name' ? moderationNameCardHTML(item) : moderationCardHTML(item))).join('')}</div>` : `<div class="moderationEmpty">${emptyText}</div>`}</section>`;
}
function moderationPanelTabsHTML(active) {
  return `<nav class="moderationPanelTabs" aria-label="Áreas da curadoria"><a class="${active === 'queue' ? 'active' : ''}" href="/moderacao" ${active === 'queue' ? 'aria-current="page"' : ''}>Curadoria</a><a class="${active === 'rankings' ? 'active' : ''}" href="/moderacao?aba=rankings" ${active === 'rankings' ? 'aria-current="page"' : ''}>Mais votados</a><a class="${active === 'users' ? 'active' : ''}" href="/moderacao?aba=usuarios" ${active === 'users' ? 'aria-current="page"' : ''}>Usuários</a></nav>`;
}
function moderationRankingLeaderboardRowHTML(ranking, index) {
  const position = Number(ranking.position || index + 1),
    votes = Math.max(0, Number(ranking.votes || 0)),
    todayVotes = Math.max(0, Number(ranking.todayVotes || 0));
  return `<a class="moderationRankingLeaderboardRow ${position <= 3 ? `top${position}` : ''}" href="${rankingPath(ranking.id)}"><span class="moderationRankingPosition">${position}</span><img class="moderationRankingCover" src="${escapeHTML(ranking.imageUrl || '')}" alt="" loading="lazy"><span class="moderationRankingCopy"><strong>${escapeHTML(ranking.question || 'Ranking sem título')}</strong><small>${escapeHTML(ranking.category || 'Sem categoria')}${todayVotes ? ` · +${fmt(todayVotes)} hoje` : ''}</small></span><span class="moderationRankingVotes"><strong>${fmt(votes)}</strong><small>votos</small></span><span class="moderationRankingOpen" aria-hidden="true">→</span></a>`;
}
function moderationRankingsPageHTML(data) {
  const rankings = Array.isArray(data.rankings) ? data.rankings : [],
    total = Number(data.total ?? rankings.length),
    totalVotes = Number(
      data.totalVotes ?? rankings.reduce((sum, ranking) => sum + Number(ranking.votes || 0), 0),
    ),
    leaderVotes = Number(rankings[0]?.votes || 0),
    list = rankings.map(moderationRankingLeaderboardRowHTML).join('');
  return `<header class="moderationHero moderationRankingsHero"><span class="suggestionEyebrow">Curadoria</span><h1>Ranking dos rankings</h1><p>Todos os rankings públicos do TOPO, do mais votado ao menos votado. A ordem e os totais são atualizados com os votos da comunidade.</p><div class="moderationUserSummary moderationRankingSummary"><span><strong>${fmt(total)}</strong> rankings</span><span><strong>${fmt(totalVotes)}</strong> votos no total</span><span><strong>${fmt(leaderVotes)}</strong> no primeiro lugar</span></div></header><section class="moderationSection moderationRankingLeaderboardSection"><div class="moderationSectionHead"><h2>Mais votados de todos</h2><span>${fmt(total)}</span></div>${list ? `<div class="moderationRankingLeaderboard">${list}</div>` : '<div class="moderationEmpty">Ainda não há rankings públicos.</div>'}</section>`;
}
function moderationUserDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Data indisponível'
    : date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
}
function moderationUserInitials(name) {
  const parts = String(name || 'Pessoa')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return `${parts[0]?.[0] || 'P'}${parts.length > 1 ? parts.at(-1)?.[0] || '' : ''}`
    .toUpperCase()
    .slice(0, 2);
}
function moderationUserRowHTML(user) {
  const name = String(user.name || 'Pessoa no TOPO'),
    email = String(user.email || ''),
    votes = Math.max(0, Number(user.votes || 0)),
    rankingsCount = Math.max(0, Number(user.rankings || 0)),
    searchText = foldText(`${name} ${email}`);
  return `<article class="moderationUserRow" data-moderation-user data-user-search="${escapeHTML(searchText)}"><div class="moderationUserPerson"><span class="moderationUserAvatar" aria-hidden="true">${escapeHTML(moderationUserInitials(name))}</span><span><strong>${escapeHTML(name)}</strong>${user.isModerator ? '<small>Moderador</small>' : ''}</span></div><div class="moderationUserEmail"><span class="moderationUserFieldLabel">E-mail</span><span>${escapeHTML(email)}</span></div><div class="moderationUserCreated"><span class="moderationUserFieldLabel">Cadastro</span><time datetime="${escapeHTML(user.createdAt || '')}">${moderationUserDate(user.createdAt)}</time></div><div class="moderationUserMetric"><span class="moderationUserFieldLabel">Votos</span><strong>${fmt(votes)}</strong></div><div class="moderationUserMetric"><span class="moderationUserFieldLabel">Rankings</span><strong>${fmt(rankingsCount)}</strong></div></article>`;
}
function moderationUsersPageHTML(data) {
  const users = Array.isArray(data.users) ? data.users : [],
    total = Math.max(0, Number(data.total ?? users.length)),
    recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000,
    newUsers = users.filter((user) => {
      const createdAt = new Date(user.createdAt).getTime();
      return Number.isFinite(createdAt) && createdAt >= recentCutoff;
    }).length,
    votes = users.reduce((sum, user) => sum + Math.max(0, Number(user.votes || 0)), 0),
    list = users.map(moderationUserRowHTML).join('');
  return `<header class="moderationHero moderationUsersHero"><span class="suggestionEyebrow">Painel privado</span><h1>Usuários cadastrados</h1><p>Aqui estão todas as contas criadas no Somos Topo.</p><div class="moderationUserSummary"><span><strong>${fmt(total)}</strong> cadastrados</span><span><strong>${fmt(newUsers)}</strong> novos em 7 dias</span><span><strong>${fmt(votes)}</strong> votos dados</span></div></header><section class="moderationSection moderationUsersSection"><div class="moderationSectionHead"><h2>Todos os usuários</h2><span id="moderationUserResultCount">${fmt(users.length)}</span></div>${users.length ? `<form class="moderationUserSearch" id="moderationUserSearchForm" role="search"><label for="moderationUserSearch">Buscar cadastro</label><input id="moderationUserSearch" type="search" autocomplete="off" placeholder="Buscar por nome ou e-mail"><small id="moderationUserSearchStatus" aria-live="polite">${fmt(users.length)} de ${fmt(total)} pessoas</small></form><div class="moderationUserTableHead" aria-hidden="true"><span>Pessoa</span><span>E-mail</span><span>Cadastro</span><span>Votos</span><span>Rankings</span></div><div class="moderationUserList">${list}</div><div class="moderationEmpty" id="moderationUserNoResults" hidden>Nenhum cadastro encontrado.</div>` : '<div class="moderationEmpty">Ainda não há usuários cadastrados.</div>'}</section>`;
}
function bindModerationUserSearch() {
  const form = document.getElementById('moderationUserSearchForm'),
    input = document.getElementById('moderationUserSearch'),
    status = document.getElementById('moderationUserSearchStatus'),
    resultCount = document.getElementById('moderationUserResultCount'),
    empty = document.getElementById('moderationUserNoResults'),
    rows = [...document.querySelectorAll('[data-moderation-user]')];
  if (!form || !input) return;
  form.onsubmit = (event) => event.preventDefault();
  input.oninput = () => {
    const query = foldText(input.value.trim());
    let visible = 0;
    rows.forEach((row) => {
      const matches = !query || String(row.dataset.userSearch || '').includes(query);
      row.hidden = !matches;
      if (matches) visible += 1;
    });
    if (status) status.textContent = `${fmt(visible)} de ${fmt(rows.length)} pessoas`;
    if (resultCount) resultCount.textContent = fmt(visible);
    if (empty) empty.hidden = visible !== 0;
  };
}
function bindModerationActions() {
  document.querySelectorAll('[data-moderate]').forEach((button) => {
    button.onclick = async () => {
      const card = button.closest('.moderationCard'),
        kind = button.dataset.kind,
        decision = button.dataset.decision,
        id = button.dataset.id,
        isOption = kind === 'option',
        isName = kind === 'name',
        label = isOption ? card?.querySelector('[data-option-label]')?.value.trim() || '' : '',
        rankingTitle =
          !isOption && !isName
            ? card?.querySelector('[data-ranking-title]')?.value.trim() || ''
            : '',
        rankingCategory =
          !isOption && !isName ? card?.querySelector('[data-ranking-category]')?.value || '' : '',
        duplicateSelect = isOption ? card?.querySelector('[data-duplicate-target]') : null,
        duplicateOptionId = duplicateSelect?.value || '',
        duplicateLabel = duplicateSelect?.selectedOptions?.[0]?.textContent || '';
      let note = '';
      if (isName) {
        const reportedName = card?.dataset.reportedName || 'este nome';
        if (
          !window.confirm(
            decision === 'remove'
              ? `Substituir “${reportedName}” por um nome neutro? A pessoa poderá escolher outro nome válido imediatamente.`
              : `Manter “${reportedName}” e arquivar as denúncias pendentes?`,
          )
        )
          return;
      } else if (decision === 'approve') {
        if (isOption && ([...label].length < 2 || [...label].length > 80)) {
          toast('Revise o nome da opção');
          return;
        }
        if (
          !isOption &&
          ([...rankingTitle].length < 8 ||
            [...rankingTitle].length > 120 ||
            !groupNames.includes(rankingCategory))
        ) {
          toast('Revise o nome e escolha a categoria');
          return;
        }
        const message = isOption
          ? `Aprovar “${label}” e incluir no final do ranking com zero pontos?`
          : `Aprovar “${rankingTitle}” na categoria ${rankingCategory}? Depois eu criarei os 14 itens, a foto e publicarei.`;
        if (!window.confirm(message)) return;
      } else if (decision === 'duplicate') {
        if (!duplicateOptionId) {
          toast('Escolha a opção que já existe');
          return;
        }
        if (
          !window.confirm(
            `Marcar como já existente em “${duplicateLabel}”? Nenhum item novo será criado.`,
          )
        )
          return;
      } else {
        const answer = window.prompt(
          'Se quiser, escreva o motivo da recusa. A pessoa verá essa nota no Meu Topo:',
          '',
        );
        if (answer === null) return;
        note = answer.trim();
      }
      card?.querySelectorAll('button').forEach((item) => (item.disabled = true));
      try {
        const payload = { kind, id, decision, note };
        if (isOption && decision === 'approve') payload.label = label;
        if (!isOption && decision === 'approve') {
          payload.title = rankingTitle;
          payload.category = rankingCategory;
        }
        if (isOption && decision === 'duplicate') payload.duplicateOptionId = duplicateOptionId;
        const response = await fetch('/api?action=moderation', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          }),
          result = await response.json().catch(() => ({}));
        if (response.status === 401) {
          location.assign(
            `/entrar?voltar=${encodeURIComponent(location.pathname + location.search)}`,
          );
          return;
        }
        if (!response.ok) throw result;
        toast(
          isName
            ? result.decision === 'remove'
              ? 'Nome substituído por uma opção neutra'
              : 'Denúncia de nome arquivada'
            : decision === 'approve' && !isOption
              ? 'Nome e categoria aprovados. Pronto para criação.'
              : decision === 'approve'
                ? 'Sugestão aprovada'
                : decision === 'duplicate'
                  ? 'Marcada como já existente'
                  : 'Sugestão recusada',
        );
        await renderModeration();
      } catch (error) {
        card?.querySelectorAll('button').forEach((item) => (item.disabled = false));
        if (error?.error === 'name_report_already_reviewed') {
          toast('Essa denúncia já foi analisada');
        } else if (error?.error === 'option_already_exists') {
          const targetId = String(error?.option?.optionId || '');
          if (targetId && duplicateSelect) duplicateSelect.value = targetId;
          toast('Essa opção já existe. Use “Já existe”.');
        } else if (error?.error === 'ranking_already_exists')
          toast('Já existe um ranking ou uma ideia aprovada com esse nome.');
        else
          toast(
            error?.error === 'suggestion_already_reviewed'
              ? 'Essa sugestão já foi analisada'
              : 'Não consegui salvar a decisão',
          );
      }
    };
  });
}
async function renderModeration() {
  const requestedTab = queryParams.get('aba'),
    activeTab =
      requestedTab === 'usuarios' ? 'users' : requestedTab === 'rankings' ? 'rankings' : 'queue';
  document.title =
    activeTab === 'users'
      ? 'Usuários cadastrados — TOPO'
      : activeTab === 'rankings'
        ? 'Rankings mais votados — TOPO'
        : 'Curadoria — TOPO';
  if (!viewer.registered) {
    location.replace(`/entrar?voltar=${encodeURIComponent(location.pathname + location.search)}`);
    return;
  }
  feed.innerHTML = pageLoadingHTML('moderation');
  try {
    const action =
        activeTab === 'users'
          ? 'moderation-users'
          : activeTab === 'rankings'
            ? 'moderation-rankings'
            : 'moderation',
      response = await fetch(`/api?action=${action}`, { cache: 'no-store' }),
      data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      location.replace(`/entrar?voltar=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    if (response.status === 403) {
      feed.innerHTML =
        '<div class="internalHead"><a class="backLink" href="/vip">← Meu Topo</a></div><section class="moderationAccessDenied"><span class="suggestionEyebrow">Área privada</span><h1>Esta conta não tem acesso à moderação.</h1><p>Entre com o e-mail cadastrado como moderador do TOPO.</p></section>';
      return;
    }
    if (!response.ok) throw data;
    const panelHead = `<div class="internalHead"><a class="backLink" href="/vip">← Meu Topo</a><span class="internalMeta">${escapeHTML(data.moderator?.email || '')}</span></div>${moderationPanelTabsHTML(activeTab)}`;
    if (activeTab === 'users') {
      feed.innerHTML = `${panelHead}${moderationUsersPageHTML(data)}<div class="end"><a class="backLink" href="/vip">← voltar ao Meu Topo</a></div>`;
      bindModerationUserSearch();
      return;
    }
    if (activeTab === 'rankings') {
      feed.innerHTML = `${panelHead}${moderationRankingsPageHTML(data)}<div class="end"><a class="backLink" href="/vip">← voltar ao Meu Topo</a></div>`;
      return;
    }
    const optionPending = (data.options || []).filter((item) => item.status === 'pending'),
      rankingPending = (data.rankings || []).filter((item) => item.status === 'pending'),
      namePending = [
        ...new Map(
          (data.names || [])
            .filter((item) => item.status === 'pending')
            .map((item) => [`${item.reportedUserId}:${item.reportedName}`, item]),
        ).values(),
      ],
      approvedRankings = (data.rankings || []).filter((item) => item.status === 'approved'),
      reviewed = [...(data.options || []), ...(data.rankings || []), ...(data.names || [])]
        .filter(
          (item) =>
            item.status !== 'pending' && !(item.kind === 'ranking' && item.status === 'approved'),
        )
        .sort(
          (a, b) => new Date(b.reviewedAt || b.createdAt) - new Date(a.reviewedAt || a.createdAt),
        )
        .slice(0, 40),
      total = optionPending.length + rankingPending.length + namePending.length,
      heroMessage = total
        ? `${total} sugestão${total === 1 ? ' aguarda' : ' aguardam'} sua análise.`
        : approvedRankings.length
          ? `${approvedRankings.length} ranking${approvedRankings.length === 1 ? ' está' : 's estão'} pronto${approvedRankings.length === 1 ? '' : 's'} para eu criar.`
          : 'Tudo analisado por enquanto.';
    feed.innerHTML = `${panelHead}<header class="moderationHero"><span class="suggestionEyebrow">Painel privado</span><h1>Curadoria da comunidade</h1><p>${heroMessage}</p><div class="moderationCounts"><span><strong>${optionPending.length}</strong> opções</span><span><strong>${rankingPending.length}</strong> novos rankings</span><span><strong>${namePending.length}</strong> nomes</span><span><strong>${approvedRankings.length}</strong> para criar</span></div></header>${moderationSectionHTML('Nomes denunciados', namePending, 'Nenhum nome esperando análise.')}${moderationSectionHTML('Opções para rankings', optionPending, 'Nenhuma opção esperando análise.')}${moderationSectionHTML('Ideias de novos rankings', rankingPending, 'Nenhuma ideia de ranking esperando análise.')}${moderationSectionHTML('Prontos para criação', approvedRankings, 'Nenhum ranking aprovado aguardando criação.')}${moderationSectionHTML('Analisadas recentemente', reviewed, 'As decisões recentes aparecerão aqui.')}<div class="end"><a class="backLink" href="/vip">← voltar ao Meu Topo</a></div>`;
    bindModerationActions();
    const targetId = queryParams.get('id'),
      target = targetId ? document.getElementById(`sugestao-${targetId}`) : null;
    target?.scrollIntoView({ block: 'center' });
  } catch (error) {
    console.error('Não foi possível abrir a moderação.', error);
    feed.innerHTML =
      '<div class="loading">Não consegui carregar a moderação.<br><button class="retry" onclick="renderModeration()">Tentar de novo</button></div>';
  }
}
async function boot() {
  const kind = pageKind(),
    hasClerkSession = document.cookie
      .split(';')
      .some((part) => part.trim().startsWith('__session='));
  if (feed.dataset.serverRendered !== 'true') feed.innerHTML = pageLoadingHTML(kind);
  if (kind === 'not-found') {
    revealClientPage();
    return;
  }
  if (kind === 'auth') await initClerk(true);
  else if (kind === 'profile' || kind === 'moderation' || hasClerkSession) await initClerk();
  await load();
}
window.addEventListener('popstate', () => {
  if (pageKind() !== 'ranking') return;
  const ranking = rankings.find((item) => item.id === internalId());
  if (ranking) renderRankingVoteExperience(ranking);
});
boot();
