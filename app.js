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
  lastHeroKey = 'topo_last_home_hero',
  previewIntentKey = 'topo_preview_vote_intent';
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
  activeGroup = generalGroupFromRoute() || localRouteState().group || 'Todos',
  homePortal = !isLocalRoute() && !isCategoryRoute(),
  homeSearch = (queryParams.get('busca') || '').trim(),
  categorySort = 'priority',
  categoryVisibleCount = CATEGORY_PAGE_SIZE,
  allItemsOpen = false,
  sessionHeroId = '',
  selectedCity = '',
  detectedCity = '',
  viewer = {
    registered: false,
    isModerator: false,
    anonymousUsed: 0,
    anonymousLimit: 30,
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
  return 'home';
}
function isLocalRoute() {
  return location.pathname === '/local' || location.pathname.startsWith('/local/');
}
function isCategoryRoute() {
  return location.pathname === '/categoria' || location.pathname.startsWith('/categoria/');
}
function isLocalExperience() {
  if (isLocalRoute()) return true;
  if (pageKind() !== 'ranking' || !rankings.length) return false;
  return topoLocal.isLocalRanking(rankings.find((ranking) => ranking.id === internalId()));
}
function groupPath(group) {
  if (isLocalExperience()) return topoLocal.collectionPath(selectedCity, group);
  return group === 'Todos' ? '/' : `/categoria/${generalGroupSlugs[group] || ''}`;
}
document.body.classList.toggle('homePage', pageKind() === 'home');
document.body.classList.toggle('rankingPage', pageKind() === 'ranking');
document.body.classList.toggle('profilePage', pageKind() === 'profile');
document.body.classList.toggle('moderationPage', pageKind() === 'moderation');
document.body.classList.toggle('localMode', isLocalRoute());
if (searchInput && homeSearch) searchInput.value = homeSearch;
function experienceRankings() {
  return rankings.filter((ranking) =>
    isLocalExperience() ? topoLocal.isLocalRanking(ranking) : !topoLocal.isLocalRanking(ranking),
  );
}
function localRankingsForSelectedCity(list = experienceRankings()) {
  if (!isLocalExperience()) return list;
  return topoLocal.rankingsForCity(list, selectedCity);
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
    accountEl.innerHTML = `<a class="accountLink accountEnter" href="/entrar">Entrar</a><span class="voteMeter">${viewer.votingRequiresAccount ? 'entre para votar' : `${fmt(viewer.anonymousUsed || 0)}/${viewer.anonymousLimit || 30} votos`}</span>`;
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
  const local = isLocalExperience();
  document.body.classList.toggle('localMode', local);
  experienceLinks.forEach((link) => {
    const active = link.dataset.experience === (local ? 'local' : 'topo');
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (searchForm) searchForm.action = local ? '/local' : '/';
  if (searchInput) {
    searchInput.placeholder = local
      ? `Buscar lugares em ${selectedCity || 'sua cidade'}`
      : 'Buscar rankings, temas ou itens';
    searchInput.setAttribute(
      'aria-label',
      local ? `Buscar rankings locais em ${selectedCity || 'sua cidade'}` : 'Buscar rankings',
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
    if (pageKind() !== 'home') return;
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
    if (pageKind() !== 'home') return;
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
function pageLoadingHTML(kind) {
  if (kind === 'auth')
    return '<div class="authPreload"><span class="loadingSpinner" aria-hidden="true"></span><strong>Abrindo seu acesso por e-mail…</strong><span>Pode levar alguns segundos.</span></div>';
  if (kind === 'profile')
    return '<div class="authPreload"><span class="loadingSpinner" aria-hidden="true"></span><strong>Carregando seu perfil…</strong></div>';
  if (kind === 'moderation')
    return '<div class="authPreload"><span class="loadingSpinner" aria-hidden="true"></span><strong>Abrindo a moderação…</strong></div>';
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
      if (kind === 'ranking') renderInternal();
      else if (kind === 'auth') await renderAuth();
      else if (kind === 'profile') await renderProfile();
      else if (kind === 'moderation') await renderModeration();
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
      ? experienceSource
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
      (path.startsWith('/ranking/') || path === '/perfil' || path.startsWith('/moderacao'));
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
function previewVoteActionsHTML(r, o, wrapperClass = 'portalVoteActions') {
  const rankingId = escapeHTML(r.id),
    label = escapeHTML(o.label);
  return `<span class="${wrapperClass}"><button class="homeReact up ${o.mine === 1 ? 'selected' : ''}" type="button" data-id="${o.id}" data-dir="1" data-preview-ranking="${rankingId}" data-preview-label="${label}" aria-label="Abrir o ranking com ${label} em destaque para confirmar voto para cima">↑</button><button class="homeReact down ${o.mine === -1 ? 'selected' : ''}" type="button" data-id="${o.id}" data-dir="-1" data-preview-ranking="${rankingId}" data-preview-label="${label}" aria-label="Abrir o ranking com ${label} em destaque para confirmar voto para baixo">↓</button></span>`;
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
function whatsAppShareURL(r) {
  const leader = r?.opts?.[0]?.label || '',
    url = location.origin + rankingPath(r.id),
    text = `*${r.q}*\n${leader ? '🥇 ' + leader + ' está no topo agora.\n' : ''}Vote e mude o ranking no TOPO:\n${url}`;
  return 'https://wa.me/?text=' + encodeURIComponent(text);
}
function whatsAppShareHTML(r, compact = false) {
  return `<a class="whatsappShare ${compact ? 'compact' : ''}" href="${escapeHTML(whatsAppShareURL(r))}" target="_blank" rel="noopener noreferrer" aria-label="Compartilhar ${escapeHTML(r.q)} no WhatsApp"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.4 11.8a8.4 8.4 0 0 1-12.5 7.4L3 20.5l1.3-4.7a8.4 8.4 0 1 1 16.1-4Z"></path><path d="M8.1 7.7c.4 3.5 2.7 5.8 6.2 6.3.7.1 1.4-.9 1-1.4l-1.1-1c-.3-.3-.7-.3-1 0l-.7.5a7.2 7.2 0 0 1-2.7-2.7l.5-.7c.2-.3.2-.7 0-1L9.4 6.6c-.5-.5-1.4.3-1.3 1.1Z"></path></svg>${compact ? '' : '<span>Compartilhar no WhatsApp</span>'}</a>`;
}
function portalHeroHTML(r) {
  return `<article class="portalHero"><a class="portalHeroLink" href="${rankingPath(r.id)}"><span class="portalHeroMedia">${portalImageHTML(r, true)}</span><span class="portalHeroCopy"><span class="portalHeroEyebrow">RANKING DO MOMENTO</span><span class="portalKicker"><span class="portalHeroCategory">${escapeHTML(categoryLabel(r))}</span>${newBadgeHTML(r)}</span><h1>${escapeHTML(r.q)}</h1><span class="portalHeroAction">abrir ranking →</span></span></a>${whatsAppShareHTML(r, true)}</article>`;
}
function popHomeLeadHTML(hero) {
  return `<div class="popHomeStats" aria-label="Números da comunidade"><span class="popHomeTagline">Tudo vira ranking.</span><span><strong>${fmt(community.rankings)}</strong> rankings</span><i></i><span><strong>${fmt(community.votes)}</strong> votos</span><button type="button" onclick="reshuffle()">trocar destaque ↻</button></div><section class="portalLeadGrid popHomeLead editorialHomeLead" aria-label="Ranking em destaque">${portalHeroHTML(hero)}</section>`;
}
function popLocalCalloutHTML() {
  return `<section class="popLocalCallout"><div><span class="popEyebrow">PERTO DE VOCÊ</span><h2>TOPO <em>LOCAL</em></h2><p>Quem mora escolhe. Todo mundo descobre.</p></div><div class="popLocalCity"><span>●</span><strong>${escapeHTML(selectedCity || 'Sua cidade')}</strong></div><div class="popLocalTopics"><span>Restaurantes</span><span>Pizza</span><span>Cafés</span><span>Academias</span></div><a href="/local" aria-label="Abrir o TOPO LOCAL">↗</a></section>`;
}
function portalSideStoryHTML(r) {
  return `<article class="portalSideStory"><a class="portalSideMedia" href="${rankingPath(r.id)}">${portalImageHTML(r)}</a><div class="portalSideCopy"><span class="portalKicker">${escapeHTML(categoryLabel(r))} ${newBadgeHTML(r)}</span><a href="${rankingPath(r.id)}"><h2>${escapeHTML(r.q)}</h2></a><div class="portalSideFoot"><span class="portalStoryMeta">${voteCountText(r.votes)}</span>${whatsAppShareHTML(r, true)}</div></div></article>`;
}
function portalListHTML(title, list, tone = '') {
  return `<section class="portalRankPanel ${tone}"><div class="portalPanelTitle">${title}</div><ol>${list.map((r, i) => `<li><span class="portalListNum">${String(i + 1).padStart(2, '0')}</span><a href="${rankingPath(r.id)}"><strong>${escapeHTML(r.q)}</strong><small>${tone === 'disputed' ? escapeHTML(gapText(r)) : voteCountText(r.votes)}</small></a></li>`).join('')}</ol></section>`;
}
function portalStoryHTML(r, i) {
  const variant = !r.img || i % 4 === 2 ? 'compact' : i % 4 === 0 ? 'feature' : 'row';
  return `<article class="portalStory ${variant}">${variant !== 'compact' ? `<a class="portalStoryMedia" href="${rankingPath(r.id)}">${portalImageHTML(r)}</a>` : ''}<div class="portalStoryCopy"><span class="portalKicker">${escapeHTML(categoryLabel(r))} ${newBadgeHTML(r)}</span><a href="${rankingPath(r.id)}"><h2>${escapeHTML(r.q)}</h2></a><div class="portalStoryFoot"><span>${voteCountText(r.votes)}</span><div class="portalStoryActions">${whatsAppShareHTML(r, true)}<a href="${rankingPath(r.id)}">abrir ranking →</a></div></div></div></article>`;
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
function categoryRankCardHTML(r) {
  const voteHref = `${rankingPath(r.id)}#votar`;
  return `<article class="categoryRankCard"><a class="categoryRankMedia" href="${rankingPath(r.id)}">${portalImageHTML(r)}</a><div class="categoryRankCopy"><div class="categoryRankMeta"><span class="categoryWrap"><a class="category" href="${rankingCategoryPath(r)}">${escapeHTML(categoryLabel(r))}</a>${newBadgeHTML(r)}</span><span>${voteCountText(r.votes)}</span></div><a class="categoryRankTitle" href="${rankingPath(r.id)}"><h2>${escapeHTML(r.q)}</h2></a><div class="categoryRankLinks">${whatsAppShareHTML(r, true)}<a class="categoryVoteCta" href="${voteHref}">VER RANKING <b>→</b></a></div></div></article>`;
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
        categorySort = button.dataset.categorySort;
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
    ['priority', isAll ? 'Recomendados' : 'Para votar'],
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
    category = `${r.cat} ${experienceGroupOf(r)}`,
    items = (r.opts || []).map((o) => o.label).join(' ');
  if (title.startsWith(needle)) return 4;
  if (searchMatches(r.q, homeSearch)) return 3;
  if (searchMatches(category, homeSearch)) return 2;
  if (searchMatches(items, homeSearch)) return 1;
  return 0;
}
function renderSearchResults(visible) {
  const local = isLocalExperience(),
    sorted = sortForExperience(
      visible,
      (a, b) =>
        searchRelevance(b) - searchRelevance(a) || Number(b.votes || 0) - Number(a.votes || 0),
    );
  document.title = `Busca: ${homeSearch} — ${local ? 'TOPO LOCAL' : 'TOPO'}`;
  feed.innerHTML = `<section class="searchResultsHead"><div><span class="portalKicker">${local ? `Busca no TOPO LOCAL · ${escapeHTML(selectedCity)}` : 'Busca em todo o TOPO'}</span><h1>Resultados para “${escapeHTML(homeSearch)}”</h1><p>${fmt(sorted.length)} ranking${sorted.length === 1 ? ' encontrado' : 's encontrados'}${local ? ` em ${escapeHTML(selectedCity)}` : ', em todas as categorias'}. Abra um ranking para ver os itens e votar.</p></div><button id="clearHomeSearch" type="button">Limpar busca</button></section><section class="searchRankList">${sorted.map(categoryRankCardHTML).join('')}</section><div class="end">${local ? 'TOPO LOCAL' : 'TOPO'} · tudo vira ranking</div>`;
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
    used = new Set([hero.id]),
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
  feed.innerHTML = `${popHomeLeadHTML(hero)}${portalTrendingHTML(portalVisible, 'Em alta')}<section class="popHomeSection" id="para-voce"><div class="portalSectionHead"><div><span>MAIS PARA DESCOBRIR</span><h2>Mais rankings</h2></div><button class="shuffleBtn portalShuffle" onclick="reshuffle()">↻ mudar seleção</button></div><section class="categoryRankGrid popHomeGrid">${forYou.map(categoryRankCardHTML).join('')}</section></section>${popLocalCalloutHTML()}<div class="portalSectionHead"><div><span>ACABARAM DE CHEGAR</span><h2>Novos rankings</h2></div><button class="shuffleBtn portalShuffle" onclick="reshuffle()">↻ embaralhar</button></div><section class="portalNewsLayout"><div class="portalStoryFeed">${stories.map(portalStoryHTML).join('')}</div><aside>${portalListHTML('Mais polêmicos', disputed, 'disputed')}</aside></section>${more.length ? `<section class="portalMore"><div class="portalPanelTitle">Mais para explorar</div><div class="portalMoreGrid">${more.map(portalSideStoryHTML).join('')}</div></section>` : ''}<div class="end">TOPO · tudo vira ranking</div>`;
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
function rankingVoteRowHTML(o, i, extraClass = '') {
  const upSelected = Number(o.mine) === 1,
    downSelected = Number(o.mine) === -1,
    label = escapeHTML(o.label);
  return `<div class="option ${extraClass}" data-option-id="${o.id}" data-option-label="${label}"><div class="pos">${rankMark(i)}</div><div><div class="name">${label}</div><div class="score">${pointCountText(o.score)} · ${i + 1}º lugar ${doubleVoteBadgeHTML(o)}</div></div><div class="actions"><button class="react up ${upSelected ? 'selected' : ''}" data-id="${o.id}" data-mine="${o.mine}" data-dir="1" aria-label="${upSelected ? 'Remover voto em' : 'Fazer'} ${label}${upSelected ? '' : ' subir'}">↑</button>${doubleVoteActionHTML(o, 1)}<button class="react down ${downSelected ? 'selected' : ''}" data-id="${o.id}" data-mine="${o.mine}" data-dir="-1" aria-label="${downSelected ? 'Remover voto em' : 'Fazer'} ${label}${downSelected ? '' : ' descer'}">↓</button>${doubleVoteActionHTML(o, -1)}</div></div>`;
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
function renderInternal() {
  const id = internalId(),
    r = rankings.find((x) => x.id === id);
  if (!r) {
    feed.innerHTML =
      '<div class="loading">Ranking não encontrado.<br><a class="backLink" href="/">← Voltar para a Home</a></div>';
    return;
  }
  const local = topoLocal.isLocalRanking(r),
    homePath = local ? topoLocal.collectionPath(topoLocal.cityForRanking(r)) : '/',
    homeLabel = local ? 'TOPO LOCAL' : 'TOPO',
    categoryPath = rankingCategoryPath(r);
  document.title = `${r.q} — ${homeLabel}`;
  const visibleLimit = allItemsOpen ? r.opts.length : Math.min(10, r.opts.length),
    visibleOptions = r.opts.slice(0, visibleLimit);
  feed.innerHTML = `<div class="internalHead"><a class="backLink" href="${homePath}">← ${homeLabel}</a><span class="internalMeta">${fmt(r.votes)} votos · Top ${visibleLimit}</span></div><article class="rank rankingMain" id="votar"><div class="rankHead"><span class="categoryWrap"><a class="category" href="${categoryPath}">${escapeHTML(categoryLabel(r))}</a>${newBadgeHTML(r)}</span><span class="total">Top ${visibleLimit}</span></div><h1>${escapeHTML(r.q)}</h1>${r.img ? `<div class="imageStrip"><img data-ranking-image src="${escapeHTML(r.img)}" alt="${escapeHTML(r.q)}" decoding="async"></div>` : ''}<div class="statsRow"><div class="statBox"><div class="statLabel">Votos hoje</div><div class="statValue">${fmt(r.todayVotes || 0)}</div></div><div class="statBox"><div class="statLabel">Disputa no topo</div><div class="statValue">${topGap(r) === 0 ? 'Empate' : topGap(r) + ' pt'}</div></div></div><div class="rankingResultHead"><span>Resultado atual</span><strong>Top ${visibleLimit}</strong></div><div class="options">${visibleOptions.map((o, i) => rankingVoteRowHTML(o, i)).join('')}</div><div class="rankFoot"><span>Até ${viewer.rankingLimit || 20} votos por ranking.</span><span>${viewer.registered ? 'Vote normalmente · 2× reforça' : '↑ sobe · ↓ desce'}</span></div>${allItemsExplorerHTML(r)}${rankingOptionSuggestionHTML(r)}</article>${rankingContinuationHTML(r)}${commentsShellHTML()}${editorialHTML(r)}<div class="end"><a class="backLink" href="${homePath}">← voltar para todos os rankings ${local ? 'locais' : ''}</a></div>`;
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
    const res = await fetch('/api?action=profile&device_id=' + encodeURIComponent(deviceId), {
      cache: 'no-store',
    });
    if (res.status === 401) {
      location.replace('/entrar?modo=entrar');
      return;
    }
    if (!res.ok) throw new Error('profile_load_failed');
    const p = await res.json(),
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
    feed.innerHTML = `<div class="internalHead"><a class="backLink" href="/">← TOPO</a><button class="logoutBtn" id="logoutBtn">Sair</button></div><section class="profileHero profileGameHero"><div class="profileAvatarProgress" style="--profile-progress:${progress.progress}%"><div class="profileAvatarRing"><div class="profileAvatar"><img id="profileAvatarImage" alt="Foto de perfil de ${escapeHTML(p.user.name)}" ${avatar ? `src="${escapeHTML(avatar)}"` : 'hidden'}><span id="profileAvatarInitial" ${avatar ? 'hidden' : ''}>${escapeHTML(profileInitial(p.user.name))}</span></div></div><span class="profileProgressCount">${fmt(progress.total)}</span></div><div class="profileHeroCopy"><div><div class="authEyebrow">Seu perfil</div><div class="profileName">${escapeHTML(p.user.name)}</div><div class="profileEmail">${escapeHTML(p.user.email)} · desde ${date}</div></div>${profileNameEditorHTML(p.user)}<div class="profileBadges"><span>${escapeHTML(level)}</span><span>${unlockedText}</span></div><p class="profileProgressText">${progressText}</p><div class="profileMetrics" aria-label="Resumo do perfil"><span><strong>${fmt(p.stats.votes)}</strong><small>votos ativos</small></span><span><strong>${fmt(p.stats.rankings)}</strong><small>rankings</small></span><span><strong>${fmt(p.stats.streak || 0)} dia${Number(p.stats.streak || 0) === 1 ? '' : 's'}</strong><small>sequência</small></span></div></div></section><div class="profileDashboard"><section class="profileSection profilePowerSection"><div class="profileSectionHead"><div class="sectionLabel">Seus votos duplos</div><span>${powerSummary}</span></div><div class="profilePowerList">${profileDoubleVotesHTML(doubleVotes)}</div><p class="profileComingSoon"><strong>Como usar:</strong> vote normalmente e toque no pequeno botão 2× que aparece ao lado da seta escolhida. Toque no 2× novamente para voltar ao voto simples; toque na seta marcada para remover o voto inteiro.</p><div class="profilePhotoPanel"><div class="profilePhotoTitle">Foto do perfil</div><input id="profilePhotoInput" type="file" accept="image/jpeg,image/png,image/webp" hidden><div class="profilePhotoActions"><button type="button" id="chooseProfilePhoto">${avatar ? 'Trocar foto' : 'Adicionar foto'}</button><button type="button" id="removeProfilePhoto" ${avatar ? '' : 'hidden'}>Remover</button></div><label class="profilePhotoCheck"><input id="profilePhotoVisibility" type="checkbox" ${showAvatar ? 'checked' : ''}><span>Mostrar minha foto no ranking de usuários</span></label><p class="profilePhotoNote">A imagem é recortada e reduzida antes de ser salva. Você também pode usar apenas a inicial.</p><div class="profilePhotoStatus" id="profilePhotoStatus" aria-live="polite"></div></div></section><section class="profileSection profileVoteStyle"><div class="profileSectionHead"><div class="sectionLabel">Seu jeito de votar</div><span>votos ativos</span></div><div class="profileVoteSplit" aria-label="${upPercent}% para cima e ${downPercent}% para baixo"><span class="up" style="width:${upPercent}%"></span><span class="down" style="width:${downPercent}%"></span></div><div class="profileVoteLegend"><span><i class="up"></i><strong>${fmt(up)} ↑</strong> para cima</span><span><i class="down"></i><strong>${fmt(down)} ↓</strong> para baixo</span></div><div class="profileSubhead">Categorias favoritas</div>${profileCategoriesHTML(p.categories)}</section></div><section class="profileSection profileRecentSection"><div class="profileSectionHead"><div class="sectionLabel">Seus votos recentes</div><span>últimas escolhas</span></div>${profileRecentHTML(p.recent)}</section>`;
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
    `<div class="modalKicker">Como funciona</div><div class="modalTitle">Você mexe no ranking.</div><div class="modalText">Se concorda com a posição, deixe como está.</div><div class="howRows"><div class="howRow"><span class="howIcon up">↑</span><span class="howCopy">Acha que deveria estar mais acima.</span></div><div class="howRow"><span class="howIcon down">↓</span><span class="howCopy">Acha que deveria estar mais abaixo.</span></div><div class="howRow"><span class="howIcon double">2×</span><span class="howCopy">Depois de votar, use o pequeno botão 2× ao lado da seta para reforçar esse voto.</span></div></div><div class="modalText">Você pode mexer em até <b>${viewer.rankingLimit || 20} opções por ranking</b>. Sem cadastro, tem <b>${viewer.anonymousLimit || 30} votos livres no total</b>. Os votos duplos são conquistados no perfil.</div><div class="modalActions"><button class="main" data-close>Entendi</button></div>`,
  );
}
function showRegistrationWall() {
  showModal(
    `<div class="modalKicker">30 votos usados</div><div class="modalTitle">Quer continuar mexendo no TOPO?</div><div class="modalText">Entre com um código enviado ao seu e-mail. Sem senha e sem complicação.</div><div class="modalActions"><button data-close>Agora não</button><a class="main" href="/entrar">Entrar ou criar conta</a></div>`,
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
      `<div class="rankingShareRow">${whatsAppShareHTML(r)}</div>`,
    );
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
  document
    .querySelectorAll('.react,.homeReact')
    .forEach((b) => (b.onclick = () => (b.dataset.previewRanking ? previewReact(b) : react(b))));
  document
    .querySelectorAll('[data-double-vote]')
    .forEach((b) => (b.onclick = () => toggleDoubleVote(b)));
  mountInternalShare();
}
function openPreviewRanking(rankingId, optionId, direction, label) {
  try {
    sessionStorage.setItem(
      previewIntentKey,
      JSON.stringify({ rankingId, optionId, direction, label }),
    );
  } catch {}
  location.assign(`${rankingPath(rankingId)}#votar`);
}
function showPendingPreviewVoteIntent() {
  if (pageKind() !== 'ranking') return;
  let intent = null;
  try {
    intent = JSON.parse(sessionStorage.getItem(previewIntentKey) || 'null');
    sessionStorage.removeItem(previewIntentKey);
  } catch {}
  const optionId = Number(intent?.optionId),
    direction = Number(intent?.direction),
    rankingId = String(intent?.rankingId || '');
  if (!Number.isInteger(optionId) || ![1, -1].includes(direction) || rankingId !== internalId())
    return;
  const ranking = rankings.find((r) => r.id === rankingId),
    optionIndex = ranking?.opts?.findIndex((o) => Number(o.id) === optionId) ?? -1;
  if (optionIndex >= 10 && !allItemsOpen) {
    allItemsOpen = true;
    renderInternal();
  }
  const arrow = document.querySelector(
      `.rankingMain .react[data-id="${optionId}"][data-dir="${direction}"]`,
    ),
    row = arrow?.closest('.option');
  if (!row) return;
  const prompt = document.createElement('div'),
    label = String(intent?.label || row.dataset.optionLabel || 'esta opção');
  prompt.className = 'previewVotePrompt';
  prompt.textContent = `O voto ainda não foi computado. Toque na seta ${direction === 1 ? '↑' : '↓'} destacada para confirmar em ${label}.`;
  row.before(prompt);
  row.classList.add('previewFocus');
  arrow.classList.add('previewIntent');
  setTimeout(() => prompt.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
}
function previewReact(b) {
  const optionId = Number(b.dataset.id),
    direction = Number(b.dataset.dir),
    rankingId = String(b.dataset.previewRanking || ''),
    label = String(b.dataset.previewLabel || '');
  if (!rankingId || !Number.isInteger(optionId) || ![1, -1].includes(direction)) return;
  openPreviewRanking(rankingId, optionId, direction, label);
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
  else renderHome();
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
      viewer.anonymousUsed = viewer.anonymousLimit || 30;
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
    if (res.status === 409 && result.error === 'device_rekey_required') {
      rotateDeviceId();
      await load();
      toast('Conta protegida. Tente votar novamente.');
      return;
    }
    if (!res.ok) throw result;
    if (!applyVoteResult(optionId, result)) await refreshVoteState(rankOrder);
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
  document.title = 'Moderação — TOPO';
  if (!viewer.registered) {
    location.replace(`/entrar?voltar=${encodeURIComponent(location.pathname + location.search)}`);
    return;
  }
  feed.innerHTML = pageLoadingHTML('moderation');
  try {
    const response = await fetch('/api?action=moderation', { cache: 'no-store' }),
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
    feed.innerHTML = `<div class="internalHead"><a class="backLink" href="/perfil">← Perfil</a><span class="internalMeta">${escapeHTML(data.moderator?.email || '')}</span></div><header class="moderationHero"><span class="suggestionEyebrow">Painel privado</span><h1>Moderação da comunidade</h1><p>${heroMessage}</p><div class="moderationCounts"><span><strong>${optionPending.length}</strong> opções</span><span><strong>${rankingPending.length}</strong> novos rankings</span><span><strong>${namePending.length}</strong> nomes</span><span><strong>${approvedRankings.length}</strong> para criar</span></div></header>${moderationSectionHTML('Nomes denunciados', namePending, 'Nenhum nome esperando análise.')}${moderationSectionHTML('Opções para rankings', optionPending, 'Nenhuma opção esperando análise.')}${moderationSectionHTML('Ideias de novos rankings', rankingPending, 'Nenhuma ideia de ranking esperando análise.')}${moderationSectionHTML('Prontos para criação', approvedRankings, 'Nenhum ranking aprovado aguardando criação.')}${moderationSectionHTML('Analisadas recentemente', reviewed, 'As decisões recentes aparecerão aqui.')}<div class="end"><a class="backLink" href="/perfil">← voltar ao perfil</a></div>`;
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
  showPendingPreviewVoteIntent();
}
boot();
