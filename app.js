const feed = document.getElementById('feed'),
  groupsEl = document.getElementById('groups'),
  accountEl = document.getElementById('account'),
  sitePulseEl = document.getElementById('sitePulse'),
  searchForm = document.getElementById('siteSearchForm'),
  searchInput = document.getElementById('rankingSearch'),
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
const queryParams = new URLSearchParams(location.search);
const CATEGORY_PAGE_SIZE = 12;
const DEFAULT_ANONYMOUS_LIMIT = 10;
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
  Famosos: 'famosos',
  Natureza: 'natureza',
  Motores: 'motores',
  Esporte: 'esporte',
  Jogos: 'jogos',
  Tecnologia: 'tecnologia',
  Produtos: 'produtos',
  Vida: 'vida',
});
function generalGroupFromRoute() {
  const match = location.pathname.match(/^\/categoria\/([^/]+)\/?$/);
  if (!match) return '';
  return Object.entries(generalGroupSlugs).find(([, slug]) => slug === match[1])?.[0] || '';
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
  activeGroup = generalGroupFromRoute() || localRouteState().group || 'Todos',
  homePortal = !isLocalRoute() && !isCategoryRoute(),
  homeSearch = (queryParams.get('busca') || '').trim(),
  categorySort = 'priority',
  categoryVisibleCount = CATEGORY_PAGE_SIZE,
  allItemsOpen = false,
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
    rankingLimit: 20,
    votingRequiresAccount: false,
  },
  community = { rankings: 0, votes: 0, users: 0 },
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
    'Famosos',
    'Natureza',
    'Motores',
    'Esporte',
    'Jogos',
    'Tecnologia',
    'Produtos',
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
async function initClerk() {
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
    await loadExternalScript(`${base}/npm/@clerk/clerk-js@6.29.3/dist/clerk.browser.js`, {
      'data-clerk-publishable-key': config.publishableKey,
    });
    if (!window.Clerk) throw new Error('clerk_unavailable');
    await window.Clerk.load();
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
  return (r?.opts || []).reduce((n, o) => n + (Number(o.mine) !== 0 ? 1 : 0), 0);
}
function priorityBucket(r) {
  const n = myVoteCount(r),
    limit = Number(viewer.rankingLimit || 20);
  if (n === 0) return 0;
  if (n < limit) return 1;
  return 2;
}
function smartShuffle(list) {
  return [...list]
    .map((r) => ({ r, p: priorityBucket(r), x: Math.random() }))
    .sort((a, b) => a.p - b.p || a.x - b.x)
    .map((x) => x.r);
}
function newBadgeHTML(r) {
  return isNewRanking(r) ? '<span class="newBadge">Novo</span>' : '';
}
function pageKind() {
  if (location.pathname.startsWith('/ranking/')) return 'ranking';
  if (
    ['/entrar', '/recuperar-senha', '/redefinir-senha', '/sso-callback'].includes(location.pathname)
  )
    return 'auth';
  if (location.pathname === '/perfil') return 'profile';
  if (location.pathname === '/moderacao') return 'moderation';
  if (location.pathname === '/vip') return 'vip';
  return 'home';
}
function isLocalRoute() {
  return location.pathname === '/local' || location.pathname.startsWith('/local/');
}
function isCategoryRoute() {
  return location.pathname === '/categoria' || location.pathname.startsWith('/categoria/');
}
function isVipRoute() {
  return location.pathname === '/vip';
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
document.body.classList.toggle('profilePage', pageKind() === 'profile');
document.body.classList.toggle('moderationPage', pageKind() === 'moderation');
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
      'Motores',
      'Tecnologia',
      'Produtos',
      'TV & Séries',
      'Nostalgia',
    ].includes(r.cat)
  )
    return r.cat;
  if (r.cat === 'TV') return 'TV & Séries';
  if (['Pessoas', 'Famosos'].includes(r.cat)) return 'Famosos';
  if (r.cat === 'Cultura') return 'Arte';
  if (['Comida', 'Café'].includes(r.cat)) return 'Comida';
  if (['Viagem', 'Brasil'].includes(r.cat) || topoLocal.normalizeCity(r.cat)) return 'Lugares';
  if (['Animais', 'Plantas'].includes(r.cat)) return 'Natureza';
  if (r.cat === 'Carros') return 'Motores';
  if (r.cat === 'Esporte') return 'Esporte';
  if (r.cat === 'Tecnologia') return 'Tecnologia';
  if (r.cat === 'Produtos') return 'Produtos';
  return 'Vida';
}
function categoryLabel(r) {
  if (categoryLabelOverrides[r.id]) return categoryLabelOverrides[r.id];
  if (r.cat === 'TV') return 'TV & Séries';
  if (r.cat === 'Pessoas') return 'Famosos';
  if (r.cat === 'Cotidiano') return 'Vida';
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
    accountEl.innerHTML = `<div class="notificationShell"><button class="notificationButton" id="notificationButton" type="button" aria-haspopup="dialog" aria-expanded="false"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"></path><path d="M10 21h4"></path></svg><span class="notificationBadge" id="notificationBadge" hidden></span></button><section class="notificationPanel" id="notificationPanel" aria-label="Suas notificações" hidden></section></div><a class="accountLink" href="/perfil">Perfil</a>`;
    bindNotificationBell();
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
    accountEl.innerHTML = `<a class="accountLink accountEnter" href="/entrar">Entrar</a><span class="voteMeter">${viewer.privateVoting && isVipExperience() ? 'acesso privado' : viewer.votingRequiresAccount ? 'entre para votar' : `${fmt(viewer.anonymousUsed || 0)}/${viewer.anonymousLimit || DEFAULT_ANONYMOUS_LIMIT} votos`}</span>`;
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
function renderCityPicker() {
  const cities = topoLocal.availableCities(rankings),
    shouldShow = isLocalExperience() && pageKind() === 'home' && cities.length > 0;
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
  detectedCity = String(locationData.city || '');
  const routeCity = localRouteState().city;
  let savedCity = '';
  try {
    savedCity = localStorage.getItem(cityStoreKey) || '';
  } catch {}
  selectedCity = topoLocal.resolvePreferredCity(rankings, routeCity || savedCity, detectedCity);
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
  if (homeSearch) url.searchParams.set('busca', homeSearch);
  else url.searchParams.delete('busca');
  history.replaceState(null, '', url.pathname + url.search + url.hash);
  queryParams.delete('busca');
  if (homeSearch) queryParams.set('busca', homeSearch);
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
    if (pageKind() !== 'home' || location.pathname !== '/') return;
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
  const res = await fetch('/api?device_id=' + encodeURIComponent(deviceId), { cache: 'no-store' });
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
      : '<span class="vipCardFallback" aria-hidden="true">VIP</span>',
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

function vipOptionInputHTML(index, value = '') {
  return `<div class="vipOptionInputRow"><span>${index + 1}</span><input class="vipOptionInput" type="text" minlength="2" maxlength="80" autocomplete="off" value="${escapeHTML(value)}" placeholder="Nome ou opção ${index + 1}" aria-label="Nome ou opção ${index + 1}" required><button type="button" data-remove-vip-option aria-label="Remover nome ou opção ${index + 1}">×</button></div>`;
}

function vipInitialOptionInputsHTML() {
  return ['', '', ''].map((value, index) => vipOptionInputHTML(index, value)).join('');
}

function vipCreatePanelHTML(open = false) {
  return `<section class="vipCreatePanel" id="vipCreatePanel" ${open ? '' : 'hidden'}><div class="vipCreateIntro"><span class="portalKicker">Só para o seu grupo</span><h2>Crie seu ranking privado</h2><p>Escreva a pergunta, inclua os nomes e escolha a senha que você enviará para o grupo.</p></div><form class="vipCreateForm" id="vipCreateForm"><label for="vipCreateTitle">Pergunta ou título</label><input class="vipCreateText" id="vipCreateTitle" type="text" minlength="8" maxlength="120" autocomplete="off" placeholder="Ex.: Quem é o mais atrasado do trabalho?" required><label for="vipCreateDescription">Descrição <small>opcional</small></label><textarea class="vipCreateText" id="vipCreateDescription" maxlength="280" rows="3" placeholder="Explique a brincadeira ou combine as regras."></textarea><div class="vipOptionEditorHead"><label>Nomes ou opções</label><small>De 3 a 20</small></div><div class="vipOptionInputs" id="vipCreateOptions">${vipInitialOptionInputsHTML()}</div><button class="vipAddOption" id="vipAddOption" type="button">+ ADICIONAR OUTRO NOME</button><label for="vipCreatePassword">Senha para os convidados</label><div class="vipCreatePasswordRow"><input id="vipCreatePassword" name="password" type="password" minlength="4" maxlength="80" autocomplete="new-password" placeholder="No mínimo 4 caracteres" required><button id="vipPasswordVisibility" type="button" aria-label="Mostrar senha">MOSTRAR</button></div><small class="vipCreateHint">Guarde essa senha. Ela não será exibida pelo site depois da criação.</small><span class="vipCreateStatus" id="vipCreateStatus" role="status" aria-live="polite"></span><div class="vipCreateSubmitRow"><button class="secondary" id="vipCreateCancel" type="button">CANCELAR</button><button class="primary" type="submit">CRIAR RANKING PRIVADO</button></div></form></section>`;
}

function vipCreateErrorText(error) {
  return (
    {
      invalid_vip_title: 'Escreva uma pergunta com pelo menos 8 caracteres.',
      invalid_vip_description: 'A descrição pode ter até 280 caracteres.',
      invalid_vip_options: 'Inclua de 3 a 20 nomes diferentes.',
      duplicate_vip_option: 'Há nomes repetidos. Cada nome deve aparecer uma vez.',
      invalid_vip_password: 'Crie uma senha com 4 a 80 caracteres.',
      user_vip_ranking_limit:
        'Você chegou ao limite de 20 rankings VIP. Apague um para criar outro.',
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
    addOption = document.getElementById('vipAddOption');
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
      submit = form.querySelector('button[type=submit]');
    if (options.length < 3) {
      status.className = 'vipCreateStatus error';
      status.textContent = 'Inclua pelo menos 3 nomes ou opções.';
      optionContainer.querySelector('input')?.focus();
      return;
    }
    submit.disabled = true;
    status.className = 'vipCreateStatus';
    status.textContent = 'Criando seu ranking privado…';
    try {
      const response = await fetch('/api?action=vip-rankings', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title, description, options, password: password.value }),
        }),
        result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        location.assign(`/entrar?voltar=${encodeURIComponent('/perfil?criar=1')}`);
        return;
      }
      if (!response.ok) throw result;
      status.classList.add('success');
      status.textContent = 'Ranking criado. Abrindo…';
      toast('Seu ranking VIP está pronto');
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
      toast('Link VIP copiado');
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: 'Ranking VIP — TOPO', url });
      return;
    }
    throw new Error('sharing_unavailable');
  } catch (error) {
    if (error?.name !== 'AbortError') toast('Não consegui copiar o link neste navegador');
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
        toast('Ranking VIP apagado');
        if (pageKind() === 'profile') await renderProfile();
        else await loadVipArea();
      } catch {
        button.disabled = false;
        toast('Não consegui apagar agora');
      }
    };
  });
}

async function loadVipArea() {
  syncExperienceNavigation();
  groupsEl.innerHTML = '';
  document.title = 'Área VIP — TOPO';
  const response = await fetch('/api?action=vip-catalog', { cache: 'no-store' }),
    data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('vip_catalog');
  vipRankings = Array.isArray(data.rankings) ? data.rankings : [];
  const ownedVipRankings = vipRankings.filter((ranking) => ranking.owned),
    loginPath = `/entrar?voltar=${encodeURIComponent('/perfil?criar=1')}`,
    createAction = viewer.registered
      ? '<a class="vipHeroAction" href="/perfil?criar=1#rankings-privados">CRIAR NOVO RANKING</a>'
      : `<a class="vipHeroAction" href="${loginPath}">ENTRAR PARA CRIAR</a>`,
    privateCards = !viewer.registered
      ? '<section class="vipEmpty"><span aria-hidden="true">🔒</span><h2>Entre para ver seus rankings privados.</h2><p>Somente o criador encontra os rankings nesta área.</p></section>'
      : ownedVipRankings.length
        ? `<div class="vipGrid vipOwnedGrid">${ownedVipRankings.map(vipCardHTML).join('')}</div>`
        : '<section class="vipEmpty"><span aria-hidden="true">＋</span><h2>Você ainda não criou nenhum ranking privado.</h2><p>Crie o primeiro no seu perfil e compartilhe o link e a senha com o seu grupo.</p></section>',
    createdCount = viewer.registered
      ? `<small>${ownedVipRankings.length}/${Number(data.userRankingLimit || 20)} criados</small>`
      : '';
  feed.innerHTML = `<section class="vipHero"><span class="portalKicker">Seu espaço privado</span><h1>Área VIP</h1><p>Crie e acompanhe os rankings protegidos que você compartilha com o seu grupo.</p>${createAction}</section><section class="vipCollection"><div class="vipCollectionHead"><div><span class="portalKicker">Somente para você</span><h2>Meus rankings privados</h2></div>${createdCount}</div>${privateCards}</section>`;
  bindVipOwnerActions();
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
  document.title = `Área VIP — TOPO`;
  feed.innerHTML = `<div class="internalHead"><a class="backLink" href="/vip">← Área VIP</a><span class="internalMeta">Protegido</span></div><section class="vipGate"><span class="vipGateIcon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4.5" y="10" width="15" height="11" rx="3"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path><circle cx="12" cy="15.5" r="1"></circle></svg></span><span class="portalKicker">Área VIP</span><h1>${escapeHTML(ranking?.q || 'Ranking protegido')}</h1><p>Digite a senha deste ranking para ver as opções e votar.</p><form class="vipGateForm" id="vipGateForm"><label for="vipPassword">Senha do ranking</label><div><input id="vipPassword" name="password" type="password" minlength="4" maxlength="80" autocomplete="current-password" placeholder="Digite a senha" required><button type="submit">ENTRAR</button></div><span class="vipGateStatus ${message ? 'error' : ''}" id="vipGateStatus" role="status" aria-live="polite">${escapeHTML(message)}</span></form><small>O acesso fica salvo neste aparelho por 30 dias.</small></section>`;
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
      '<div class="loading">Ranking não encontrado.<br><a class="backLink" href="/vip">← Voltar para a Área VIP</a></div>';
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
    return '<div class="authPreload"><span class="loadingSpinner" aria-hidden="true"></span><strong>Abrindo seu acesso por e-mail…</strong><span>Pode levar alguns segundos.</span></div>';
  if (kind === 'profile')
    return '<div class="authPreload"><span class="loadingSpinner" aria-hidden="true"></span><strong>Carregando seu perfil…</strong></div>';
  if (kind === 'moderation')
    return '<div class="authPreload"><span class="loadingSpinner" aria-hidden="true"></span><strong>Abrindo a moderação…</strong></div>';
  if (kind === 'vip')
    return '<div class="authPreload"><span class="loadingSpinner" aria-hidden="true"></span><strong>Abrindo a Área VIP…</strong></div>';
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
  categorySort = homePortal ? 'priority' : 'random';
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
    visible = hasSearch
      ? source.filter((r) => searchMatches(rankingSearchText(r), homeSearch))
      : source;
  return visible;
}
function homeEligibleRankings(list) {
  return list.filter((ranking) => !homeContextOnlyRankingIds.has(ranking.id));
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
function whatsAppShareURL(r) {
  const leader = r?.opts?.[0]?.label || '',
    url = location.origin + rankingPath(r.id),
    text = `*${r.q}*\n${leader ? '🥇 ' + leader + ' está no topo agora.\n' : ''}Vote e mude o ranking no TOPO:\n${url}`;
  return 'https://wa.me/?text=' + encodeURIComponent(text);
}
function whatsAppShareHTML(r, compact = false) {
  return `<a class="whatsappShare ${compact ? 'compact' : ''}" href="${escapeHTML(whatsAppShareURL(r))}" target="_blank" rel="noopener noreferrer" aria-label="Compartilhar ${escapeHTML(r.q)} no WhatsApp">${whatsAppIconHTML()}${compact ? '' : '<span>WhatsApp</span>'}</a>`;
}
function nativeShareHTML(r, compact = false) {
  return `<button class="nativeShare ${compact ? 'compact' : ''}" type="button" data-native-share="${escapeHTML(r.id)}" title="Instagram e outros" aria-label="Compartilhar ${escapeHTML(r.q)} no Instagram ou em outro aplicativo">${nativeShareIconHTML()}${compact ? '' : '<span>Instagram e outros</span>'}</button>`;
}
function shareActionsHTML(r, compact = false) {
  return `<span class="shareActions ${compact ? 'compact' : ''}" role="group" aria-label="Opções para compartilhar">${whatsAppShareHTML(r, compact)}${nativeShareHTML(r, compact)}</span>`;
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
  return `<section class="portalIdeaCallout"><div><span class="portalKicker">A comunidade também cria</span><h2>Tem uma ideia de ranking?</h2><p>Sugira um tema no seu perfil e acompanhe a análise.</p></div><a href="/perfil#sugerir-ranking">Sugerir novo ranking →</a></section>`;
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
      Number(isNewRanking(b)) - Number(isNewRanking(a)) ||
      Number(b.todayVotes || 0) - Number(a.todayVotes || 0) ||
      Number(b.votes || 0) - Number(a.votes || 0) ||
      (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0),
  );
}
function categorySortedRankings(list) {
  if (categorySort === 'random') return sortForExperience(list);
  if (categorySort === 'hot')
    return sortForExperience(
      list,
      (a, b) =>
        Number(b.todayVotes || 0) - Number(a.todayVotes || 0) ||
        Number(b.votes || 0) - Number(a.votes || 0),
    );
  if (categorySort === 'new')
    return sortForExperience(
      list,
      (a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0),
    );
  if (categorySort === 'votes')
    return sortForExperience(list, (a, b) => Number(b.votes || 0) - Number(a.votes || 0));
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
  const cities = topoLocal.availableCities(rankings).filter((city) => city !== selectedCity);
  if (!cities.length) return '';
  return `<section class="localCatalogFooter"><div class="localCatalogFooterCopy"><span class="portalKicker">Trocar de lugar</span><h2>Quer explorar outra cidade?</h2><p>Escolha uma cidade para ver somente os rankings de lá.</p></div><button id="toggleLocalCityExplorer" class="localExploreButton" type="button" aria-expanded="false" aria-controls="localCityOptions">Explorar outra cidade</button><p class="localDataCredit">Dados iniciais: <a href="https://docs.overturemaps.org/attribution/" target="_blank" rel="noreferrer">Overture Maps Foundation</a> e diretórios públicos locais. A ordem é definida pelos votos da comunidade.</p><div class="localCityOptions" id="localCityOptions" hidden>${cities
    .map((city) => {
      const total = topoLocal.rankingsForCity(rankings, city).length;
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
  document.querySelectorAll('[data-category-sort]').forEach(
    (button) =>
      (button.onclick = () => {
        categorySort =
          categorySort === button.dataset.categorySort ? 'priority' : button.dataset.categorySort;
        categoryVisibleCount = CATEGORY_PAGE_SIZE;
        renderHome();
      }),
  );
  document.getElementById('loadMoreRankings')?.addEventListener('click', () => {
    categoryVisibleCount += CATEGORY_PAGE_SIZE;
    renderHome();
    document.getElementById('loadMoreRankings')?.focus();
  });
  bindLocalCityExplorer();
}
function renderCategoryHome(visible) {
  const sorted = categorySortedRankings(visible),
    shown = sorted.slice(0, categoryVisibleCount),
    remaining = Math.max(0, sorted.length - shown.length),
    isAll = activeGroup === 'Todos',
    local = isLocalExperience(),
    preferredCount = visible.length,
    heading = local && isAll ? `Rankings em ${selectedCity}` : activeGroup,
    kicker = local ? `${selectedCity} no TOPO` : isAll ? 'Todos os rankings' : 'Categoria',
    description = local
      ? `Só rankings de ${selectedCity}. Troque a cidade para explorar outro lugar.`
      : isAll
        ? 'Novos e ainda não votados aparecem primeiro.'
        : 'Abra um ranking, veja os itens e vote.';
  document.title = local
    ? `${isAll ? 'Rankings' : activeGroup} em ${selectedCity} — TOPO LOCAL`
    : `${activeGroup} — rankings no TOPO`;
  feed.innerHTML = `<section class="categoryLandingHead ${local ? 'localCatalogHead' : ''}"><div><span class="portalKicker">${kicker}</span><h1>${escapeHTML(heading)}</h1><p>${description}</p></div><div class="categoryLandingCount"><strong>${fmt(preferredCount)}</strong><span>${local ? 'na cidade' : `ranking${visible.length === 1 ? '' : 's'}`}</span></div></section><div class="categoryListBar"><div class="categorySorts" aria-label="Ordenar rankings">${[
    ['hot', 'Em alta'],
    ['new', 'Novos'],
    ['votes', 'Mais votados'],
  ]
    .map(
      ([value, label]) =>
        `<button type="button" data-category-sort="${value}" class="${categorySort === value ? 'active' : ''}" aria-pressed="${categorySort === value}">${label}</button>`,
    )
    .join(
      '',
    )}</div><button class="shuffleBtn categoryShuffle ${categorySort === 'random' ? 'active' : ''}" type="button" onclick="reshuffle()" aria-label="${categorySort === 'random' ? 'Misturar rankings de novo' : 'Embaralhar rankings'}" aria-pressed="${categorySort === 'random'}"><span class="categoryShuffleIcon" aria-hidden="true">↻</span><span class="categoryShuffleLabel">${categorySort === 'random' ? 'misturar de novo' : 'embaralhar'}</span></button></div><section class="categoryRankGrid">${categoryRankCardsHTML(shown)}</section>${remaining ? `<div class="categoryLoadMore"><button id="loadMoreRankings" type="button">${local ? `Ver mais rankings de ${escapeHTML(selectedCity)}` : `Mostrar mais ${fmt(Math.min(CATEGORY_PAGE_SIZE, remaining))} rankings`}</button><span>${fmt(shown.length)} de ${fmt(sorted.length)}</span></div>` : ''}${localCityExplorerHTML()}<div class="end">${local ? 'TOPO LOCAL' : 'TOPO'} · tudo vira ranking</div>`;
  bindCategoryControls();
  bindVotes();
}
function searchRelevance(r) {
  const needle = searchTerms(homeSearch).join(' '),
    title = searchTerms(r.q).join(' '),
    category = topoLocal.isLocalRanking(r)
      ? `${r.cat} ${topoLocal.groupForRanking(r)} TOPO LOCAL`
      : `${r.cat} ${groupOf(r)} TOPO`,
    items = (r.opts || []).map((o) => o.label).join(' ');
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
  feed.innerHTML = `${popHomeLeadHTML(hero, secondaryHero)}${portalTrendingHTML(portalVisible, 'Em alta')}<section class="popHomeSection" id="para-voce"><div class="portalSectionHead"><div><span>MAIS PARA DESCOBRIR</span><h2>Mais rankings</h2></div><button class="shuffleBtn portalShuffle" onclick="reshuffle()">↻ mudar seleção</button></div><section class="categoryRankGrid popHomeGrid">${forYou.map(categoryRankCardHTML).join('')}</section></section>${popLocalCalloutHTML()}<div class="portalSectionHead"><div><span>ACABARAM DE CHEGAR</span><h2>Novos rankings</h2></div><button class="shuffleBtn portalShuffle" onclick="reshuffle()">↻ embaralhar</button></div><section class="portalNewsLayout"><div class="portalStoryFeed">${stories.map(portalStoryHTML).join('')}</div><aside>${portalListHTML('Mais polêmicos', disputed, 'disputed')}</aside></section>${more.length ? `<section class="portalMore"><div class="portalPanelTitle">Mais para explorar</div><div class="portalMoreGrid">${more.map(portalSideStoryHTML).join('')}</div></section>` : ''}<div class="end">TOPO · tudo vira ranking</div>`;
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
      .filter((candidate) => candidate.id !== r.id)
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
  const available = rankingsInSameExperience(r).filter((candidate) => candidate.id !== r.id),
    unvoted = available.filter((candidate) => myVoteCount(candidate) === 0),
    pool = unvoted.length ? unvoted : available,
    sameCategory = pool.filter((candidate) => candidate.cat === r.cat),
    candidates = sameCategory.length ? sameCategory : pool,
    explicitIds = editorialFor(r.id).related || [];
  return (
    candidates
      .map((candidate) => ({ candidate, score: relatedScore(r, candidate, explicitIds) }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          Number(isNewRanking(b.candidate)) - Number(isNewRanking(a.candidate)) ||
          Number(b.candidate.votes || 0) - Number(a.candidate.votes || 0),
      )[0]?.candidate || null
  );
}
function isTeamRanking(r) {
  return /\b(?:time|times|clube|clubes)\b/.test(foldText(`${r?.id || ''} ${r?.q || ''}`));
}
function randomRankingFor(r) {
  const available = rankingsInSameExperience(r).filter(
      (candidate) => candidate.id !== r.id && !isTeamRanking(candidate),
    ),
    unvoted = available.filter((candidate) => myVoteCount(candidate) === 0),
    pool = unvoted.length ? unvoted : available;
  return pool[Math.floor(Math.random() * pool.length)] || null;
}
function relatedCardsHTML(rels) {
  return rels
    .map(
      (x) =>
        `<a class="relatedCard" href="${rankingPath(x.id)}"><div class="relatedThumb">${x.img ? `<img data-ranking-image src="${escapeHTML(x.img)}" alt="" loading="lazy" decoding="async">` : '<span class="portalImageFallback">TOPO</span>'}</div><div><div class="relatedCat">${escapeHTML(categoryLabel(x))}</div><div class="relatedTitle">${escapeHTML(x.q)}</div></div></a>`,
    )
    .join('');
}
function rankingContinuationHTML(r) {
  if (r.vip) return '';
  const rels = relatedFor(r),
    next = nextRankingFor(r),
    random = randomRankingFor(r),
    nextUnvoted = next && myVoteCount(next) === 0,
    randomUnvoted = random && myVoteCount(random) === 0,
    sameCategory = next?.cat === r.cat,
    nextHint = next
      ? nextUnvoted
        ? sameCategory
          ? `${categoryLabel(next)} · ainda não votado`
          : 'Tema relacionado · ainda não votado'
        : 'Você já conhece este tema'
      : 'Continuar descobrindo',
    randomHint = randomUnvoted ? 'Uma surpresa ainda não votada' : 'Revisite uma disputa';
  return `<section class="rankingContinuation"><div class="rankingContinuationHead"><div><div class="sectionLabel">Continue votando</div><h2>Rankings relacionados</h2></div><span>sem voltar para a Home</span></div><div class="relatedGrid">${relatedCardsHTML(rels)}</div><div class="rankingFlowActions">${next ? `<a class="rankingFlowButton primary" href="${rankingPath(next.id)}"><span><strong>Próximo ranking</strong><small>${escapeHTML(nextHint)}</small></span><b>→</b></a>` : ''}${random ? `<a class="rankingFlowButton" href="${rankingPath(random.id)}"><span><strong>Ranking aleatório</strong><small>${randomHint}</small></span><b>↻</b></a>` : ''}</div></section>`;
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
function rankingVoteRowHTML(o, i, extraClass = '', votingOpen = true) {
  const upSelected = Number(o.mine) === 1,
    downSelected = Number(o.mine) === -1,
    label = escapeHTML(o.label),
    disabled = votingOpen ? '' : 'disabled';
  return `<div class="option ${extraClass}" data-option-id="${o.id}" data-option-label="${label}"><div class="pos">${rankMark(i)}</div><div><div class="name">${label}${o.isNew ? '<span class="vipNewOption">NOVO</span>' : ''}</div><div class="score">${pointCountText(o.score)} · ${i + 1}º lugar ${doubleVoteBadgeHTML(o)}</div></div><div class="actions"><button class="react up ${upSelected ? 'selected' : ''}" data-id="${o.id}" data-mine="${o.mine}" data-dir="1" aria-label="${upSelected ? 'Remover voto em' : 'Fazer'} ${label}${upSelected ? '' : ' subir'}" ${disabled}>↑</button>${votingOpen ? doubleVoteActionHTML(o, 1) : ''}<button class="react down ${downSelected ? 'selected' : ''}" data-id="${o.id}" data-mine="${o.mine}" data-dir="-1" aria-label="${downSelected ? 'Remover voto em' : 'Fazer'} ${label}${downSelected ? '' : ' descer'}" ${disabled}>↓</button>${votingOpen ? doubleVoteActionHTML(o, -1) : ''}</div></div>`;
}
function allItemsExplorerHTML(r) {
  const total = r.opts.length;
  if (total <= 10) return '';
  return `<section class="allItemsExplorer"><button class="allItemsToggle" id="allItemsToggle" type="button" aria-expanded="${allItemsOpen}"><span><strong>${allItemsOpen ? 'Voltar ao Top 10' : `Ver ranking completo — ${total} opções`}</strong><small>${allItemsOpen ? 'Mostrar somente os dez primeiros' : 'Mostrar todas as posições e avaliar qualquer item'}</small></span><b aria-hidden="true">${allItemsOpen ? '−' : '+'}</b></button></section>`;
}
function bindAllItems(r) {
  const toggle = document.getElementById('allItemsToggle');
  if (!toggle) return;
  toggle.onclick = () => {
    allItemsOpen = !allItemsOpen;
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
  allItemsOpen = true;
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
  return `<form class="rankingEditor" id="rankingEditorForm"><header class="rankingEditorHead"><div><span class="category"><a href="${categoryPath}">${escapeHTML(categoryLabel(r))}</a></span><h1>Editar ranking</h1><p>Altere somente o que precisa. A posição, os votos e o histórico das opções serão preservados.</p></div></header><label class="rankingEditorField rankingEditorTitleField"><span>Título do ranking</span><input id="rankingEditorTitle" type="text" minlength="8" maxlength="120" value="${escapeHTML(r.q)}" required></label><section class="rankingEditorPhoto"><div class="rankingEditorSectionHead"><div><span>FOTO</span><strong>Imagem de capa</strong></div><small>A prévia muda antes de publicar.</small></div><div class="rankingEditorPhotoPreview">${photo}</div><div class="rankingEditorPhotoActions"><label class="rankingEditorFileButton">Escolher foto do aparelho<input id="rankingEditorFile" type="file" accept="image/jpeg,image/png,image/webp"></label><button id="rankingEditorKeepPhoto" type="button">Manter atual</button><button id="rankingEditorRemovePhoto" type="button">Remover foto</button></div><label class="rankingEditorField rankingEditorUrlField"><span>Ou cole o link de uma imagem</span><input id="rankingEditorImageUrl" type="url" inputmode="url" placeholder="https://..." value="${escapeHTML(state.imageUrl)}"><small>Se escolher um arquivo, ele terá prioridade sobre o link.</small></label></section><section class="rankingEditorVip"><div class="rankingEditorSectionHead"><div><span>ACESSO</span><strong>Área VIP</strong></div><small>Uma senha exclusiva para este ranking</small></div><label class="rankingEditorVipToggle"><input id="rankingEditorVip" type="checkbox" ${r.vip ? 'checked' : ''}><span><strong>Colocar este ranking na Área VIP</strong><small>Ele deixa de aparecer na Home, nas categorias, na busca e no Google.</small></span></label><label class="rankingEditorField rankingEditorVipPassword"><span>${r.vipHasPassword ? 'Trocar a senha' : 'Criar a senha'}</span><input id="rankingEditorVipPassword" type="password" minlength="4" maxlength="80" autocomplete="new-password" placeholder="${r.vipHasPassword ? 'Deixe vazio para manter a senha atual' : 'No mínimo 4 caracteres'}"><small>${r.vipHasPassword ? 'A senha atual nunca é exibida. Digite outra somente se quiser trocá-la.' : 'A senha não será salva em texto e não poderá ser recuperada, apenas trocada.'}</small></label></section><section class="rankingEditorOptions"><div class="rankingEditorSectionHead"><div><span>OPÇÕES</span><strong>Corrigir os nomes</strong></div><small>${r.opts.length} opções · votos preservados</small></div><div class="rankingEditorOptionList">${options}</div></section><div class="rankingEditorSaveBar"><span id="rankingEditorStatus" role="status" aria-live="polite"></span><div><button class="rankingEditorCancel" id="rankingEditorCancel" type="button">Cancelar</button><button class="rankingEditorSave" type="submit">Salvar alterações</button></div></div></form>`;
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

async function optimizeRankingPhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file?.type)) {
    throw new Error('unsupported_photo');
  }
  const objectUrl = URL.createObjectURL(file),
    image = new Image();
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = objectUrl;
    });
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
      invalid_vip_settings: 'Confira a configuração da Área VIP.',
      invalid_vip_password: 'A senha precisa ter entre 4 e 80 caracteres.',
      vip_password_required: 'Crie uma senha para colocar este ranking na Área VIP.',
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
    allItemsOpen = false;
    renderInternal();
  };
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
      status.textContent = 'Crie uma senha com pelo menos 4 caracteres para a Área VIP.';
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
      allItemsOpen = false;
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
  feed.innerHTML = `<div class="internalHead"><button class="backLink vipOwnerBack" id="vipOwnerBack" type="button">← Voltar ao ranking</button><span class="internalMeta">Privado · ${fmt(r.votes || 0)} votos</span></div><form class="vipOwnerEditor" id="vipOwnerEditorForm"><header><span class="portalKicker">Meus rankings privados</span><h1>Gerenciar ranking</h1><p>Corrija qualquer nome sem perder os votos ou apague quem não deve fazer parte do ranking.</p></header><label class="vipOwnerField" for="vipOwnerTitle"><span>Pergunta ou título</span><input id="vipOwnerTitle" type="text" minlength="8" maxlength="120" value="${escapeHTML(r.q)}" required></label><label class="vipOwnerField" for="vipOwnerDescription"><span>Descrição <small>opcional</small></span><textarea id="vipOwnerDescription" maxlength="280" rows="3">${escapeHTML(r.vipDescription || '')}</textarea></label><section class="vipOwnerOptions"><div class="vipOptionEditorHead"><label>Nomes atuais</label><small id="vipOwnerOptionCount">${orderedOptions.length}/20</small></div><div id="vipOwnerOptions">${orderedOptions.map(vipOwnerOptionRowHTML).join('')}</div><p class="vipOwnerEditNote"><strong>Corrigir mantém os votos.</strong> Ao apagar, os votos e comentários ligados àquele nome também serão removidos quando você salvar.</p><label class="vipOwnerField" for="vipOwnerNewOptions"><span>Adicionar novos nomes <small>um por linha</small></span><textarea id="vipOwnerNewOptions" maxlength="1700" rows="4" placeholder="Ex.:&#10;João&#10;Maria"></textarea></label>${hasVotes ? '<p class="vipOwnerNewNote">Os novos nomes entram com zero votos e recebem o selo “Novo”.</p>' : ''}</section><section class="vipOwnerAccess"><label class="vipOwnerVotingToggle"><input id="vipOwnerVotingOpen" type="checkbox" ${r.vipVotingOpen === false ? '' : 'checked'}><span><strong>Votação aberta</strong><small>Desmarque para encerrar temporariamente.</small></span></label><label class="vipOwnerField" for="vipOwnerPassword"><span>Trocar a senha <small>opcional</small></span><input id="vipOwnerPassword" type="password" minlength="4" maxlength="80" autocomplete="new-password" placeholder="Deixe vazio para manter a senha atual"></label></section><span class="vipCreateStatus" id="vipOwnerStatus" role="status" aria-live="polite"></span><div class="vipOwnerEditorActions"><button class="danger" id="vipOwnerDelete" type="button">APAGAR RANKING</button><div><button id="vipOwnerCancel" type="button">CANCELAR</button><button class="primary" type="submit">SALVAR ALTERAÇÕES</button></div></div></form>`;

  const form = document.getElementById('vipOwnerEditorForm'),
    options = document.getElementById('vipOwnerOptions'),
    status = document.getElementById('vipOwnerStatus'),
    newOptionsInput = document.getElementById('vipOwnerNewOptions'),
    removedOptionIds = new Set(),
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
      location.assign('/perfil#rankings-privados');
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
        ? '/perfil#rankings-privados'
        : '/vip'
      : local
        ? topoLocal.collectionPath(topoLocal.cityForRanking(r))
        : '/',
    homeLabel = vip ? (r.vipOwned ? 'Meus rankings' : 'Área VIP') : local ? 'TOPO LOCAL' : 'TOPO',
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
  const visibleLimit = allItemsOpen ? r.opts.length : Math.min(10, r.opts.length),
    visibleOptions = r.opts.slice(0, visibleLimit),
    votingOpen = !vip || r.vipVotingOpen !== false,
    ownerBar = r.vipOwned ? vipOwnerBarHTML(r) : '',
    description =
      vip && r.vipDescription
        ? `<p class="vipRankingDescription">${escapeHTML(r.vipDescription)}</p>`
        : '',
    closedNotice = votingOpen
      ? ''
      : '<div class="vipVotingClosed"><strong>Votação encerrada</strong><span>O resultado continua visível, mas novos votos estão pausados.</span></div>',
    footerVoteText = vip
      ? votingOpen
        ? 'Entre com a senha e vote sem cadastro.'
        : 'A votação está encerrada.'
      : `Até ${viewer.rankingLimit || 20} votos por ranking.`;
  feed.innerHTML = `<div class="internalHead"><a class="backLink" href="${homePath}">← ${homeLabel}</a><span class="internalMeta">${vip ? 'VIP · ' : ''}${fmt(r.votes)} votos · Top ${visibleLimit}</span></div>${ownerBar}<article class="rank rankingMain" id="votar"><div class="rankHead"><span class="categoryWrap"><a class="category" href="${categoryPath}">${vip ? 'Área VIP' : escapeHTML(categoryLabel(r))}</a>${newBadgeHTML(r)}</span><span class="total">Top ${visibleLimit}</span></div><h1>${escapeHTML(r.q)}</h1>${description}${r.img ? `<div class="imageStrip"><img data-ranking-image src="${escapeHTML(r.img)}" alt="${escapeHTML(r.q)}" decoding="async"></div>` : ''}${closedNotice}<div class="statsRow"><div class="statBox"><div class="statLabel">Votos hoje</div><div class="statValue">${fmt(r.todayVotes || 0)}</div></div><div class="statBox"><div class="statLabel">Disputa no topo</div><div class="statValue">${topGap(r) === 0 ? 'Empate' : topGap(r) + ' pt'}</div></div></div><div class="rankingResultHead"><span>Resultado atual</span><strong>Top ${visibleLimit}</strong></div><div class="options">${visibleOptions.map((o, i) => rankingVoteRowHTML(o, i, '', votingOpen)).join('')}</div><div class="rankFoot"><span>${footerVoteText}</span><span>${viewer.registered && votingOpen ? 'Vote normalmente · 2× reforça' : votingOpen ? '↑ sobe · ↓ desce' : 'resultado preservado'}</span></div>${allItemsExplorerHTML(r)}${rankingOptionSuggestionHTML(r)}</article>${rankingContinuationHTML(r)}${commentsShellHTML()}${editorialHTML(r)}<div class="end"><a class="backLink" href="${homePath}">← voltar para ${r.vipOwned ? 'seus rankings privados' : vip ? 'a Área VIP' : `todos os rankings ${local ? 'locais' : ''}`}</a></div>`;
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
        .querySelector('.internalHead')
        ?.insertAdjacentHTML('afterend', moderatorRankingBarHTML(false));
      document
        .getElementById('rankingEditStart')
        ?.addEventListener('click', () => beginRankingEdit(r));
    }
  }
  bindVotes();
  bindAllItems(r);
  bindRankingSuggestion(r);
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
        location.assign('/entrar?voltar=%2Fperfil%23sugerir-ranking');
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
async function transferClerkSignUp(clerk) {
  let signUp = await clerk.client.signUp.create({ transfer: true });
  if (signUp.status === 'complete') {
    await finishClerkAuth(clerk, signUp);
    return true;
  }
  const missing = signUp?.missingFields || [];
  if (missing.includes('password')) {
    const password = temporaryClerkPassword();
    signUp = await clerk.client.signUp.update({ password });
    if (signUp.status === 'complete') {
      await finishClerkAuth(clerk, signUp, password);
      return true;
    }
  }
  throw new Error('clerk_session_incomplete');
}
function renderClerkStart(mount, clerk) {
  mount.innerHTML = `<div class="passwordlessAuth"><form id="emailCodeStart"><label class="field"><span>E-mail</span><input id="clerkEmail" name="email" type="email" inputmode="email" autocomplete="email" maxlength="160" placeholder="voce@email.com" value="${escapeHTML(clerkAuthFlow.email)}" required></label><div id="clerk-captcha"></div><div class="formError clerkFlowError" id="clerkFlowError" aria-live="polite"></div><button class="primaryBtn" type="submit">Receber código por e-mail</button></form><p class="authFine">Se for seu primeiro acesso, sua conta será criada automaticamente.</p></div>`;
  document.getElementById('emailCodeStart').onsubmit = (event) =>
    startClerkEmail(event, clerk, mount);
  document.getElementById('clerkEmail')?.focus();
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
  feed.innerHTML = `<div class="authShell clerkAuthShell"><div class="authCard clerkAuthCard"><div class="authEyebrow">Sua conta no TOPO</div><div class="authTitle">Entre sem senha.</div><p class="authIntro">Receba um código no seu e-mail. É rápido e você não precisa criar nem lembrar uma senha.</p><div class="clerkAuthMount" id="clerkAuthMount"><span class="commentsLoading">preparando acesso seguro…</span></div><div class="authNote">Seus votos deste aparelho serão ligados à sua conta quando você entrar.</div></div></div>`;
  const clerk = await initClerk(),
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
      '<div class="clerkCallback"><span class="commentsLoading">concluindo seu acesso…</span></div>';
    try {
      await clerk.handleRedirectCallback({
        signInFallbackRedirectUrl: authReturn(),
        signUpFallbackRedirectUrl: authReturn(),
        signInUrl: '/entrar',
        signUpUrl: '/entrar',
        continueSignUpUrl: '/entrar',
      });
    } catch (problem) {
      mount.innerHTML = `<div class="clerkAuthError">${escapeHTML(clerkErrorText(problem))}<br><a class="retry authButtonLink" href="/entrar">Voltar para entrar</a></div>`;
    }
    return;
  }
  renderClerkStart(mount, clerk);
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
    title = hasChosenName ? 'Alterar nome público' : 'Escolha seu nome no TOPO',
    availableDate = profileNameDate(user.nameChangeAvailableAt);
  return `<div class="profileIdentityPanel" id="profileIdentityPanel"><div class="profilePhotoTitle">${title}</div>${canChange ? `<form class="profileNameForm" id="profileNameForm"><label for="profileNameInput">Nome público</label><div><input id="profileNameInput" name="displayName" type="text" minlength="3" maxlength="24" autocomplete="nickname" value="${escapeHTML(user.name || '')}" required><button type="submit">Salvar nome</button></div></form><p class="profilePhotoNote">Esse nome aparece nos comentários e no ranking da comunidade. Use de 3 a 24 caracteres; termos ofensivos e nomes que imitam a equipe são bloqueados. Seu e-mail continua privado.</p><p class="profileNameCooldown">Depois de salvar, você poderá trocar novamente em 30 dias.</p>` : `<p class="profilePhotoNote">O nome exibido acima é o seu nome público. Seu e-mail continua privado.</p><p class="profileNameCooldown">Você poderá mudar novamente em ${escapeHTML(availableDate || '30 dias')}.</p>`}<div class="profileNameStatus" id="profileNameStatus" aria-live="polite"></div></div>`;
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
function profileLeaderboardHTML(entries = []) {
  if (!entries.length)
    return '<p class="profileHint">O ranking começa assim que as pessoas votam.</p>';
  let previousPosition = 0;
  return `<div class="profileLeaderboardList">${entries
    .map((entry) => {
      const position = Math.max(0, Number(entry.position || 0)),
        votes = Math.max(0, Number(entry.votes || 0)),
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
        row = `<div class="profileLeaderboardRow ${entry.isCurrent ? 'current' : ''}"><span class="profileLeaderboardPosition top${Math.min(position, 3)}">${position}</span><span class="profileLeaderboardAvatar">${avatar}</span><span class="profileLeaderboardPerson"><strong>${escapeHTML(entry.name || 'Pessoa no TOPO')}${entry.isCurrent ? '<em>você</em>' : ''}</strong><small>${escapeHTML(profileLevel(votes))} · ${fmt(rankingsCount)} ranking${rankingsCount === 1 ? '' : 's'}</small>${reportAction}</span><span class="profileLeaderboardScore"><strong>${fmt(votes)}</strong><small>votos</small></span></div>`;
      previousPosition = position;
      return gap + row;
    })
    .join(
      '',
    )}</div><p class="profileLeaderboardNote">A posição considera os votos conquistados e, em caso de empate, a variedade de rankings.</p>`;
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
          location.assign('/entrar?voltar=%2Fperfil');
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
    const metrics = document.querySelector('.profileMetrics');
    if (current && metrics && !metrics.querySelector('.profileMetricRank'))
      metrics.insertAdjacentHTML(
        'beforeend',
        `<span class="profileMetricRank"><strong>${fmt(current.position)}º</strong><small>na comunidade</small></span>`,
      );
  } catch {
    section.innerHTML =
      '<div class="profileSectionHead"><div class="sectionLabel">Ranking da comunidade</div><span>Top 10</span></div><p class="profileHint">Não consegui carregar o ranking agora.</p>';
  }
}
async function refreshProfileLeaderboard() {
  document.getElementById('profileLeaderboardSection')?.remove();
  document.querySelector('.profileMetricRank')?.remove();
  await loadProfileLeaderboard();
}
const saveProfilePatchBase = saveProfilePatch;
saveProfilePatch = async function saveProfilePatchAndRefresh(patch) {
  const result = await saveProfilePatchBase(patch);
  void refreshProfileLeaderboard();
  return result;
};
const bindProfileControlsBase = bindProfileControls;
bindProfileControls = function bindProfileControlsWithLeaderboard() {
  bindProfileControlsBase();
  void loadProfileLeaderboard();
  void loadProfileSuggestionCenter();
};
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
  document.title = 'Perfil — TOPO';
  if (!viewer.registered) {
    location.replace('/entrar?modo=entrar');
    return;
  }
  try {
    const [res, vipResponse] = await Promise.all([
      fetch('/api?action=profile&device_id=' + encodeURIComponent(deviceId), {
        cache: 'no-store',
      }),
      fetch('/api?action=vip-catalog', { cache: 'no-store' }),
    ]);
    if (res.status === 401) {
      location.replace('/entrar?modo=entrar');
      return;
    }
    if (!res.ok || !vipResponse.ok) throw new Error('profile_load_failed');
    const [p, vipData] = await Promise.all([res.json(), vipResponse.json()]),
      ownedVipRankings = Array.isArray(vipData.rankings)
        ? vipData.rankings.filter((ranking) => ranking.owned)
        : [],
      doubleVotes = p.doubleVotes || {},
      date = new Date(p.user.createdAt).toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      }),
      progress = profileProgressInfo(doubleVotes.totalVotes ?? p.stats.votes),
      level = profileLevel(progress.total),
      avatar = p.profile?.avatarData || '',
      showAvatar = p.profile?.showAvatarOnLeaderboard !== false,
      up = Number(p.stats.upVotes || 0),
      down = Number(p.stats.downVotes || 0),
      voteTotal = up + down,
      upPercent = voteTotal ? Math.round((up / voteTotal) * 100) : 0,
      downPercent = voteTotal ? 100 - upPercent : 0,
      unlockedText = progress.unlocked
        ? `${progress.unlocked} voto${progress.unlocked === 1 ? '' : 's'} duplo${progress.unlocked === 1 ? '' : 's'} conquistado${progress.unlocked === 1 ? '' : 's'}`
        : 'primeiro voto duplo em progresso',
      progressText = progress.next
        ? `<strong>Faltam ${fmt(progress.remaining)} voto${progress.remaining === 1 ? '' : 's'}</strong> para liberar o seu ${['primeiro', 'segundo', 'terceiro'][progress.unlocked]} voto duplo.`
        : '<strong>Você conquistou os três votos duplos.</strong>',
      powerSummary = progress.unlocked
        ? `${fmt(doubleVotes.available || 0)} livre${Number(doubleVotes.available || 0) === 1 ? '' : 's'} · ${fmt(doubleVotes.active || 0)} em uso`
        : 'valem 2 pontos';
    vipRankings = Array.isArray(vipData.rankings) ? vipData.rankings : [];
    const privateEmpty =
        '<div class="vipOwnedEmpty"><strong>Você ainda não criou nenhum ranking privado.</strong><span>Crie uma pergunta, inclua os nomes e compartilhe o link e a senha com o seu grupo.</span></div>',
      privateCards = ownedVipRankings.length
        ? `<div class="vipGrid vipOwnedGrid">${ownedVipRankings.map(vipCardHTML).join('')}</div>`
        : privateEmpty,
      createOpen = queryParams.get('criar') === '1';
    feed.innerHTML = `<div class="internalHead"><a class="backLink" href="/">← TOPO</a><button class="logoutBtn" id="logoutBtn">Sair</button></div><section class="profileHero profileGameHero"><div class="profileHeroIntro"><div class="profileAvatarProgress" style="--profile-progress:${progress.progress}%"><div class="profileAvatarRing"><div class="profileAvatar"><img id="profileAvatarImage" alt="Foto de perfil de ${escapeHTML(p.user.name)}" ${avatar ? `src="${escapeHTML(avatar)}"` : 'hidden'}><span id="profileAvatarInitial" ${avatar ? 'hidden' : ''}>${escapeHTML(profileInitial(p.user.name))}</span></div></div><span class="profileProgressCount">${fmt(progress.total)}</span></div><div class="profileHeroHeading"><div class="authEyebrow">Seu perfil</div><div class="profileName">${escapeHTML(p.user.name)}</div><div class="profileEmail">${escapeHTML(p.user.email)} · desde ${date}</div></div></div><div class="profileHeroDetails">${profileNameEditorHTML(p.user)}<div class="profileBadges"><span>${escapeHTML(level)}</span><span>${unlockedText}</span></div><p class="profileProgressText">${progressText}</p><div class="profileMetrics" aria-label="Resumo do perfil"><span><strong>${fmt(p.stats.votes)}</strong><small>votos ativos</small></span><span><strong>${fmt(p.stats.rankings)}</strong><small>rankings</small></span><span><strong>${fmt(p.stats.streak || 0)} dia${Number(p.stats.streak || 0) === 1 ? '' : 's'}</strong><small>sequência</small></span></div></div></section><section class="profileSection profileVipRankings" id="rankings-privados"><div class="profileSectionHead profileVipHead"><div><div class="sectionLabel">Meus rankings privados</div><p>Só entram pelo link e pela senha que você compartilhar.</p></div><span>${ownedVipRankings.length}/${Number(vipData.userRankingLimit || 20)} criados</span><button class="vipHeroAction" id="vipCreateToggle" type="button" aria-expanded="${createOpen}">CRIAR RANKING</button></div>${vipCreatePanelHTML(createOpen)}${privateCards}</section><div class="profileDashboard"><section class="profileSection profilePowerSection"><div class="profileSectionHead"><div class="sectionLabel">Seus votos duplos</div><span>${powerSummary}</span></div><div class="profilePowerList">${profileDoubleVotesHTML(doubleVotes)}</div><p class="profileComingSoon"><strong>Como usar:</strong> vote normalmente e toque no pequeno botão 2× que aparece ao lado da seta escolhida. Toque no 2× novamente para voltar ao voto simples; toque na seta marcada para remover o voto inteiro.</p><div class="profilePhotoPanel"><div class="profilePhotoTitle">Foto do perfil</div><input id="profilePhotoInput" type="file" accept="image/jpeg,image/png,image/webp" hidden><div class="profilePhotoActions"><button type="button" id="chooseProfilePhoto">${avatar ? 'Trocar foto' : 'Adicionar foto'}</button><button type="button" id="removeProfilePhoto" ${avatar ? '' : 'hidden'}>Remover</button></div><label class="profilePhotoCheck"><input id="profilePhotoVisibility" type="checkbox" ${showAvatar ? 'checked' : ''}><span>Mostrar minha foto no ranking de usuários</span></label><p class="profilePhotoNote">A imagem é recortada e reduzida antes de ser salva. Você também pode usar apenas a inicial.</p><div class="profilePhotoStatus" id="profilePhotoStatus" aria-live="polite"></div></div></section><section class="profileSection profileVoteStyle"><div class="profileSectionHead"><div class="sectionLabel">Seu jeito de votar</div><span>votos ativos</span></div><div class="profileVoteSplit" aria-label="${upPercent}% para cima e ${downPercent}% para baixo"><span class="up" style="width:${upPercent}%"></span><span class="down" style="width:${downPercent}%"></span></div><div class="profileVoteLegend"><span><i class="up"></i><strong>${fmt(up)} ↑</strong> para cima</span><span><i class="down"></i><strong>${fmt(down)} ↓</strong> para baixo</span></div><div class="profileSubhead">Categorias favoritas</div>${profileCategoriesHTML(p.categories)}</section></div><section class="profileSection profileRecentSection"><div class="profileSectionHead"><div class="sectionLabel">Seus votos recentes</div><span>últimas escolhas</span></div>${profileRecentHTML(p.recent)}</section>`;
    document.getElementById('logoutBtn').onclick = logout;
    bindVipCreateForm();
    bindVipOwnerActions();
    bindProfileControls();
    if (createOpen) document.getElementById('rankings-privados')?.scrollIntoView();
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
    `<div class="modalKicker">Como funciona</div><div class="modalTitle">Você mexe no ranking.</div><div class="modalText">Se concorda com a posição, deixe como está.</div><div class="howRows"><div class="howRow"><span class="howIcon up">↑</span><span class="howCopy">Acha que deveria estar mais acima.</span></div><div class="howRow"><span class="howIcon down">↓</span><span class="howCopy">Acha que deveria estar mais abaixo.</span></div><div class="howRow"><span class="howIcon double">2×</span><span class="howCopy">Depois de votar, use o pequeno botão 2× ao lado da seta para reforçar esse voto.</span></div></div><div class="modalText">Você pode mexer em até <b>${viewer.rankingLimit || 20} opções por ranking</b>. Sem cadastro, tem <b>${viewer.anonymousLimit || DEFAULT_ANONYMOUS_LIMIT} votos livres no total</b>. Os votos duplos são conquistados no perfil.</div><div class="modalActions"><button class="main" data-close>Entendi</button></div>`,
  );
}
function showRegistrationWall() {
  showModal(
    `<div class="modalKicker">${viewer.anonymousLimit || DEFAULT_ANONYMOUS_LIMIT} votos usados</div><div class="modalTitle">Quer continuar mexendo no TOPO?</div><div class="modalText">Entre com um código enviado ao seu e-mail. Sem senha e sem complicação.</div><div class="modalActions"><button data-close>Agora não</button><a class="main" href="/entrar">Entrar ou criar conta</a></div>`,
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
  const url = location.origin + rankingPath(r.id),
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
  bindNativeShares();
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

  option.score = score;
  option.mine = Number(result.direction || 0);
  option.mineWeight = option.mine === 0 ? 1 : Number(result.weight) === 2 ? 2 : 1;
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
    controls = [...(button.closest('.actions')?.querySelectorAll('button') || [button])];
  controls.forEach((item) => (item.disabled = true));
  try {
    const res = await fetch('/api', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, option_id: optionId, direction, weight }),
      }),
      result = await res.json();
    if (res.status === 403 && result.error === 'registration_required') {
      viewer.anonymousUsed = viewer.anonymousLimit || DEFAULT_ANONYMOUS_LIMIT;
      renderAccount();
      showRegistrationWall();
      return;
    }
    if (res.status === 403 && result.error === 'account_required_on_this_device') {
      viewer.votingRequiresAccount = true;
      renderAccount();
      showAccountRequired();
      return;
    }
    if (res.status === 403 && result.error === 'vip_password_required') {
      const ranking = rankings.find((item) =>
        item.opts?.some((option) => Number(option.id) === Number(optionId)),
      );
      if (ranking?.vip) renderVipGate({ id: ranking.id, q: ranking.q, img: ranking.img });
      return;
    }
    if (
      (res.status === 403 && result.error === 'double_vote_requires_account') ||
      (res.status === 409 &&
        ['double_vote_locked', 'double_vote_limit', 'double_vote_requires_vote'].includes(
          result.error,
        ))
    ) {
      await refreshVoteState(rankOrder);
      return;
    }
    if (res.status === 409 && result.error === 'ranking_vote_limit') {
      toast(`Máximo de ${result.limit || 20} votos neste ranking`);
      return;
    }
    if (res.status === 409 && result.error === 'ranking_voting_closed') {
      toast('A votação deste ranking foi encerrada');
      await refreshVoteState(rankOrder);
      return;
    }
    if (res.status === 409 && result.error === 'device_rekey_required') {
      rotateDeviceId();
      await load();
      toast('Conta protegida. Tente votar novamente.');
      return;
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
  } catch (e) {
    toast('Não consegui registrar. Tente novamente.');
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
  return `<div class="moderationRankingReview"><p><strong>Aprove apenas o nome e a categoria.</strong> Depois eu crio os 20 itens, escolho a foto e publico para você.</p><div><label class="suggestionField"><span>Nome final do ranking</span><input data-ranking-title type="text" minlength="8" maxlength="120" value="${escapeHTML(item.title)}" required></label><label class="suggestionField"><span>Categoria</span><select data-ranking-category required>${moderationCategoryOptions(item.category)}</select></label></div></div>`;
}
function moderationCreationReadyHTML() {
  return `<div class="moderationCreationReady"><strong>Pronto para eu criar</strong><span>Nome e categoria aprovados. Você não precisa montar nem revisar o Top 20: eu preparo os 20 itens, escolho a foto e publico.</span></div>`;
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
  return `<nav class="moderationPanelTabs" aria-label="Áreas do painel privado"><a class="${active === 'queue' ? 'active' : ''}" href="/moderacao" ${active === 'queue' ? 'aria-current="page"' : ''}>Sugestões e denúncias</a><a class="${active === 'users' ? 'active' : ''}" href="/moderacao?aba=usuarios" ${active === 'users' ? 'aria-current="page"' : ''}>Usuários cadastrados</a></nav>`;
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
          : `Aprovar “${rankingTitle}” na categoria ${rankingCategory}? Depois eu criarei os 20 itens, a foto e publicarei.`;
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
          'Se quiser, escreva o motivo da recusa. A pessoa verá essa nota no perfil:',
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
  const activeTab = queryParams.get('aba') === 'usuarios' ? 'users' : 'queue';
  document.title = activeTab === 'users' ? 'Usuários cadastrados — TOPO' : 'Moderação — TOPO';
  if (!viewer.registered) {
    location.replace(`/entrar?voltar=${encodeURIComponent(location.pathname + location.search)}`);
    return;
  }
  feed.innerHTML = pageLoadingHTML('moderation');
  try {
    const action = activeTab === 'users' ? 'moderation-users' : 'moderation',
      response = await fetch(`/api?action=${action}`, { cache: 'no-store' }),
      data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      location.replace(`/entrar?voltar=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    if (response.status === 403) {
      feed.innerHTML =
        '<div class="internalHead"><a class="backLink" href="/perfil">← Perfil</a></div><section class="moderationAccessDenied"><span class="suggestionEyebrow">Área privada</span><h1>Esta conta não tem acesso à moderação.</h1><p>Entre com o e-mail cadastrado como moderador do TOPO.</p></section>';
      return;
    }
    if (!response.ok) throw data;
    const panelHead = `<div class="internalHead"><a class="backLink" href="/perfil">← Perfil</a><span class="internalMeta">${escapeHTML(data.moderator?.email || '')}</span></div>${moderationPanelTabsHTML(activeTab)}`;
    if (activeTab === 'users') {
      feed.innerHTML = `${panelHead}${moderationUsersPageHTML(data)}<div class="end"><a class="backLink" href="/perfil">← voltar ao perfil</a></div>`;
      bindModerationUserSearch();
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
    feed.innerHTML = `${panelHead}<header class="moderationHero"><span class="suggestionEyebrow">Painel privado</span><h1>Moderação da comunidade</h1><p>${heroMessage}</p><div class="moderationCounts"><span><strong>${optionPending.length}</strong> opções</span><span><strong>${rankingPending.length}</strong> novos rankings</span><span><strong>${namePending.length}</strong> nomes</span><span><strong>${approvedRankings.length}</strong> para criar</span></div></header>${moderationSectionHTML('Nomes denunciados', namePending, 'Nenhum nome esperando análise.')}${moderationSectionHTML('Opções para rankings', optionPending, 'Nenhuma opção esperando análise.')}${moderationSectionHTML('Ideias de novos rankings', rankingPending, 'Nenhuma ideia de ranking esperando análise.')}${moderationSectionHTML('Prontos para criação', approvedRankings, 'Nenhum ranking aprovado aguardando criação.')}${moderationSectionHTML('Analisadas recentemente', reviewed, 'As decisões recentes aparecerão aqui.')}<div class="end"><a class="backLink" href="/perfil">← voltar ao perfil</a></div>`;
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
  if (kind === 'auth' || kind === 'profile' || kind === 'moderation' || hasClerkSession)
    await initClerk();
  await load();
}
boot();
