import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { neon } from '@neondatabase/serverless';
import { possibleOptionDuplicate } from './option-similarity.js';
import {
  defaultDisplayName,
  displayNameChangeState,
  validateDisplayName,
} from './profile-names.js';
import { rankingQuestion } from './ranking-titles.js';
import { rankingImageSearchQueries, resolveRankingCover } from './ranking-image-policy.js';
import { LOCAL_CITIES, localCityByLabel, localCityBySlug } from './seo-taxonomy.js';
import {
  PARTICIPATION_SCORE,
  qualifyRankingShare,
  scoreParticipationQueries,
} from './participation-score.js';

const sql = neon(process.env.DATABASE_URL);
const LOCAL_CITY_LABELS = Object.freeze(LOCAL_CITIES.map((city) => city.label));
const CLERK_SECRET_KEY = String(process.env.CLERK_SECRET_KEY || '');
const CLERK_PUBLISHABLE_KEY = String(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || '',
);
const clerkClient = CLERK_SECRET_KEY
  ? createClerkClient({
      secretKey: CLERK_SECRET_KEY,
      publishableKey: CLERK_PUBLISHABLE_KEY,
    })
  : null;
const ANONYMOUS_LIMIT = 30;
const ANONYMOUS_DUEL_LIMIT = 5;
const RANKING_LIMIT = 20;
const DOUBLE_VOTE_THRESHOLDS = [20, 75, 200];
const RANKING_SHARE_CHANNELS = new Set(['native', 'whatsapp', 'duel', 'promotion']);
const PROFILE_LEVEL_MILESTONES = Object.freeze([
  { at: 20, key: 'explorer', name: 'Explorador de rankings' },
  { at: 75, key: 'curator', name: 'Curador do TOPO' },
  { at: 200, key: 'reference', name: 'Referência no TOPO' },
]);
const NOTIFICATION_LIMIT = 30;
const NOTIFICATION_RETURN_DAYS = 7;
const RANKING_NOTIFICATION_FANOUT_LIMIT = 500;
const PROFILE_AVATAR_MAX_LENGTH = 240000;
const COMMENT_LIMIT = 200;
const COMMENTS_PAGE_SIZE = 20;
const OPTION_SUGGESTION_DAILY_LIMIT = 3;
const TOPIC_SUGGESTION_WEEKLY_LIMIT = 1;
const NAME_REPORT_DAILY_LIMIT = 5;
const SUGGESTION_OPTION_LIMIT = 80;
const SUGGESTION_TITLE_LIMIT = 120;
const PENDING_RANKING_CATEGORY = 'A definir';
const PENDING_RANKING_EXAMPLES = Object.freeze(['A definir 1', 'A definir 2', 'A definir 3']);
const PUBLISHED_RANKING_OPTION_LIMIT = 20;
const GENERAL_PUBLIC_OPTION_COUNT = 14;
const PUBLISHED_RANKING_IMAGE_LIMIT = 1000;
const RANKING_IMAGE_MAX_BYTES = 1500000;
const RANKING_IMAGE_DATA_LIMIT = 2000000;
const RANKING_IMAGE_SUGGESTION_LIMIT = 6;
const RANKING_IMAGE_SEARCH_TIMEOUT_MS = 9000;
const VIP_PASSWORD_MIN_LENGTH = 4;
const VIP_PASSWORD_MAX_LENGTH = 80;
const VIP_ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const VIP_UNLOCK_WINDOW_MINUTES = 15;
const VIP_UNLOCK_ATTEMPT_LIMIT = 8;
const USER_VIP_RANKING_LIMIT = 20;
const VIP_DESCRIPTION_LIMIT = 280;
const VIP_COOKIE_PREFIX = 'topo_vip_';
const FAVORITE_SHARE_TOKEN_PATTERN = /^[a-zA-Z0-9_-]{24,64}$/;
const BUILT_IN_MODERATOR_EMAIL_HASHES = new Set([
  '225c33c5e9c8aff600ac4f1576d55f0ddbd9e9934b58270a51d1d7887c7b1794',
]);
const SESSION_COOKIE = 'topo_session';
const DEVICE_PATTERN = /^[a-zA-Z0-9-]{16,100}$/;
const SUGGESTION_CATEGORY_VALUES = Object.freeze([
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
  'Futebol',
  'Animais',
  'Jogos',
  'Tecnologia',
  'Produtos',
  'Compras',
  'Luxo',
  'Viagens',
  'Vida',
]);
const SUGGESTION_CATEGORIES = new Set(SUGGESTION_CATEGORY_VALUES);

function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

function parseBody(req) {
  if (typeof req.body === 'string') {
    return JSON.parse(req.body || '{}');
  }

  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    return req.body;
  }

  return {};
}

function queryValue(req, key) {
  const value = req.query?.[key];
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

function geolocationCity(req) {
  const value = req.headers?.['x-vercel-ip-city'],
    encoded = Array.isArray(value) ? value[0] : value;
  if (!encoded) return '';
  try {
    return decodeURIComponent(String(encoded).replace(/\+/g, '%20'))
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim()
      .slice(0, 80);
  } catch {
    return String(encoded)
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim()
      .slice(0, 80);
  }
}

function preferredCatalogCity(req) {
  const requested = queryValue(req, 'city').trim();
  const detected = geolocationCity(req);
  return (
    localCityByLabel(requested) ||
    localCityBySlug(requested) ||
    localCityByLabel(detected) ||
    localCityByLabel('Florianópolis')
  ).label;
}

function isValidDevice(deviceId) {
  return DEVICE_PATTERN.test(deviceId);
}

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function isValidEmail(email) {
  return email.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function profileNamePayload(user) {
  const state = displayNameChangeState(user?.display_name_updated_at);
  return {
    name: user?.display_name || 'Pessoa no TOPO',
    displayNameUpdatedAt: user?.display_name_updated_at || null,
    canChangeName: state.canChange,
    nameChangeAvailableAt: state.availableAt,
    hasChosenName: Boolean(user?.display_name_updated_at),
  };
}

function cookies(req) {
  const header = String(req.headers?.cookie || req.headers?.Cookie || '');
  const result = {};

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;

    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();

    try {
      result[key] = decodeURIComponent(value);
    } catch {
      result[key] = value;
    }
  }

  return result;
}

function vipPassword(value) {
  if (typeof value !== 'string') return null;
  const password = value.normalize('NFKC').trim();
  const length = [...password].length;
  return length >= VIP_PASSWORD_MIN_LENGTH && length <= VIP_PASSWORD_MAX_LENGTH ? password : null;
}

function hashVipPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const digest = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${digest}`;
}

function verifyVipPassword(password, storedHash) {
  const [algorithm, salt, expectedHex, extra] = String(storedHash || '').split('$');
  if (algorithm !== 'scrypt' || !/^[a-f0-9]{32}$/i.test(salt) || extra !== undefined) return false;
  if (!/^[a-f0-9]{128}$/i.test(expectedHex)) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function vipSigningKey() {
  const secret = String(process.env.TOPO_VIP_SECRET || CLERK_SECRET_KEY || '');
  if (secret.length < 16) return null;
  return createHash('sha256').update(`topo-vip-access-v1:${secret}`).digest();
}

function vipCookieName(rankingId) {
  const idHash = createHash('sha256')
    .update(String(rankingId || ''))
    .digest('hex')
    .slice(0, 20);
  return `${VIP_COOKIE_PREFIX}${idHash}`;
}

function vipAccessSignature(rankingId, version, expiresAt) {
  const key = vipSigningKey();
  if (!key) return '';
  return createHmac('sha256', key)
    .update(`${rankingId}:${version}:${expiresAt}`)
    .digest('base64url');
}

function safeTokenEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function vipCookieAccess(req, ranking) {
  const version = Number(ranking?.vipPasswordVersion ?? ranking?.vip_password_version ?? 0);
  const token = cookies(req)[vipCookieName(ranking?.id)];
  if (!token || !Number.isSafeInteger(version)) return false;
  const [tokenVersion, tokenExpiry, signature, extra] = String(token).split('.');
  const expiresAt = Number(tokenExpiry);
  if (
    extra !== undefined ||
    Number(tokenVersion) !== version ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Math.floor(Date.now() / 1000)
  ) {
    return false;
  }
  return safeTokenEqual(signature, vipAccessSignature(ranking.id, version, expiresAt));
}

function hasVipAccess(req, user, ranking) {
  const isVip = ranking?.isVip === true || ranking?.is_vip === true;
  const ownerUserId = ranking?.vipOwnerUserId ?? ranking?.vip_owner_user_id;
  const isOwner = Boolean(user?.id && ownerUserId && String(user.id) === String(ownerUserId));
  return !isVip || isModerator(user) || isOwner || vipCookieAccess(req, ranking);
}

function vipCookieIsSecure(req) {
  const protocol = String(req.headers?.['x-forwarded-proto'] || '').toLowerCase();
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').toLowerCase();
  return protocol === 'https' || !/^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(host);
}

function setVipAccessCookie(req, res, rankingId, version) {
  if (!vipSigningKey()) return false;
  const expiresAt = Math.floor(Date.now() / 1000) + VIP_ACCESS_MAX_AGE_SECONDS;
  const token = `${version}.${expiresAt}.${vipAccessSignature(rankingId, version, expiresAt)}`;
  const secure = vipCookieIsSecure(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${vipCookieName(rankingId)}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${VIP_ACCESS_MAX_AGE_SECONDS}${secure}`,
  );
  return true;
}

function vipClientKey(req) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  const remote = String(req.socket?.remoteAddress || '');
  const userAgent = String(req.headers?.['user-agent'] || '').slice(0, 240);
  const key = vipSigningKey();
  if (!key) return '';
  return createHmac('sha256', key)
    .update(`${forwarded || remote || 'unknown'}\n${userAgent}`)
    .digest('hex');
}

function requestOrigin(req) {
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '')
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9.-]+(?::\d+)?$/.test(host)) return '';
  return `https://${host}`;
}

function clerkFrontendApi() {
  const encoded = CLERK_PUBLISHABLE_KEY.replace(/^pk_(?:test|live)_/, '');
  if (!encoded || encoded === CLERK_PUBLISHABLE_KEY) return '';
  try {
    const host = Buffer.from(encoded, 'base64')
      .toString('utf8')
      .replace(/\$$/, '')
      .trim()
      .toLowerCase();
    return /^[a-z0-9.-]+$/.test(host) ? host : '';
  } catch {
    return '';
  }
}

function clerkSessionToken(req) {
  const authorization = String(req.headers?.authorization || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || cookies(req).__session || '';
}

async function clerkUserForRequest(req) {
  const token = clerkSessionToken(req);
  if (!token || !clerkClient || !CLERK_SECRET_KEY) return null;

  let payload;
  try {
    const origin = requestOrigin(req);
    payload = await verifyToken(token, {
      secretKey: CLERK_SECRET_KEY,
      ...(origin ? { authorizedParties: [origin] } : {}),
    });
  } catch {
    return null;
  }

  const clerkUserId = String(payload?.sub || '');
  if (!clerkUserId) return null;
  const [linked] = await sql.query(
    `
    SELECT u.id, u.email, u.display_name, u.display_name_updated_at, u.created_at,
           l.clerk_user_id
    FROM clerk_user_links l
    JOIN users u ON u.id = l.user_id
    WHERE l.clerk_user_id = $1
    LIMIT 1
  `,
    [clerkUserId],
  );
  if (linked) return linked;

  const identity = await clerkClient.users.getUser(clerkUserId);
  const primaryEmail = identity.primaryEmailAddress;
  const email = normalizeEmail(primaryEmail?.emailAddress);
  if (primaryEmail?.verification?.status !== 'verified') return null;
  if (!isValidEmail(email)) return null;
  let [user] = await sql.query(
    `
    SELECT id, email, display_name, display_name_updated_at, created_at
    FROM users
    WHERE lower(email) = lower($1)
    LIMIT 1
  `,
    [email],
  );

  if (!user) {
    const userId = randomUUID();
    const displayName = defaultDisplayName(userId);
    try {
      [user] = await sql.query(
        `
        INSERT INTO users (id, email, display_name, password_hash)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, display_name, display_name_updated_at, created_at
      `,
        [userId, email, displayName, `clerk$${randomBytes(32).toString('hex')}`],
      );
    } catch (error) {
      if (error?.code !== '23505') throw error;
      [user] = await sql.query(
        `
        SELECT id, email, display_name, display_name_updated_at, created_at
        FROM users
        WHERE lower(email) = lower($1)
        LIMIT 1
      `,
        [email],
      );
    }
  }

  if (!user) return null;
  await sql.query(
    `
    INSERT INTO clerk_user_links (clerk_user_id, user_id)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING
  `,
    [clerkUserId, user.id],
  );

  const [resolved] = await sql.query(
    `
    SELECT u.id, u.email, u.display_name, u.display_name_updated_at, u.created_at,
           l.clerk_user_id
    FROM clerk_user_links l
    JOIN users u ON u.id = l.user_id
    WHERE l.clerk_user_id = $1
    LIMIT 1
  `,
    [clerkUserId],
  );

  if (resolved) {
    return normalizeEmail(resolved.email) === email ? resolved : null;
  }

  // A verified e-mail can temporarily have more than one Clerk identity during
  // a sign-up transfer. In that case the existing logical user is safe to use,
  // but devices remain isolated by the current Clerk identity below.
  return { ...user, clerk_user_id: clerkUserId };
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
  );
}

async function sessionUser(req) {
  // Password authentication is disabled. Never fall back to a stale legacy
  // cookie while a different Clerk identity is active on the same browser.
  return clerkUserForRequest(req);
}

function moderatorEmails() {
  return [
    ...new Set(
      String(process.env.TOPO_MODERATOR_EMAILS || process.env.TOPO_MODERATION_TO || '')
        .split(',')
        .map(normalizeEmail)
        .filter(isValidEmail),
    ),
  ];
}

function isModerator(user) {
  if (!user) return false;
  const email = normalizeEmail(user.email);
  const fingerprint = createHash('sha256').update(`topo-moderator-v1:${email}`).digest('hex');
  return moderatorEmails().includes(email) || BUILT_IN_MODERATOR_EMAIL_HASHES.has(fingerprint);
}

function suggestionText(value, minimum, maximum) {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  const length = [...clean].length;
  return length >= minimum && length <= maximum ? clean : null;
}

function normalizeSuggestion(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function publishedRankingOptions(value) {
  const rawOptions = Array.isArray(value) ? value : String(value || '').split(/\r?\n/);
  const providedOptions = rawOptions.map((option) => String(option || '').trim()).filter(Boolean);
  if (providedOptions.length < 3 || providedOptions.length > PUBLISHED_RANKING_OPTION_LIMIT) {
    return null;
  }

  const uniqueOptions = new Map();
  for (const value of providedOptions) {
    const option = suggestionText(value, 2, SUGGESTION_OPTION_LIMIT);
    const normalized = normalizeSuggestion(option);
    if (!option || !normalized) return null;
    if (!uniqueOptions.has(normalized)) uniqueOptions.set(normalized, option);
  }

  const options = [...uniqueOptions.values()];
  return options.length >= 3 && options.length <= PUBLISHED_RANKING_OPTION_LIMIT ? options : null;
}

function publishedRankingImage(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if ([...raw].length > PUBLISHED_RANKING_IMAGE_LIMIT) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function rankingImageUpload(value) {
  const raw = String(value || '');
  if (!raw || raw.length > RANKING_IMAGE_DATA_LIMIT + 40) return null;
  const match = raw.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return null;

  const mimeType = match[1];
  const image = Buffer.from(match[2], 'base64');
  if (!image.length || image.length > RANKING_IMAGE_MAX_BYTES) return null;
  if (image.toString('base64').replace(/=+$/g, '') !== match[2].replace(/=+$/g, '')) return null;

  const validSignature =
    (mimeType === 'image/jpeg' && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff) ||
    (mimeType === 'image/png' &&
      image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
    (mimeType === 'image/webp' &&
      image.subarray(0, 4).toString('ascii') === 'RIFF' &&
      image.subarray(8, 12).toString('ascii') === 'WEBP');
  if (!validSignature) return null;

  return { mimeType, base64: image.toString('base64'), bytes: image.length };
}

function isValidRankingId(value) {
  return /^[a-z0-9][a-z0-9._-]{0,99}$/.test(String(value || ''));
}

function favoriteShareToken(value) {
  const token = String(value || '').trim();
  return FAVORITE_SHARE_TOKEN_PATTERN.test(token) ? token : '';
}

function publishedRankingSlug(value) {
  return normalizeSuggestion(value).replace(/\s+/g, '-').slice(0, 80).replace(/-+$/g, '');
}

function suggestionFlag(value) {
  const text = String(value || '');
  if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|br)\b/i.test(text)) {
    return 'contém link';
  }
  if (/(.)\1{6,}/i.test(text)) return 'caracteres repetidos';
  const configured = String(process.env.TOPO_SUGGESTION_BLOCKLIST || '')
    .split(',')
    .map(normalizeSuggestion)
    .filter(Boolean);
  const normalized = normalizeSuggestion(text);
  if (configured.some((term) => normalized.includes(term))) {
    return 'termo sinalizado';
  }
  return null;
}

async function anonymousParticipation(deviceId) {
  if (!isValidDevice(deviceId)) {
    return { votesUsed: 0, duelsCompleted: 0, activeDuels: 0 };
  }

  const [row] = await sql.query(
    `
    SELECT
      COALESCE((
        SELECT usage.votes_used
        FROM anonymous_vote_usage usage
        WHERE usage.device_id = $1
      ), 0)::int AS "votesUsed",
      COALESCE((
        SELECT usage.duels_completed
        FROM anonymous_duel_usage usage
        WHERE usage.device_id = $1
      ), 0)::int AS "duelsCompleted",
      (
        SELECT COUNT(*)::int
        FROM ranking_duel_sessions session
        WHERE session.device_id = $1
          AND session.user_id IS NULL
          AND session.completed = false
      ) AS "activeDuels"
  `,
    [deviceId],
  );

  return {
    votesUsed: Number(row?.votesUsed || 0),
    duelsCompleted: Number(row?.duelsCompleted || 0),
    activeDuels: Number(row?.activeDuels || 0),
  };
}

function anonymousRegistrationReason(participation, includeActiveDuels = false) {
  if (participation.votesUsed >= ANONYMOUS_LIMIT) return 'votes';
  if (participation.duelsCompleted >= ANONYMOUS_DUEL_LIMIT) return 'duels';
  if (
    includeActiveDuels &&
    participation.duelsCompleted + participation.activeDuels >= ANONYMOUS_DUEL_LIMIT
  ) {
    return 'duel_slots';
  }
  return '';
}

async function registrationRequired(res, user, deviceId, privateVoting, reason) {
  const currentViewer = await viewerFor(user, deviceId, false, privateVoting);
  return json(res, 403, {
    error: 'registration_required',
    reason,
    limit: reason === 'votes' ? ANONYMOUS_LIMIT : ANONYMOUS_DUEL_LIMIT,
    viewer: currentViewer,
  });
}

function unlockedDoubleVoteCount(totalVotes) {
  const total = Math.max(0, Number(totalVotes || 0));
  return DOUBLE_VOTE_THRESHOLDS.filter((threshold) => total >= threshold).length;
}

async function syncUserVoteHistory(userId) {
  if (!userId) return;

  await sql.query(
    `
    INSERT INTO user_vote_history (user_id, option_id, first_voted_at)
    SELECT $1, v.option_id, MIN(v.updated_at)
    FROM votes v
    WHERE v.user_id = $1
    GROUP BY v.option_id
    ON CONFLICT (user_id, option_id) DO NOTHING
  `,
    [userId],
  );
}

async function doubleVoteState(user) {
  if (!user) {
    return {
      totalVotes: 0,
      unlocked: 0,
      active: 0,
      available: 0,
      nextAt: DOUBLE_VOTE_THRESHOLDS[0],
      remaining: DOUBLE_VOTE_THRESHOLDS[0],
    };
  }

  await syncUserVoteHistory(user.id);

  const [historyRows, activeRows] = await Promise.all([
    sql.query(
      `
      SELECT (
        (SELECT COUNT(*) FROM user_vote_history WHERE user_id = $1)
        +
        (
          SELECT COUNT(*)
          FROM ranking_duel_rounds
          WHERE user_id = $1
            AND skipped = false
        )
      )::int AS total
    `,
      [user.id],
    ),
    sql.query(
      `
      SELECT COUNT(*)::int AS total
      FROM user_double_votes
      WHERE user_id = $1
    `,
      [user.id],
    ),
  ]);

  const totalVotes = Number(historyRows[0]?.total || 0);
  const unlocked = unlockedDoubleVoteCount(totalVotes);
  const active = Number(activeRows[0]?.total || 0);
  const nextAt = DOUBLE_VOTE_THRESHOLDS[unlocked] || null;

  return {
    totalVotes,
    unlocked,
    active,
    available: Math.max(0, unlocked - active),
    nextAt,
    remaining: nextAt ? Math.max(0, nextAt - totalVotes) : 0,
  };
}

async function upsertNotification(userId, notification, { revive = false } = {}) {
  const conflict = revive
    ? `DO UPDATE SET
         kind = EXCLUDED.kind,
         title = EXCLUDED.title,
         body = EXCLUDED.body,
         href = EXCLUDED.href,
         read_at = NULL,
         created_at = now()`
    : 'DO NOTHING';

  await sql.query(
    `
    INSERT INTO user_notifications (
      id,
      user_id,
      kind,
      title,
      body,
      href,
      dedupe_key,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, now())
    ON CONFLICT (user_id, dedupe_key)
    ${conflict}
  `,
    [
      randomUUID(),
      userId,
      notification.kind,
      notification.title,
      notification.body,
      notification.href || '/perfil',
      notification.dedupeKey,
    ],
  );
}

async function syncAchievementNotifications(user) {
  const [history] = await sql.query(
    `
    SELECT COUNT(*)::int AS total
    FROM user_vote_history
    WHERE user_id = $1
  `,
    [user.id],
  );
  const total = Number(history?.total || 0);
  const achievements = [];

  DOUBLE_VOTE_THRESHOLDS.forEach((threshold, index) => {
    if (total < threshold) return;
    const ordinal = ['primeiro', 'segundo', 'terceiro'][index];
    achievements.push({
      kind: 'double_vote',
      title: 'Você ganhou um voto duplo',
      body: `Você chegou a ${threshold} votos e liberou seu ${ordinal} voto duplo.`,
      href: '/perfil',
      dedupeKey: `double-vote:${index + 1}`,
    });
  });

  PROFILE_LEVEL_MILESTONES.forEach((level) => {
    if (total < level.at) return;
    achievements.push({
      kind: 'level',
      title: `Novo nível: ${level.name}`,
      body: `Sua participação levou você ao nível ${level.name}.`,
      href: '/perfil',
      dedupeKey: `level:${level.key}`,
    });
  });

  await Promise.all(achievements.map((notification) => upsertNotification(user.id, notification)));
}

async function syncReturnNotification(user) {
  const [current] = await sql.query(
    `
    SELECT notification_last_seen_at
    FROM users
    WHERE id = $1
    LIMIT 1
  `,
    [user.id],
  );
  const previous = current?.notification_last_seen_at
    ? new Date(current.notification_last_seen_at)
    : null;
  const wasAway =
    previous &&
    Number.isFinite(previous.getTime()) &&
    Date.now() - previous.getTime() >= NOTIFICATION_RETURN_DAYS * 24 * 60 * 60 * 1000;

  await sql.query('UPDATE users SET notification_last_seen_at = now() WHERE id = $1', [user.id]);

  if (wasAway) {
    await upsertNotification(user.id, {
      kind: 'return',
      title: 'Que bom ter você de volta',
      body: 'A gente estava com saudades. Tem ranking novo esperando o seu voto.',
      href: '/',
      dedupeKey: `return:${new Date().toISOString().slice(0, 10)}`,
    });
  }
}

async function rankingOrderSignature(rankingId) {
  const [row] = await sql.query(
    `
    SELECT string_agg(state.id::text, ',' ORDER BY state.score DESC, state.position) AS signature
    FROM (
      SELECT
        option.id,
        option.position,
        option.baseline_score
          + COALESCE((SELECT SUM(vote.direction) FROM votes vote WHERE vote.option_id = option.id), 0)
          + COALESCE((SELECT SUM(double_vote.direction) FROM user_double_votes double_vote WHERE double_vote.option_id = option.id), 0)
          + COALESCE(duel_bonus.score_bonus, 0) AS score
      FROM ranking_options option
      LEFT JOIN ranking_duel_option_bonuses duel_bonus
        ON duel_bonus.ranking_id = option.ranking_id
       AND duel_bonus.option_id = option.id
      WHERE option.ranking_id = $1
    ) state
  `,
    [rankingId],
  );
  return String(row?.signature || '');
}

async function officialOptionState(optionId) {
  const [row] = await sql.query(
    `
    SELECT
      option.id AS "optionId",
      option.baseline_score
        + COALESCE((SELECT SUM(vote.direction) FROM votes vote WHERE vote.option_id = option.id), 0)
        + COALESCE((SELECT SUM(double_vote.direction) FROM user_double_votes double_vote WHERE double_vote.option_id = option.id), 0)
        + COALESCE(duel_bonus.score_bonus, 0) AS score
    FROM ranking_options option
    LEFT JOIN ranking_duel_option_bonuses duel_bonus
      ON duel_bonus.ranking_id = option.ranking_id
     AND duel_bonus.option_id = option.id
    WHERE option.id = $1
    LIMIT 1
  `,
    [optionId],
  );
  return row
    ? {
        optionId: Number(row.optionId),
        score: Number(row.score || 0),
      }
    : null;
}

async function queueRankingChangeNotifications(rankingId, actorUserId) {
  const [rankingRows, recipients] = await Promise.all([
    sql.query('SELECT id, question FROM rankings WHERE id = $1 AND is_active = true LIMIT 1', [
      rankingId,
    ]),
    sql.query(
      `
      SELECT history.user_id AS "userId", MAX(history.first_voted_at) AS "lastVoteAt"
      FROM user_vote_history history
      JOIN ranking_options option ON option.id = history.option_id
      WHERE option.ranking_id = $1
        AND ($2::uuid IS NULL OR history.user_id <> $2::uuid)
      GROUP BY history.user_id
      ORDER BY "lastVoteAt" DESC
      LIMIT $3
    `,
      [rankingId, actorUserId || null, RANKING_NOTIFICATION_FANOUT_LIMIT],
    ),
  ]);
  const ranking = rankingRows[0];
  if (!ranking || !recipients.length) return;
  const question = rankingQuestion(ranking.id, ranking.question);
  const dedupeKey = `ranking:${ranking.id}:${new Date().toISOString().slice(0, 10)}`;

  await Promise.all(
    recipients.map((recipient) =>
      upsertNotification(
        recipient.userId,
        {
          kind: 'ranking_changed',
          title: 'Um ranking que você acompanha mudou',
          body: `A ordem mudou em “${question}”.`,
          href: `/ranking/${encodeURIComponent(ranking.id)}`,
          dedupeKey,
        },
        { revive: true },
      ),
    ),
  );
}

async function notifications(req, res, body = null) {
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: 'authentication_required' });

  if (body) {
    if (body.operation === 'read-all') {
      const rows = await sql.query(
        `
        UPDATE user_notifications
        SET read_at = now()
        WHERE user_id = $1
          AND read_at IS NULL
        RETURNING id
      `,
        [user.id],
      );
      return json(res, 200, { ok: true, updated: rows.length });
    }

    const notificationId = String(body.id || '');
    if (body.operation !== 'read' || !/^[0-9a-f-]{36}$/i.test(notificationId)) {
      return json(res, 400, { error: 'invalid_notification_action' });
    }
    const rows = await sql.query(
      `
      UPDATE user_notifications
      SET read_at = COALESCE(read_at, now())
      WHERE id = $1::uuid
        AND user_id = $2
      RETURNING id
    `,
      [notificationId, user.id],
    );
    if (!rows[0]) return json(res, 404, { error: 'notification_not_found' });
    return json(res, 200, { ok: true, updated: 1 });
  }

  await Promise.all([syncAchievementNotifications(user), syncReturnNotification(user)]);

  const [rows, unreadRows] = await Promise.all([
    sql.query(
      `
      SELECT
        id,
        kind,
        title,
        body,
        href,
        read_at AS "readAt",
        created_at AS "createdAt"
      FROM user_notifications
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2
    `,
      [user.id, NOTIFICATION_LIMIT],
    ),
    sql.query(
      `
      SELECT COUNT(*)::int AS total
      FROM user_notifications
      WHERE user_id = $1
        AND read_at IS NULL
    `,
      [user.id],
    ),
  ]);

  return json(res, 200, {
    unread: Number(unreadRows[0]?.total || 0),
    notifications: rows,
  });
}

async function viewerFor(user, deviceId, votingRequiresAccount = false, privateVoting = false) {
  const [participation, doubleVotes] = await Promise.all([
    anonymousParticipation(deviceId),
    doubleVoteState(user),
  ]);
  const anonymousLimitReason = user ? '' : anonymousRegistrationReason(participation);

  return {
    registered: Boolean(user),
    isModerator: isModerator(user),
    anonymousUsed: participation.votesUsed,
    anonymousLimit: ANONYMOUS_LIMIT,
    anonymousDuelsUsed: participation.duelsCompleted,
    anonymousDuelLimit: ANONYMOUS_DUEL_LIMIT,
    anonymousActiveDuels: participation.activeDuels,
    anonymousLimitReason,
    anonymousAccessExhausted: Boolean(anonymousLimitReason),
    rankingLimit: RANKING_LIMIT,
    votingRequiresAccount: !user && votingRequiresAccount,
    privateVoting: privateVoting === true,
    doubleVotes,
  };
}

async function deviceAccountId(deviceId) {
  if (!isValidDevice(deviceId)) return null;
  const [linked] = await sql.query(
    `
    SELECT user_id
    FROM (
      SELECT user_id FROM user_devices WHERE device_id = $1
      UNION
      SELECT user_id FROM clerk_device_links WHERE device_id = $1
    ) account_device
    LIMIT 1
  `,
    [deviceId],
  );
  return linked?.user_id || null;
}

async function mergeAnonymousVotes(userId, deviceId) {
  if (!userId || !isValidDevice(deviceId)) return;

  await sql.transaction([
    sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [userId]),
    sql.query(
      `
      DELETE FROM votes AS anonymous_vote
      USING votes AS account_vote
      WHERE anonymous_vote.device_id = $2
        AND anonymous_vote.user_id IS NULL
        AND account_vote.user_id = $1
        AND account_vote.option_id = anonymous_vote.option_id
    `,
      [userId, deviceId],
    ),
    sql.query(
      `
      UPDATE votes
      SET user_id = $1
      WHERE device_id = $2
        AND user_id IS NULL
    `,
      [userId, deviceId],
    ),
    sql.query(
      `
      DELETE FROM ranking_top3_selections AS anonymous_selection
      WHERE anonymous_selection.device_id = $2
        AND anonymous_selection.user_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM ranking_top3_selections AS account_selection
          WHERE account_selection.user_id = $1
            AND account_selection.ranking_id = anonymous_selection.ranking_id
        )
    `,
      [userId, deviceId],
    ),
    sql.query(
      `
      UPDATE ranking_top3_selections
      SET user_id = $1, updated_at = now()
      WHERE device_id = $2
        AND user_id IS NULL
    `,
      [userId, deviceId],
    ),
    sql.query(
      `
      DELETE FROM ranking_duel_sessions AS anonymous_session
      WHERE anonymous_session.device_id = $2
        AND anonymous_session.user_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM ranking_duel_sessions AS account_session
          WHERE account_session.user_id = $1
            AND account_session.ranking_id = anonymous_session.ranking_id
        )
    `,
      [userId, deviceId],
    ),
    sql.query(
      `
      UPDATE ranking_duel_sessions
      SET user_id = $1, updated_at = now()
      WHERE device_id = $2
        AND user_id IS NULL
    `,
      [userId, deviceId],
    ),
    sql.query(
      `
      DELETE FROM ranking_duel_rounds AS anonymous_round
      WHERE anonymous_round.device_id = $2
        AND anonymous_round.user_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM ranking_duel_entries AS anonymous_entry
          JOIN ranking_duel_entries AS account_entry
            ON account_entry.user_id = $1
           AND account_entry.ranking_id = anonymous_entry.ranking_id
           AND account_entry.option_id = anonymous_entry.option_id
          WHERE anonymous_entry.round_id = anonymous_round.id
        )
    `,
      [userId, deviceId],
    ),
    sql.query(
      `
      UPDATE ranking_duel_rounds
      SET user_id = $1
      WHERE device_id = $2
        AND user_id IS NULL
    `,
      [userId, deviceId],
    ),
    sql.query(
      `
      UPDATE ranking_duel_entries
      SET user_id = $1
      WHERE device_id = $2
        AND user_id IS NULL
    `,
      [userId, deviceId],
    ),
    sql.query(
      `
      INSERT INTO user_vote_history (user_id, option_id, first_voted_at)
      SELECT $1, vote.option_id, MIN(vote.updated_at)
      FROM votes AS vote
      WHERE vote.user_id = $1
      GROUP BY vote.option_id
      ON CONFLICT (user_id, option_id) DO NOTHING
    `,
      [userId],
    ),
  ]);
}

async function ensureUserDevice(userId, deviceId) {
  const [existing] = await sql.query('SELECT user_id FROM user_devices WHERE device_id = $1', [
    deviceId,
  ]);

  if (existing && existing.user_id !== userId) {
    return false;
  }
  if (existing) {
    await mergeAnonymousVotes(userId, deviceId);
    return true;
  }

  await sql.query(
    `
    INSERT INTO user_devices (device_id, user_id)
    VALUES ($1, $2)
    ON CONFLICT (device_id) DO NOTHING
  `,
    [deviceId, userId],
  );

  const [linked] = await sql.query('SELECT user_id FROM user_devices WHERE device_id = $1', [
    deviceId,
  ]);

  const belongsToUser = linked?.user_id === userId;
  if (belongsToUser) await mergeAnonymousVotes(userId, deviceId);
  return belongsToUser;
}

async function ensureClerkDevice(user, deviceId) {
  const [trusted] = await sql.query(
    `
    SELECT device_id
    FROM clerk_device_links
    WHERE device_id = $1
      AND clerk_user_id = $2
      AND user_id = $3
    LIMIT 1
  `,
    [deviceId, user.clerk_user_id, user.id],
  );
  if (trusted) return true;

  const existingUserId = await deviceAccountId(deviceId);
  if (existingUserId && existingUserId !== user.id) return false;

  await sql.transaction([
    sql.query(
      `
      INSERT INTO user_devices (device_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (device_id) DO NOTHING
    `,
      [deviceId, user.id],
    ),
    sql.query(
      `
      INSERT INTO clerk_device_links (device_id, clerk_user_id, user_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (device_id) DO NOTHING
    `,
      [deviceId, user.clerk_user_id, user.id],
    ),
  ]);

  const [linked] = await sql.query(
    `
    SELECT device_id
    FROM clerk_device_links
    WHERE device_id = $1
      AND clerk_user_id = $2
      AND user_id = $3
    LIMIT 1
  `,
    [deviceId, user.clerk_user_id, user.id],
  );

  if (!linked) return false;
  await mergeAnonymousVotes(user.id, deviceId);
  return true;
}

async function ensureSessionDevice(user, deviceId) {
  if (user.clerk_user_id) return ensureClerkDevice(user, deviceId);
  return ensureUserDevice(user.id, deviceId);
}

async function catalog(req, res) {
  const deviceId = queryValue(req, 'device_id').slice(0, 100);
  const selectedCity = preferredCatalogCity(req),
    requestedRankingId = queryValue(req, 'ranking_id').trim(),
    targetRankingId = isValidRankingId(requestedRankingId) ? requestedRankingId : '';
  const user = await sessionUser(req);
  if (user && isValidDevice(deviceId) && !(await ensureSessionDevice(user, deviceId))) {
    return json(res, 409, { error: 'device_rekey_required' });
  }
  const votingRequiresAccount = !user && Boolean(await deviceAccountId(deviceId));

  const [rows, userCountRows, communityRows, localCityRows] = await Promise.all([
    sql.query(
      `
    WITH eligible_rankings AS MATERIALIZED (
      SELECT ranking.*
      FROM rankings ranking
      WHERE ranking.is_active = true
        AND (ranking.is_vip = false OR $4::boolean = true)
        AND (ranking.is_vip = false OR ranking.vip_owner_user_id IS NULL)
        AND (
          ranking.is_vip = true
          OR NOT (ranking.category = ANY($5::text[]))
          OR ranking.category = $6::text
          OR ranking.category = (
            SELECT target.category
            FROM rankings target
            WHERE target.id = $7::text
              AND target.is_active = true
              AND target.category = ANY($5::text[])
            LIMIT 1
          )
        )
    ),
    vote_totals AS (
      SELECT
        vote.option_id,
        COALESCE(SUM(vote.direction), 0)::int AS score_delta,
        COUNT(*)::int AS live_votes,
        COUNT(*) FILTER (
          WHERE vote.updated_at >= date_trunc('day', now())
        )::int AS today_votes
      FROM votes vote
      JOIN ranking_options option ON option.id = vote.option_id
      JOIN eligible_rankings ranking ON ranking.id = option.ranking_id
      GROUP BY vote.option_id
    ),
    double_vote_totals AS (
      SELECT
        double_vote.option_id,
        COALESCE(SUM(double_vote.direction), 0)::int AS score_delta
      FROM user_double_votes double_vote
      JOIN ranking_options option ON option.id = double_vote.option_id
      JOIN eligible_rankings ranking ON ranking.id = option.ranking_id
      GROUP BY double_vote.option_id
    ),
    my_votes AS (
      SELECT
        option_id,
        direction
      FROM votes
      WHERE (
          $2::uuid IS NOT NULL
          AND user_id = $2::uuid
        )
        OR (
          $2::uuid IS NULL
          AND user_id IS NULL
          AND device_id = $1
          AND $3::boolean = false
        )
    ),
    my_double_votes AS (
      SELECT option_id, direction
      FROM user_double_votes
      WHERE user_id = $2::uuid
    ),
    my_duel_sessions AS (
      SELECT
        session.ranking_id,
        session.completed
      FROM ranking_duel_sessions session
      JOIN eligible_rankings ranking ON ranking.id = session.ranking_id
      WHERE (
          $2::uuid IS NOT NULL
          AND session.user_id = $2::uuid
        )
        OR (
          $2::uuid IS NULL
          AND $3::boolean = false
          AND session.user_id IS NULL
          AND session.device_id = $1
        )
    ),
    option_rows AS MATERIALIZED (
    SELECT
      r.id AS ranking_id,
      r.category,
      r.question,
      r.image_url,
      r.baseline_votes,
      r.created_at,
      r.is_vip,
      (r.vip_password_hash IS NOT NULL) AS vip_has_password,
      r.vip_password_version,
      EXISTS (
        SELECT 1
        FROM user_ranking_favorites favorite
        WHERE favorite.user_id = $2::uuid
          AND favorite.ranking_id = r.id
      ) AS is_favorite,
      o.id AS option_id,
      o.label,
      o.position,
      o.baseline_score
        + COALESCE(vt.score_delta, 0)::int
        + COALESCE(dvt.score_delta, 0)::int
        + COALESCE(duel_bonus.score_bonus, 0)::int AS score,
      COALESCE(vt.live_votes, 0)::int AS live_votes,
      COALESCE(vt.today_votes, 0)::int AS today_votes,
      COALESCE(mv.direction, 0)::int AS my_direction,
      CASE
        WHEN mdv.direction = mv.direction THEN 2
        ELSE 1
      END::int AS my_weight,
      (mds.ranking_id IS NOT NULL) AS duel_started,
      COALESCE(mds.completed, false) AS duel_completed
    FROM eligible_rankings r
    JOIN ranking_options o ON o.ranking_id = r.id
    LEFT JOIN vote_totals vt ON vt.option_id = o.id
    LEFT JOIN double_vote_totals dvt ON dvt.option_id = o.id
    LEFT JOIN ranking_duel_option_bonuses duel_bonus
      ON duel_bonus.ranking_id = r.id
     AND duel_bonus.option_id = o.id
    LEFT JOIN my_votes mv ON mv.option_id = o.id
    LEFT JOIN my_double_votes mdv ON mdv.option_id = o.id
    LEFT JOIN my_duel_sessions mds ON mds.ranking_id = r.id
    ),
    ranked_rows AS (
      SELECT
        option_rows.*,
        ROW_NUMBER() OVER (
          PARTITION BY ranking_id
          ORDER BY score DESC, position
        ) AS catalog_position,
        STRING_AGG(label, ' ') OVER (PARTITION BY ranking_id) AS option_search_text,
        COUNT(*) FILTER (WHERE my_direction <> 0) OVER (PARTITION BY ranking_id)
          AS my_vote_count,
        SUM(live_votes) OVER (PARTITION BY ranking_id) AS ranking_live_votes,
        SUM(today_votes) OVER (PARTITION BY ranking_id) AS ranking_today_votes
      FROM option_rows
    )
    SELECT *
    FROM ranked_rows
    WHERE ranking_id = $7::text
       OR catalog_position <= 3
    ORDER BY created_at, ranking_id, catalog_position
  `,
      [
        deviceId,
        user?.id || null,
        votingRequiresAccount,
        isModerator(user),
        LOCAL_CITY_LABELS,
        selectedCity,
        targetRankingId,
      ],
    ),
    sql.query('SELECT COUNT(*)::int AS total FROM users'),
    sql.query(`
      SELECT
        COUNT(*)::int AS rankings,
        (
          COALESCE(SUM(ranking.baseline_votes), 0)
          + (
            SELECT COUNT(*)
            FROM votes vote
            JOIN ranking_options option ON option.id = vote.option_id
            JOIN rankings voted_ranking ON voted_ranking.id = option.ranking_id
            WHERE voted_ranking.is_active = true
              AND voted_ranking.is_vip = false
          )
        )::bigint AS votes
      FROM rankings ranking
      WHERE ranking.is_active = true
        AND ranking.is_vip = false
    `),
    sql.query(
      `
        SELECT category AS city, COUNT(*)::int AS total
        FROM rankings
        WHERE is_active = true
          AND is_vip = false
          AND category = ANY($1::text[])
        GROUP BY category
      `,
      [LOCAL_CITY_LABELS],
    ),
  ]);

  const byId = new Map();

  for (const row of rows) {
    if (!byId.has(row.ranking_id)) {
      byId.set(row.ranking_id, {
        id: row.ranking_id,
        cat: row.category,
        q: rankingQuestion(row.ranking_id, row.question),
        img: resolveRankingCover(row.ranking_id, row.image_url),
        votes: Number(row.baseline_votes || 0) + Number(row.ranking_live_votes || 0),
        todayVotes: Number(row.ranking_today_votes || 0),
        createdAt: row.created_at,
        searchText: row.option_search_text || '',
        myVoteCount: Number(row.my_vote_count || 0),
        vip: row.is_vip === true,
        favorite: row.is_favorite === true,
        duelStarted: row.duel_started === true,
        duelCompleted: row.duel_completed === true,
        vipHasPassword: row.vip_has_password === true,
        vipUnlocked: row.is_vip === true ? true : undefined,
        opts: [],
      });
    }

    const ranking = byId.get(row.ranking_id);
    ranking.opts.push({
      id: Number(row.option_id),
      label: row.label,
      score: Number(row.score || 0),
      originalPosition: Number(row.position),
      mine: Number(row.my_direction || 0),
      mineWeight: Number(row.my_weight || 1),
    });
  }

  const rankings = [...byId.values()].map((ranking) => ({
    ...ranking,
    opts: ranking.opts.sort((a, b) => b.score - a.score || a.originalPosition - b.originalPosition),
  }));

  return json(res, 200, {
    rankings,
    community: {
      rankings: Number(communityRows[0]?.rankings || 0),
      votes: Number(communityRows[0]?.votes || 0),
      users: Number(userCountRows[0]?.total || 0),
    },
    localCities: localCityRows.map((row) => ({ city: row.city, total: Number(row.total || 0) })),
    location: { city: geolocationCity(req), selectedCity },
    viewer: await viewerFor(user, deviceId, votingRequiresAccount),
  });
}

function vipRankingMeta(row, unlocked = false, user = null) {
  const ownerUserId = row.vipOwnerUserId ?? row.vip_owner_user_id ?? null;
  const imageUrl = row.imageUrl || row.image_url || null;
  return {
    id: row.id,
    q: rankingQuestion(row.id, row.question),
    img: resolveRankingCover(row.id, imageUrl),
    createdAt: row.createdAt || row.created_at || null,
    description: row.vipDescription ?? row.vip_description ?? '',
    votingOpen: (row.vipVotingOpen ?? row.vip_voting_open) !== false,
    optionCount: Number(row.optionCount ?? row.option_count ?? 0),
    voteCount: Number(row.voteCount ?? row.vote_count ?? 0),
    locked: !unlocked,
    vip: true,
    owned: Boolean(user?.id && ownerUserId && String(user.id) === String(ownerUserId)),
    userCreated: Boolean(ownerUserId),
  };
}

async function vipCatalog(req, res) {
  const user = await sessionUser(req);
  if (!user) {
    return json(res, 200, {
      rankings: [],
      canCreate: false,
      userRankingLimit: USER_VIP_RANKING_LIMIT,
    });
  }
  const rows = await sql.query(
    `
      SELECT
        id,
        question,
        image_url AS "imageUrl",
        created_at AS "createdAt",
        is_vip AS "isVip",
        vip_password_version AS "vipPasswordVersion",
        vip_owner_user_id AS "vipOwnerUserId",
        vip_description AS "vipDescription",
        vip_voting_open AS "vipVotingOpen",
        (
          SELECT COUNT(*)::int
          FROM ranking_options option
          WHERE option.ranking_id = rankings.id
        ) AS "optionCount",
        (
          SELECT COUNT(*)::int
          FROM votes vote
          JOIN ranking_options option ON option.id = vote.option_id
          WHERE option.ranking_id = rankings.id
        ) AS "voteCount"
      FROM rankings
      WHERE is_active = true
        AND is_vip = true
        AND vip_password_hash IS NOT NULL
        AND vip_owner_user_id = $1::uuid
      ORDER BY created_at DESC, id
    `,
    [user.id],
  );

  return json(res, 200, {
    rankings: rows.map((ranking) =>
      vipRankingMeta(ranking, hasVipAccess(req, user, ranking), user),
    ),
    canCreate: Boolean(user),
    userRankingLimit: USER_VIP_RANKING_LIMIT,
  });
}

async function vipRanking(req, res) {
  const rankingId = queryValue(req, 'ranking_id').trim();
  const deviceId = queryValue(req, 'device_id').slice(0, 100);
  if (!isValidRankingId(rankingId)) return json(res, 400, { error: 'invalid_ranking' });

  const user = await sessionUser(req);
  const [ranking] = await sql.query(
    `
      SELECT
        id,
        question,
        image_url AS "imageUrl",
        created_at AS "createdAt",
        is_vip AS "isVip",
        vip_password_version AS "vipPasswordVersion",
        vip_owner_user_id AS "vipOwnerUserId",
        vip_description AS "vipDescription",
        vip_voting_open AS "vipVotingOpen"
      FROM rankings
      WHERE id = $1
        AND is_active = true
        AND is_vip = true
        AND vip_password_hash IS NOT NULL
      LIMIT 1
    `,
    [rankingId],
  );
  if (!ranking) return json(res, 404, { error: 'ranking_not_found' });
  if (!hasVipAccess(req, user, ranking)) {
    return json(res, 423, {
      error: 'vip_password_required',
      ranking: vipRankingMeta(ranking, false, user),
    });
  }

  if (user && isValidDevice(deviceId) && !(await ensureSessionDevice(user, deviceId))) {
    return json(res, 409, { error: 'device_rekey_required' });
  }
  const votingRequiresAccount = !user && Boolean(await deviceAccountId(deviceId));
  const rows = await sql.query(
    `
      WITH vote_totals AS (
        SELECT
          option_id,
          COALESCE(SUM(direction), 0)::int AS score_delta,
          COUNT(*)::int AS live_votes,
          COUNT(*) FILTER (
            WHERE updated_at >= date_trunc('day', now())
          )::int AS today_votes
        FROM votes
        GROUP BY option_id
      ),
      double_vote_totals AS (
        SELECT
          option_id,
          COALESCE(SUM(direction), 0)::int AS score_delta
        FROM user_double_votes
        GROUP BY option_id
      ),
      my_votes AS (
        SELECT option_id, direction
        FROM votes
        WHERE (
            $2::uuid IS NOT NULL
            AND user_id = $2::uuid
          )
          OR (
            $2::uuid IS NULL
            AND user_id IS NULL
            AND device_id = $1
            AND $3::boolean = false
          )
      ),
      my_double_votes AS (
        SELECT option_id, direction
        FROM user_double_votes
        WHERE user_id = $2::uuid
      )
      SELECT
        r.id AS ranking_id,
        r.category,
        r.question,
        r.image_url,
        r.baseline_votes,
        r.created_at,
        o.id AS option_id,
        o.label,
        o.position,
        o.vip_added_later AS "vipAddedLater",
        o.baseline_score
          + COALESCE(vt.score_delta, 0)::int
          + COALESCE(dvt.score_delta, 0)::int
          + COALESCE(duel_bonus.score_bonus, 0)::int AS score,
        COALESCE(vt.live_votes, 0)::int AS live_votes,
        COALESCE(vt.today_votes, 0)::int AS today_votes,
        COALESCE(mv.direction, 0)::int AS my_direction,
        CASE WHEN mdv.direction = mv.direction THEN 2 ELSE 1 END::int AS my_weight
      FROM rankings r
      JOIN ranking_options o ON o.ranking_id = r.id
      LEFT JOIN vote_totals vt ON vt.option_id = o.id
      LEFT JOIN double_vote_totals dvt ON dvt.option_id = o.id
      LEFT JOIN ranking_duel_option_bonuses duel_bonus
        ON duel_bonus.ranking_id = r.id
       AND duel_bonus.option_id = o.id
      LEFT JOIN my_votes mv ON mv.option_id = o.id
      LEFT JOIN my_double_votes mdv ON mdv.option_id = o.id
      WHERE r.id = $4
        AND r.is_active = true
        AND r.is_vip = true
      ORDER BY o.position
    `,
    [deviceId, user?.id || null, votingRequiresAccount, rankingId],
  );
  if (!rows.length) return json(res, 404, { error: 'ranking_not_found' });

  const first = rows[0];
  const payload = {
    id: first.ranking_id,
    cat: first.category,
    q: rankingQuestion(first.ranking_id, first.question),
    img: resolveRankingCover(first.ranking_id, first.image_url),
    votes: Number(first.baseline_votes || 0),
    todayVotes: 0,
    createdAt: first.created_at,
    vip: true,
    vipUnlocked: true,
    vipHasPassword: true,
    vipDescription: ranking.vipDescription || '',
    vipVotingOpen: ranking.vipVotingOpen !== false,
    vipOwned: Boolean(
      user?.id && ranking.vipOwnerUserId && String(user.id) === String(ranking.vipOwnerUserId),
    ),
    vipUserCreated: Boolean(ranking.vipOwnerUserId),
    opts: [],
  };
  for (const row of rows) {
    payload.votes += Number(row.live_votes || 0);
    payload.todayVotes += Number(row.today_votes || 0);
    payload.opts.push({
      id: Number(row.option_id),
      label: row.label,
      score: Number(row.score || 0),
      originalPosition: Number(row.position),
      mine: Number(row.my_direction || 0),
      mineWeight: Number(row.my_weight || 1),
      isNew: row.vipAddedLater === true,
    });
  }
  payload.opts.sort((a, b) => b.score - a.score || a.originalPosition - b.originalPosition);

  return json(res, 200, {
    ranking: payload,
    viewer: await viewerFor(user, deviceId, false, true),
  });
}

function userVipRankingId(seed) {
  const base = publishedRankingSlug(seed)
    .slice(0, 70)
    .replace(/[._-]+$/g, '');
  return `${base || 'ranking'}-vip-${randomBytes(8).toString('hex')}`;
}

async function createUserVipRanking(req, res, body) {
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: 'authentication_required' });

  const password = vipPassword(body.password);
  if (!password) return json(res, 400, { error: 'invalid_vip_password' });
  if (!vipSigningKey()) return json(res, 503, { error: 'vip_not_configured' });

  if (body.sourceRankingId) {
    return createUserVipRankingCopy(res, body, user, password);
  }

  const title = suggestionText(body.title, 8, SUGGESTION_TITLE_LIMIT);
  const description = suggestionText(body.description ?? '', 0, VIP_DESCRIPTION_LIMIT);
  const providedOptionCount = Array.isArray(body.options)
    ? body.options.map((option) => String(option || '').trim()).filter(Boolean).length
    : 0;
  const options = publishedRankingOptions(body.options);
  if (!title) return json(res, 400, { error: 'invalid_vip_title' });
  if (description === null) return json(res, 400, { error: 'invalid_vip_description' });
  if (!options) return json(res, 400, { error: 'invalid_vip_options' });
  if (providedOptionCount !== options.length) {
    return json(res, 409, { error: 'duplicate_vip_option' });
  }
  const hasImageData = Object.hasOwn(body, 'imageData');
  const uploadedImage = hasImageData ? rankingImageUpload(body.imageData) : null;
  if (hasImageData && !uploadedImage) {
    return json(res, 400, { error: 'invalid_ranking_image' });
  }

  const passwordHash = hashVipPassword(password);
  let created = null;

  for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
    const rankingId = userVipRankingId(title);
    const imageUrl = uploadedImage
      ? `/api?action=ranking-image&ranking_id=${encodeURIComponent(rankingId)}&v=${randomUUID()}`
      : null;
    try {
      const results = await sql.transaction(
        [
          sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [user.id]),
          sql.query(
            `
              INSERT INTO rankings (
                id,
                category,
                question,
                image_url,
                baseline_votes,
                is_active,
                created_at,
                is_vip,
                vip_password_hash,
                vip_password_version,
                vip_updated_at,
                vip_owner_user_id,
                vip_source_ranking_id,
                vip_description,
                vip_voting_open
              )
              SELECT $1, 'Privado', $2, $7, 0, true, now(), true, $3, 1, now(), $4, NULL, $5, true
              WHERE (
                SELECT COUNT(*)
                FROM rankings
                WHERE vip_owner_user_id = $4
                  AND is_active = true
                  AND is_vip = true
              ) < $6
              RETURNING
                id,
                question,
                image_url AS "imageUrl",
                created_at AS "createdAt",
                is_vip AS "isVip",
                vip_password_version AS "vipPasswordVersion",
                vip_owner_user_id AS "vipOwnerUserId",
                vip_description AS "vipDescription",
                vip_voting_open AS "vipVotingOpen"
            `,
            [
              rankingId,
              title,
              passwordHash,
              user.id,
              description,
              USER_VIP_RANKING_LIMIT,
              imageUrl,
            ],
          ),
          sql.query(
            `
              INSERT INTO ranking_options (
                ranking_id,
                label,
                position,
                baseline_score,
                vip_added_later
              )
              SELECT $1, option.label, option.position::int, 0, false
              FROM jsonb_array_elements_text($2::jsonb) WITH ORDINALITY AS option(label, position)
              WHERE EXISTS (
                SELECT 1
                FROM rankings destination
                WHERE destination.id = $1
                  AND destination.vip_owner_user_id = $3
                  AND destination.vip_password_hash = $4
              )
              ORDER BY option.position
              RETURNING id
            `,
            [rankingId, JSON.stringify(options), user.id, passwordHash],
          ),
          ...(uploadedImage
            ? [
                sql.query(
                  `
                    INSERT INTO ranking_images (ranking_id, mime_type, image_data, updated_at)
                    SELECT $1, $2, $3, now()
                    WHERE EXISTS (
                      SELECT 1
                      FROM rankings ranking
                      WHERE ranking.id = $1
                        AND ranking.vip_owner_user_id = $4
                        AND ranking.is_vip = true
                    )
                    RETURNING ranking_id
                  `,
                  [rankingId, uploadedImage.mimeType, uploadedImage.base64, user.id],
                ),
              ]
            : []),
        ],
        { isolationLevel: 'Serializable' },
      );

      created = results?.[1]?.[0] || null;
      if (!created) return json(res, 409, { error: 'user_vip_ranking_limit' });
      created.optionCount = results?.[2]?.length || options.length;
      created.voteCount = 0;
    } catch (error) {
      if (error?.code === '23505' && attempt < 2) continue;
      throw error;
    }
  }

  if (!created) throw new Error('user_vip_ranking_id_failed');
  return json(res, 201, {
    ok: true,
    ranking: vipRankingMeta(created, true, user),
    path: `/ranking/${created.id}`,
  });
}

async function createUserVipRankingCopy(res, body, user, password) {
  const sourceRankingId = String(body.sourceRankingId || '').trim();
  if (!isValidRankingId(sourceRankingId)) {
    return json(res, 400, { error: 'invalid_source_ranking' });
  }

  const [source] = await sql.query(
    `
      SELECT
        r.id,
        r.category,
        r.question,
        r.image_url AS "imageUrl",
        COUNT(o.id)::int AS "optionCount"
      FROM rankings r
      JOIN ranking_options o ON o.ranking_id = r.id
      WHERE r.id = $1
        AND r.is_active = true
        AND r.is_vip = false
      GROUP BY r.id, r.category, r.question, r.image_url
      HAVING COUNT(o.id) BETWEEN 3 AND $2
      LIMIT 1
    `,
    [sourceRankingId, PUBLISHED_RANKING_OPTION_LIMIT],
  );
  if (!source) return json(res, 404, { error: 'source_ranking_not_found' });

  const passwordHash = hashVipPassword(password);
  const question = rankingQuestion(source.id, source.question);
  let created = null;

  for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
    const rankingId = userVipRankingId(sourceRankingId);
    try {
      const results = await sql.transaction(
        [
          sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [user.id]),
          sql.query(
            `
              INSERT INTO rankings (
                id,
                category,
                question,
                image_url,
                baseline_votes,
                is_active,
                created_at,
                is_vip,
                vip_password_hash,
                vip_password_version,
                vip_updated_at,
                vip_owner_user_id,
                vip_source_ranking_id
              )
              SELECT $1, $2, $3, $4, 0, true, now(), true, $5, 1, now(), $6, $7
              WHERE (
                SELECT COUNT(*)
                FROM rankings
                WHERE vip_owner_user_id = $6
                  AND is_active = true
                  AND is_vip = true
              ) < $8
                AND EXISTS (
                  SELECT 1
                  FROM rankings source_ranking
                  WHERE source_ranking.id = $7
                    AND source_ranking.is_active = true
                    AND source_ranking.is_vip = false
                    AND (
                      SELECT COUNT(*)
                      FROM ranking_options source_option
                      WHERE source_option.ranking_id = source_ranking.id
                    ) BETWEEN 3 AND $9
                )
              RETURNING
                id,
                question,
                image_url AS "imageUrl",
                created_at AS "createdAt",
                is_vip AS "isVip",
                vip_password_version AS "vipPasswordVersion",
                vip_owner_user_id AS "vipOwnerUserId"
            `,
            [
              rankingId,
              source.category,
              question,
              resolveRankingCover(source.id, source.imageUrl),
              passwordHash,
              user.id,
              sourceRankingId,
              USER_VIP_RANKING_LIMIT,
              PUBLISHED_RANKING_OPTION_LIMIT,
            ],
          ),
          sql.query(
            `
              INSERT INTO ranking_options (ranking_id, label, position, baseline_score)
              SELECT $1, source_option.label, source_option.position, 0
              FROM ranking_options source_option
              WHERE source_option.ranking_id = $2
                AND EXISTS (
                  SELECT 1
                  FROM rankings destination
                  WHERE destination.id = $1
                    AND destination.vip_owner_user_id = $3
                    AND destination.vip_source_ranking_id = $2
                    AND destination.vip_password_hash = $4
                )
              ORDER BY source_option.position
              RETURNING id
            `,
            [rankingId, sourceRankingId, user.id, passwordHash],
          ),
        ],
        { isolationLevel: 'Serializable' },
      );

      created = results?.[1]?.[0] || null;
      if (!created) return json(res, 409, { error: 'user_vip_ranking_limit' });
    } catch (error) {
      if (error?.code === '23505' && attempt < 2) continue;
      if (error?.code === '23503') {
        return json(res, 404, { error: 'source_ranking_not_found' });
      }
      throw error;
    }
  }

  if (!created) throw new Error('user_vip_ranking_id_failed');
  return json(res, 201, {
    ok: true,
    ranking: vipRankingMeta(created, true, user),
    path: `/ranking/${created.id}`,
  });
}

async function updateUserVipRanking(req, res, body) {
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: 'authentication_required' });

  const rankingId = String(body.rankingId || '').trim();
  const title = suggestionText(body.title, 8, SUGGESTION_TITLE_LIMIT);
  const description = suggestionText(body.description ?? '', 0, VIP_DESCRIPTION_LIMIT);
  const votingOpen = body.votingOpen;
  const submittedOptions = Array.isArray(body.options) ? body.options : null;
  const submittedNewOptions = Array.isArray(body.newOptions) ? body.newOptions : [];
  const submittedRemovedOptionIds = Array.isArray(body.removedOptionIds)
    ? body.removedOptionIds
    : [];
  if (!isValidRankingId(rankingId) || !title || description === null || !submittedOptions) {
    return json(res, 400, { error: 'invalid_vip_content' });
  }
  if (typeof votingOpen !== 'boolean') {
    return json(res, 400, { error: 'invalid_vip_voting_state' });
  }
  if (Object.hasOwn(body, 'removeImage') && typeof body.removeImage !== 'boolean') {
    return json(res, 400, { error: 'invalid_ranking_image' });
  }
  const removeImage = body.removeImage === true;
  const hasImageData = Object.hasOwn(body, 'imageData');
  const uploadedImage = hasImageData ? rankingImageUpload(body.imageData) : null;
  if ((hasImageData && !uploadedImage) || (removeImage && uploadedImage)) {
    return json(res, 400, { error: 'invalid_ranking_image' });
  }
  const uploadedImageUrl = uploadedImage
    ? `/api?action=ranking-image&ranking_id=${encodeURIComponent(rankingId)}&v=${randomUUID()}`
    : null;

  let passwordHash = null;
  if (String(body.password || '').trim()) {
    const password = vipPassword(body.password);
    if (!password) return json(res, 400, { error: 'invalid_vip_password' });
    passwordHash = hashVipPassword(password);
  }

  const retained = [];
  const retainedIds = new Set();
  const removedIds = [];
  const removedIdSet = new Set();
  const normalizedLabels = new Set();
  for (const submitted of submittedOptions) {
    const id = Number(submitted?.id);
    const label = suggestionText(submitted?.label, 2, SUGGESTION_OPTION_LIMIT);
    const normalized = normalizeSuggestion(label);
    if (!Number.isSafeInteger(id) || id <= 0 || retainedIds.has(id) || !label || !normalized) {
      return json(res, 400, { error: 'invalid_vip_options' });
    }
    if (normalizedLabels.has(normalized)) {
      return json(res, 409, { error: 'duplicate_vip_option' });
    }
    retainedIds.add(id);
    normalizedLabels.add(normalized);
    retained.push({ id, label, normalized });
  }

  for (const value of submittedRemovedOptionIds) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0 || retainedIds.has(id) || removedIdSet.has(id)) {
      return json(res, 400, { error: 'invalid_vip_options' });
    }
    removedIdSet.add(id);
    removedIds.push(id);
  }

  const newOptions = [];
  for (const value of submittedNewOptions) {
    const label = suggestionText(value, 2, SUGGESTION_OPTION_LIMIT);
    const normalized = normalizeSuggestion(label);
    if (!label || !normalized) return json(res, 400, { error: 'invalid_vip_options' });
    if (normalizedLabels.has(normalized)) {
      return json(res, 409, { error: 'duplicate_vip_option' });
    }
    normalizedLabels.add(normalized);
    newOptions.push({ label, normalized });
  }

  if (
    retained.length + newOptions.length < 3 ||
    retained.length + newOptions.length > PUBLISHED_RANKING_OPTION_LIMIT
  ) {
    return json(res, 400, { error: 'invalid_vip_options' });
  }

  const rows = await sql.query(
    `
      WITH ranking_lock AS MATERIALIZED (
        SELECT pg_advisory_xact_lock(hashtextextended($1::text, 17)) AS acquired
      ),
      target AS MATERIALIZED (
        SELECT
          ranking.id,
          EXISTS (
            SELECT 1
            FROM votes vote
            JOIN ranking_options option ON option.id = vote.option_id
            WHERE option.ranking_id = ranking.id
          ) AS has_votes
        FROM rankings ranking
        CROSS JOIN ranking_lock
        WHERE ranking.id = $1
          AND ranking.vip_owner_user_id = $2
          AND ranking.is_vip = true
          AND ranking.is_active = true
        FOR UPDATE OF ranking
      ),
      submitted AS MATERIALIZED (
        SELECT item.id, item.label, item.normalized
        FROM jsonb_to_recordset($7::jsonb) AS item(id bigint, label text, normalized text)
      ),
      removed AS MATERIALIZED (
        SELECT value::bigint AS id
        FROM jsonb_array_elements_text($9::jsonb)
      ),
      added AS MATERIALIZED (
        SELECT
          item.value->>'label' AS label,
          item.value->>'normalized' AS normalized,
          item.position::int
        FROM jsonb_array_elements($8::jsonb) WITH ORDINALITY AS item(value, position)
      ),
      existing AS MATERIALIZED (
        SELECT option.id, option.label, option.position
        FROM ranking_options option
        JOIN target ON target.id = option.ranking_id
      ),
      checks AS MATERIALIZED (
        SELECT
          target.has_votes,
          (SELECT COUNT(*)::int FROM existing) AS existing_count,
          (SELECT COUNT(*)::int FROM submitted) AS submitted_count,
          (SELECT COUNT(*)::int FROM removed) AS removed_count,
          (SELECT COUNT(*)::int FROM added) AS added_count,
          (
            SELECT COUNT(*)::int
            FROM (
              SELECT id FROM submitted
              UNION ALL
              SELECT id FROM removed
            ) expected
            WHERE NOT EXISTS (SELECT 1 FROM existing WHERE existing.id = expected.id)
          ) AS unknown_count,
          (
            SELECT COUNT(*)::int
            FROM existing
            WHERE NOT EXISTS (SELECT 1 FROM submitted WHERE submitted.id = existing.id)
              AND NOT EXISTS (SELECT 1 FROM removed WHERE removed.id = existing.id)
          ) AS missing_count,
          (
            SELECT COUNT(*)::int
            FROM existing
            JOIN submitted ON submitted.id = existing.id
            WHERE submitted.label <> existing.label
          ) AS renamed_count,
          (
            SELECT COUNT(*)::int - COUNT(DISTINCT labels.normalized)::int
            FROM (
              SELECT normalized FROM submitted
              UNION ALL
              SELECT normalized FROM added
            ) labels
          ) AS duplicate_count
        FROM target
      ),
      allowed AS MATERIALIZED (
        SELECT target.id, checks.has_votes
        FROM target
        JOIN checks ON true
        WHERE checks.unknown_count = 0
          AND checks.missing_count = 0
          AND checks.duplicate_count = 0
          AND checks.submitted_count + checks.added_count BETWEEN 3 AND $10
      ),
      updated AS (
        UPDATE rankings ranking
        SET
          question = $3,
          vip_description = $4,
          vip_voting_open = $5,
          image_url = CASE
            WHEN $14::boolean = true THEN NULL
            WHEN $12::text IS NOT NULL THEN $11
            ELSE ranking.image_url
          END,
          vip_password_hash = COALESCE($6, ranking.vip_password_hash),
          vip_password_version = ranking.vip_password_version + CASE WHEN $6::text IS NULL THEN 0 ELSE 1 END,
          vip_updated_at = CASE WHEN $6::text IS NULL THEN ranking.vip_updated_at ELSE now() END,
          content_updated_at = now()
        FROM allowed
        WHERE ranking.id = allowed.id
        RETURNING ranking.id
      ),
      removed_image AS (
        DELETE FROM ranking_images image
        USING updated
        WHERE image.ranking_id = updated.id
          AND $14::boolean = true
        RETURNING image.ranking_id
      ),
      saved_image AS (
        INSERT INTO ranking_images (ranking_id, mime_type, image_data, updated_at)
        SELECT updated.id, $12, $13, now()
        FROM updated
        WHERE $12::text IS NOT NULL
        ON CONFLICT (ranking_id) DO UPDATE SET
          mime_type = EXCLUDED.mime_type,
          image_data = EXCLUDED.image_data,
          updated_at = EXCLUDED.updated_at
        RETURNING ranking_id
      ),
      deleted AS (
        DELETE FROM ranking_options option
        USING removed, updated
        WHERE option.ranking_id = updated.id
          AND option.id = removed.id
        RETURNING option.id
      ),
      renamed AS (
        UPDATE ranking_options option
        SET label = submitted.label
        FROM submitted, updated, allowed
        WHERE option.id = submitted.id
          AND option.ranking_id = updated.id
        RETURNING option.id
      ),
      next_position AS MATERIALIZED (
        SELECT COALESCE(MAX(existing.position), 0)::int AS value
        FROM existing
      ),
      inserted AS (
        INSERT INTO ranking_options (
          ranking_id,
          label,
          position,
          baseline_score,
          vip_added_later
        )
        SELECT
          updated.id,
          added.label,
          next_position.value + added.position,
          0,
          allowed.has_votes
        FROM added
        CROSS JOIN updated
        CROSS JOIN allowed
        CROSS JOIN next_position
        RETURNING id
      )
      SELECT
        checks.has_votes AS "hasVotes",
        checks.unknown_count AS "unknownCount",
        checks.missing_count AS "missingCount",
        checks.renamed_count AS "renamedCount",
        checks.duplicate_count AS "duplicateCount",
        checks.submitted_count + checks.added_count AS "optionCount",
        EXISTS (SELECT 1 FROM updated) AS updated,
        (SELECT COUNT(*)::int FROM deleted) AS "deletedCount",
        (SELECT COUNT(*)::int FROM inserted) AS "insertedCount"
      FROM checks
    `,
    [
      rankingId,
      user.id,
      title,
      description,
      votingOpen,
      passwordHash,
      JSON.stringify(retained),
      JSON.stringify(newOptions),
      JSON.stringify(removedIds),
      PUBLISHED_RANKING_OPTION_LIMIT,
      uploadedImageUrl,
      uploadedImage?.mimeType || null,
      uploadedImage?.base64 || null,
      removeImage,
    ],
  );

  const result = rows[0];
  if (!result) return json(res, 404, { error: 'ranking_not_found' });
  if (Number(result.unknownCount || 0) > 0) {
    return json(res, 409, { error: 'vip_options_changed' });
  }
  if (Number(result.missingCount || 0) > 0) {
    return json(res, 409, { error: 'vip_options_changed' });
  }
  if (Number(result.duplicateCount || 0) > 0) {
    return json(res, 409, { error: 'duplicate_vip_option' });
  }
  if (result.updated !== true) return json(res, 409, { error: 'invalid_vip_options' });

  return json(res, 200, {
    ok: true,
    rankingId,
    hasVotes: result.hasVotes === true,
    optionCount: Number(result.optionCount || 0),
    deletedCount: Number(result.deletedCount || 0),
    renamedCount: Number(result.renamedCount || 0),
    insertedCount: Number(result.insertedCount || 0),
  });
}

async function deleteUserVipRanking(req, res) {
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: 'authentication_required' });

  const rankingId = queryValue(req, 'ranking_id').trim();
  if (!isValidRankingId(rankingId)) return json(res, 400, { error: 'invalid_ranking' });

  const deleted = await sql.query(
    `
      DELETE FROM rankings
      WHERE id = $1
        AND vip_owner_user_id = $2
        AND is_vip = true
      RETURNING id
    `,
    [rankingId, user.id],
  );
  if (!deleted[0]) return json(res, 404, { error: 'ranking_not_found' });
  return json(res, 200, { ok: true, rankingId: deleted[0].id });
}

async function unlockVipRanking(req, res, body) {
  const rankingId = String(body.rankingId || '').trim();
  const password = vipPassword(body.password);
  if (!isValidRankingId(rankingId) || !password) {
    return json(res, 400, { error: 'invalid_vip_password' });
  }
  if (!vipSigningKey()) return json(res, 503, { error: 'vip_not_configured' });

  const user = await sessionUser(req);
  const [ranking] = await sql.query(
    `
      SELECT
        id,
        is_vip AS "isVip",
        vip_password_hash AS "vipPasswordHash",
        vip_password_version AS "vipPasswordVersion",
        vip_owner_user_id AS "vipOwnerUserId"
      FROM rankings
      WHERE id = $1
        AND is_active = true
        AND is_vip = true
      LIMIT 1
    `,
    [rankingId],
  );
  if (!ranking) return json(res, 404, { error: 'ranking_not_found' });
  if (!ranking.vipPasswordHash) return json(res, 503, { error: 'vip_not_configured' });

  const isOwner = Boolean(
    user?.id && ranking.vipOwnerUserId && String(user.id) === String(ranking.vipOwnerUserId),
  );
  if (!isModerator(user) && !isOwner) {
    const clientKey = vipClientKey(req);
    const [attemptRows] = await Promise.all([
      sql.query(
        `
          SELECT COUNT(*)::int AS total
          FROM ranking_vip_unlock_attempts
          WHERE ranking_id = $1
            AND client_key = $2
            AND attempted_at >= now() - interval '15 minutes'
        `,
        [rankingId, clientKey],
      ),
      sql.query(
        `DELETE FROM ranking_vip_unlock_attempts WHERE attempted_at < now() - interval '1 day'`,
      ),
    ]);
    const attempts = Number(attemptRows[0]?.total || 0);
    if (attempts >= VIP_UNLOCK_ATTEMPT_LIMIT) {
      return json(res, 429, {
        error: 'vip_attempt_limit',
        retryAfterMinutes: VIP_UNLOCK_WINDOW_MINUTES,
      });
    }
    if (!verifyVipPassword(password, ranking.vipPasswordHash)) {
      await sql.query(
        `
          INSERT INTO ranking_vip_unlock_attempts (ranking_id, client_key)
          VALUES ($1, $2)
        `,
        [rankingId, clientKey],
      );
      return json(res, 401, {
        error: 'invalid_vip_password',
        attemptsRemaining: Math.max(0, VIP_UNLOCK_ATTEMPT_LIMIT - attempts - 1),
      });
    }
    await sql.query(
      `DELETE FROM ranking_vip_unlock_attempts WHERE ranking_id = $1 AND client_key = $2`,
      [rankingId, clientKey],
    );
  }

  if (!setVipAccessCookie(req, res, rankingId, Number(ranking.vipPasswordVersion || 0))) {
    return json(res, 503, { error: 'vip_not_configured' });
  }
  return json(res, 200, { ok: true, rankingId });
}

function favoriteRankingPayload(row) {
  const imageUrl = row.imageUrl || row.image_url || null;
  return {
    id: row.id,
    q: rankingQuestion(row.id, row.question),
    cat: row.category,
    img: resolveRankingCover(row.id, imageUrl),
    createdAt: row.createdAt || row.created_at || null,
    favoritedAt: row.favoritedAt || row.favorited_at || null,
    favorite: true,
  };
}

async function favoriteRowsForUser(userId) {
  return sql.query(
    `
      SELECT
        ranking.id,
        ranking.category,
        ranking.question,
        ranking.image_url AS "imageUrl",
        ranking.created_at AS "createdAt",
        favorite.created_at AS "favoritedAt"
      FROM user_ranking_favorites favorite
      JOIN rankings ranking ON ranking.id = favorite.ranking_id
      WHERE favorite.user_id = $1::uuid
        AND ranking.is_active = true
        AND ranking.is_vip = false
      ORDER BY favorite.created_at DESC, ranking.id
    `,
    [userId],
  );
}

async function favorites(req, res) {
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: 'authentication_required' });

  const [rows, collectionRows] = await Promise.all([
    favoriteRowsForUser(user.id),
    sql.query(
      `
        SELECT share_token AS "shareToken"
        FROM user_favorite_collections
        WHERE user_id = $1::uuid
        LIMIT 1
      `,
      [user.id],
    ),
  ]);
  const shareToken = favoriteShareToken(collectionRows[0]?.shareToken);

  return json(res, 200, {
    favorites: rows.map(favoriteRankingPayload),
    sharePath: shareToken ? `/favoritos/${shareToken}` : null,
  });
}

async function addFavorite(req, res, body) {
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: 'authentication_required' });

  const rankingId = String(body.rankingId || '').trim();
  if (!isValidRankingId(rankingId)) return json(res, 400, { error: 'invalid_ranking' });

  const inserted = await sql.query(
    `
      INSERT INTO user_ranking_favorites (user_id, ranking_id)
      SELECT $1::uuid, ranking.id
      FROM rankings ranking
      WHERE ranking.id = $2
        AND ranking.is_active = true
        AND ranking.is_vip = false
      ON CONFLICT (user_id, ranking_id) DO UPDATE
      SET created_at = user_ranking_favorites.created_at
      RETURNING ranking_id AS "rankingId"
    `,
    [user.id, rankingId],
  );
  if (!inserted[0]) return json(res, 404, { error: 'ranking_not_found' });

  return json(res, 200, { ok: true, rankingId, favorite: true });
}

async function removeFavorite(req, res) {
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: 'authentication_required' });

  const rankingId = queryValue(req, 'ranking_id').trim();
  if (!isValidRankingId(rankingId)) return json(res, 400, { error: 'invalid_ranking' });

  await sql.query(
    `
      DELETE FROM user_ranking_favorites
      WHERE user_id = $1::uuid
        AND ranking_id = $2
    `,
    [user.id, rankingId],
  );
  return json(res, 200, { ok: true, rankingId, favorite: false });
}

async function shareFavorites(req, res) {
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: 'authentication_required' });

  const countRows = await sql.query(
    `
      SELECT COUNT(*)::int AS total
      FROM user_ranking_favorites favorite
      JOIN rankings ranking ON ranking.id = favorite.ranking_id
      WHERE favorite.user_id = $1::uuid
        AND ranking.is_active = true
        AND ranking.is_vip = false
    `,
    [user.id],
  );
  if (Number(countRows[0]?.total || 0) === 0) {
    return json(res, 409, { error: 'favorites_empty' });
  }

  const generatedToken = randomBytes(24).toString('base64url');
  const rows = await sql.query(
    `
      INSERT INTO user_favorite_collections (user_id, share_token)
      VALUES ($1::uuid, $2)
      ON CONFLICT (user_id) DO UPDATE
      SET updated_at = now()
      RETURNING share_token AS "shareToken"
    `,
    [user.id, generatedToken],
  );
  const shareToken = favoriteShareToken(rows[0]?.shareToken);
  if (!shareToken) return json(res, 500, { error: 'favorite_share_failed' });

  return json(res, 200, {
    ok: true,
    sharePath: `/favoritos/${shareToken}`,
  });
}

async function createRankingShare(req, res, body) {
  const user = await sessionUser(req);
  if (!user) return json(res, 200, { ok: true, tracked: false });

  const deviceId = String(body.device_id || '');
  const rankingId = String(body.ranking_id || '').trim();
  const requestedChannel = String(body.channel || 'native').trim();
  const channel = RANKING_SHARE_CHANNELS.has(requestedChannel) ? requestedChannel : 'native';
  if (!isValidDevice(deviceId) || !isValidRankingId(rankingId)) {
    return json(res, 400, { error: 'invalid_ranking_share' });
  }
  if (!(await ensureSessionDevice(user, deviceId))) {
    return json(res, 409, { error: 'device_rekey_required' });
  }

  const token = randomBytes(18).toString('base64url');
  const rows = await sql.query(
    `
      INSERT INTO ranking_share_referrals (
        token, ranking_id, sharer_user_id, sharer_device_id, channel, created_at
      )
      SELECT $1, ranking.id, $2::uuid, $3, $4, now()
      FROM rankings ranking
      WHERE ranking.id = $5
        AND ranking.is_active = true
        AND ranking.is_vip = false
      RETURNING token
    `,
    [token, user.id, deviceId, channel, rankingId],
  );
  if (!rows[0]?.token) return json(res, 404, { error: 'ranking_not_found' });

  return json(res, 200, { ok: true, tracked: true, token: rows[0].token });
}

async function favoriteCollection(req, res) {
  const shareToken = favoriteShareToken(queryValue(req, 'token'));
  if (!shareToken) return json(res, 400, { error: 'invalid_favorite_collection' });

  const collectionRows = await sql.query(
    `
      SELECT
        collection.user_id AS "userId",
        users.display_name AS name,
        collection.updated_at AS "updatedAt"
      FROM user_favorite_collections collection
      JOIN users ON users.id = collection.user_id
      WHERE collection.share_token = $1
      LIMIT 1
    `,
    [shareToken],
  );
  const collection = collectionRows[0];
  if (!collection) return json(res, 404, { error: 'favorite_collection_not_found' });

  const rows = await favoriteRowsForUser(collection.userId);
  return json(res, 200, {
    owner: { name: collection.name || 'Pessoa no TOPO' },
    favorites: rows.map(favoriteRankingPayload),
    updatedAt: collection.updatedAt || null,
  });
}

function clerkConfig(req, res) {
  const frontendApi = clerkFrontendApi();
  if (!CLERK_PUBLISHABLE_KEY || !CLERK_SECRET_KEY || !frontendApi) {
    return json(res, 503, {
      error: 'clerk_not_configured',
      missing: [
        !CLERK_PUBLISHABLE_KEY && 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
        !CLERK_SECRET_KEY && 'CLERK_SECRET_KEY',
        CLERK_PUBLISHABLE_KEY && !frontendApi && 'valid_publishable_key',
      ].filter(Boolean),
    });
  }
  return json(res, 200, {
    publishableKey: CLERK_PUBLISHABLE_KEY,
    frontendApi,
  });
}

function logout(req, res) {
  clearSessionCookie(res);
  return json(res, 200, { ok: true });
}

function currentVoteStreak(rows) {
  const days = new Set(rows.map((row) => Number(row.daysAgo)));
  let expected = days.has(0) ? 0 : days.has(1) ? 1 : null;
  if (expected === null) return 0;

  let streak = 0;
  while (days.has(expected)) {
    streak += 1;
    expected += 1;
  }
  return streak;
}

async function syncUserScoreEvents(userId) {
  if (!userId) return;
  await sql.transaction([
    sql.query(
      `
        INSERT INTO user_score_events (
          user_id, event_type, event_key, ranking_id, points, created_at
        )
        SELECT
          history.user_id,
          'direct_vote',
          history.option_id::text,
          option.ranking_id,
          $2,
          history.first_voted_at
        FROM user_vote_history history
        JOIN ranking_options option ON option.id = history.option_id
        JOIN rankings ranking ON ranking.id = option.ranking_id
        WHERE history.user_id = $1::uuid
          AND ranking.is_vip = false
        ON CONFLICT (user_id, event_type, event_key) DO NOTHING
      `,
      [userId, PARTICIPATION_SCORE.directVote],
    ),
    sql.query(
      `
        WITH participation AS (
          SELECT option.ranking_id, history.first_voted_at AS occurred_at
          FROM user_vote_history history
          JOIN ranking_options option ON option.id = history.option_id
          JOIN rankings ranking ON ranking.id = option.ranking_id
          WHERE history.user_id = $1::uuid
            AND ranking.is_vip = false

          UNION ALL

          SELECT round.ranking_id, round.created_at AS occurred_at
          FROM ranking_duel_rounds round
          JOIN rankings ranking ON ranking.id = round.ranking_id
          WHERE round.user_id = $1::uuid
            AND round.skipped = false
            AND ranking.is_vip = false
        )
        INSERT INTO user_score_events (
          user_id, event_type, event_key, ranking_id, points, created_at
        )
        SELECT
          $1::uuid,
          'ranking_participation',
          ranking_id,
          ranking_id,
          $2,
          MIN(occurred_at)
        FROM participation
        GROUP BY ranking_id
        ON CONFLICT (user_id, event_type, event_key) DO NOTHING
      `,
      [userId, PARTICIPATION_SCORE.rankingParticipation],
    ),
    sql.query(
      `
        INSERT INTO user_score_events (
          user_id, event_type, event_key, ranking_id, points, created_at
        )
        SELECT
          session.user_id,
          'completed_duel',
          session.ranking_id,
          session.ranking_id,
          $2,
          session.updated_at
        FROM ranking_duel_sessions session
        JOIN rankings ranking ON ranking.id = session.ranking_id
        WHERE session.user_id = $1::uuid
          AND session.completed = true
          AND ranking.is_vip = false
        ON CONFLICT (user_id, event_type, event_key) DO NOTHING
      `,
      [userId, PARTICIPATION_SCORE.completedDuel],
    ),
    sql.query(
      `
        WITH activity AS (
          SELECT history.first_voted_at AS occurred_at
          FROM user_vote_history history
          JOIN ranking_options option ON option.id = history.option_id
          JOIN rankings ranking ON ranking.id = option.ranking_id
          WHERE history.user_id = $1::uuid
            AND ranking.is_vip = false

          UNION ALL

          SELECT round.created_at AS occurred_at
          FROM ranking_duel_rounds round
          JOIN rankings ranking ON ranking.id = round.ranking_id
          WHERE round.user_id = $1::uuid
            AND round.skipped = false
            AND ranking.is_vip = false
        ), active_days AS (
          SELECT
            (occurred_at AT TIME ZONE 'America/Sao_Paulo')::date AS active_day,
            MIN(occurred_at) AS occurred_at
          FROM activity
          GROUP BY (occurred_at AT TIME ZONE 'America/Sao_Paulo')::date
        )
        INSERT INTO user_score_events (
          user_id, event_type, event_key, ranking_id, points, created_at
        )
        SELECT
          $1::uuid,
          'active_day',
          active_day::text,
          NULL,
          $2,
          occurred_at
        FROM active_days
        ON CONFLICT (user_id, event_type, event_key) DO NOTHING
      `,
      [userId, PARTICIPATION_SCORE.activeDay],
    ),
  ]);
}

async function profile(req, res) {
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: 'authentication_required' });
  const deviceId = queryValue(req, 'device_id').slice(0, 100);
  if (isValidDevice(deviceId) && !(await ensureSessionDevice(user, deviceId))) {
    return json(res, 409, { error: 'device_rekey_required' });
  }

  await syncUserVoteHistory(user.id);
  await syncUserScoreEvents(user.id);

  const [
    statsRows,
    rankingActivityRows,
    recentRows,
    categoryRows,
    profileRows,
    streakRows,
    assignmentRows,
    doubleVotes,
    optionSuggestionRows,
    topicSuggestionRows,
  ] = await Promise.all([
    sql.query(
      `
      WITH latest AS (
        SELECT
          v.option_id,
          v.direction
        FROM votes v
        JOIN ranking_options option ON option.id = v.option_id
        JOIN rankings ranking ON ranking.id = option.ranking_id
        WHERE v.user_id = $1
          AND ranking.is_vip = false
      ),
      direct_activity AS (
        SELECT option.ranking_id
        FROM user_vote_history history
        JOIN ranking_options option ON option.id = history.option_id
        JOIN rankings ranking ON ranking.id = option.ranking_id
        WHERE history.user_id = $1
          AND ranking.is_vip = false
      ),
      duel_activity AS (
        SELECT round.ranking_id
        FROM ranking_duel_rounds round
        JOIN rankings ranking ON ranking.id = round.ranking_id
        WHERE round.user_id = $1
          AND round.skipped = false
          AND ranking.is_vip = false
      ),
      activity_rankings AS (
        SELECT ranking_id FROM direct_activity
        UNION
        SELECT ranking_id FROM duel_activity
      ),
      score_stats AS (
        SELECT
          COALESCE(SUM(event.points), 0)::int AS points,
          COUNT(*) FILTER (WHERE event.event_type = 'completed_duel')::int
            AS completed_duels,
          COUNT(*) FILTER (WHERE event.event_type = 'qualified_share')::int
            AS qualified_shares,
          COALESCE(SUM(event.points) FILTER (
            WHERE event.event_type = 'direct_vote'
          ), 0)::int AS direct_vote_points,
          COALESCE(SUM(event.points) FILTER (
            WHERE event.event_type = 'ranking_participation'
          ), 0)::int AS ranking_points,
          COALESCE(SUM(event.points) FILTER (
            WHERE event.event_type = 'completed_duel'
          ), 0)::int AS completed_duel_points,
          COALESCE(SUM(event.points) FILTER (
            WHERE event.event_type = 'active_day'
          ), 0)::int AS active_day_points,
          COALESCE(SUM(event.points) FILTER (
            WHERE event.event_type = 'qualified_share'
          ), 0)::int AS share_points
        FROM user_score_events event
        WHERE event.user_id = $1::uuid
      )
      SELECT
        (
          (SELECT COUNT(*) FROM direct_activity)
          + (SELECT COUNT(*) FROM duel_activity)
        )::int AS votes,
        score.points,
        (SELECT COUNT(*)::int FROM direct_activity) AS direct_votes,
        (SELECT COUNT(*)::int FROM duel_activity) AS duel_points,
        (SELECT COUNT(*)::int FROM activity_rankings) AS rankings,
        (SELECT COUNT(*)::int FROM latest WHERE direction = 1) AS up_votes,
        (SELECT COUNT(*)::int FROM latest WHERE direction = -1) AS down_votes,
        score.completed_duels,
        score.qualified_shares,
        score.direct_vote_points,
        score.ranking_points,
        score.completed_duel_points,
        score.active_day_points,
        score.share_points
      FROM score_stats score
    `,
      [user.id],
    ),
    sql.query(
      `
      WITH voted AS (
        SELECT
          option.ranking_id,
          MAX(history.first_voted_at) AS updated_at
        FROM user_vote_history history
        JOIN ranking_options option ON option.id = history.option_id
        WHERE history.user_id = $1
        GROUP BY option.ranking_id
      ),
      played AS (
        SELECT
          session.id,
          session.ranking_id,
          session.champion_option_id,
          session.completed,
          session.updated_at
        FROM ranking_duel_sessions session
        WHERE session.user_id = $1
      )
      SELECT
        ranking.id AS "rankingId",
        ranking.question,
        ranking.category,
        ranking.image_url AS "imageUrl",
        (voted.ranking_id IS NOT NULL) AS voted,
        (played.ranking_id IS NOT NULL) AS played,
        played.completed,
        played.champion_option_id AS "winnerOptionId",
        champion.label AS winner,
        GREATEST(
          COALESCE(voted.updated_at, '-infinity'::timestamptz),
          COALESCE(played.updated_at, '-infinity'::timestamptz)
        ) AS "updatedAt"
      FROM rankings ranking
      LEFT JOIN voted ON voted.ranking_id = ranking.id
      LEFT JOIN played ON played.ranking_id = ranking.id
      LEFT JOIN ranking_options champion
        ON champion.ranking_id = ranking.id
       AND champion.id = played.champion_option_id
      WHERE ranking.is_active = true
        AND (voted.ranking_id IS NOT NULL OR played.ranking_id IS NOT NULL)
      ORDER BY "updatedAt" DESC, ranking.id
      LIMIT 40
    `,
      [user.id],
    ),
    sql.query(
      `
      WITH latest AS (
        SELECT
          v.option_id,
          v.direction,
          v.updated_at
        FROM votes v
        WHERE v.user_id = $1
      )
      SELECT
        r.id AS "rankingId",
        r.question,
        o.label AS option,
        l.direction,
        l.updated_at AS "updatedAt",
        CASE WHEN dv.option_id IS NULL THEN 1 ELSE 2 END::int AS weight
      FROM latest l
      JOIN ranking_options o ON o.id = l.option_id
      JOIN rankings r ON r.id = o.ranking_id
      LEFT JOIN user_double_votes dv
        ON dv.user_id = $1
       AND dv.option_id = l.option_id
       AND dv.direction = l.direction
      ORDER BY l.updated_at DESC
      LIMIT 20
    `,
      [user.id],
    ),
    sql.query(
      `
      WITH latest AS (
        SELECT
          v.option_id
        FROM votes v
        WHERE v.user_id = $1
      )
      SELECT r.category AS name, COUNT(*)::int AS votes
      FROM latest l
      JOIN ranking_options o ON o.id = l.option_id
      JOIN rankings r ON r.id = o.ranking_id
      GROUP BY r.category
      ORDER BY votes DESC, r.category
    `,
      [user.id],
    ),
    sql.query(
      `
      SELECT
        avatar_data AS "avatarData",
        show_avatar_on_leaderboard AS "showAvatarOnLeaderboard"
      FROM user_profiles
      WHERE user_id = $1
      LIMIT 1
    `,
      [user.id],
    ),
    sql.query(
      `
      SELECT (
        (now() AT TIME ZONE 'America/Sao_Paulo')::date
        - event.event_key::date
      )::int AS "daysAgo"
      FROM user_score_events event
      WHERE event.user_id = $1::uuid
        AND event.event_type = 'active_day'
        AND event.event_key ~ '^\\d{4}-\\d{2}-\\d{2}$'
        AND event.event_key::date >=
          (now() AT TIME ZONE 'America/Sao_Paulo')::date - 400
      ORDER BY "daysAgo"
    `,
      [user.id],
    ),
    sql.query(
      `
      SELECT
        dv.slot,
        dv.option_id AS "optionId",
        dv.direction,
        dv.updated_at AS "updatedAt",
        r.id AS "rankingId",
        r.question,
        o.label AS option
      FROM user_double_votes dv
      JOIN ranking_options o ON o.id = dv.option_id
      JOIN rankings r ON r.id = o.ranking_id
      WHERE dv.user_id = $1
      ORDER BY dv.slot
    `,
      [user.id],
    ),
    doubleVoteState(user),
    sql.query(
      `
      SELECT
        s.id,
        s.ranking_id AS "rankingId",
        r.question,
        s.label,
        s.status,
        s.moderation_note AS "moderationNote",
        s.created_at AS "createdAt",
        s.reviewed_at AS "reviewedAt"
      FROM ranking_option_suggestions s
      JOIN rankings r ON r.id = s.ranking_id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC
      LIMIT 20
    `,
      [user.id],
    ),
    sql.query(
      `
      SELECT
        id,
        title,
        category,
        example_options AS "exampleOptions",
        status,
        moderation_note AS "moderationNote",
        published_ranking_id AS "publishedRankingId",
        created_at AS "createdAt",
        reviewed_at AS "reviewedAt"
      FROM ranking_topic_suggestions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `,
      [user.id],
    ),
  ]);

  const stats = statsRows[0] || {};
  const savedProfile = profileRows[0] || {};
  return json(res, 200, {
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      ...profileNamePayload(user),
    },
    isModerator: isModerator(user),
    profile: {
      avatarData: savedProfile.avatarData || null,
      showAvatarOnLeaderboard: savedProfile.showAvatarOnLeaderboard !== false,
    },
    stats: {
      points: Number(stats.points || 0),
      votes: Number(stats.votes || 0),
      directVotes: Number(stats.direct_votes || 0),
      duelPoints: Number(stats.duel_points || 0),
      completedDuels: Number(stats.completed_duels || 0),
      qualifiedShares: Number(stats.qualified_shares || 0),
      rankings: Number(stats.rankings || 0),
      upVotes: Number(stats.up_votes || 0),
      downVotes: Number(stats.down_votes || 0),
      streak: currentVoteStreak(streakRows),
      scoreBreakdown: {
        directVotes: Number(stats.direct_vote_points || 0),
        rankings: Number(stats.ranking_points || 0),
        completedDuels: Number(stats.completed_duel_points || 0),
        activeDays: Number(stats.active_day_points || 0),
        qualifiedShares: Number(stats.share_points || 0),
      },
    },
    doubleVotes: {
      ...doubleVotes,
      assignments: assignmentRows.map((row) => ({
        slot: Number(row.slot),
        optionId: Number(row.optionId),
        direction: Number(row.direction),
        updatedAt: row.updatedAt,
        rankingId: row.rankingId,
        question: rankingQuestion(row.rankingId, row.question),
        option: row.option,
      })),
    },
    categories: categoryRows.map((row) => ({
      name: row.name,
      votes: Number(row.votes || 0),
    })),
    recent: recentRows.map((row) => ({
      rankingId: row.rankingId,
      question: rankingQuestion(row.rankingId, row.question),
      option: row.option,
      direction: Number(row.direction),
      weight: Number(row.weight || 1),
      updatedAt: row.updatedAt,
    })),
    rankingActivity: rankingActivityRows.map((row) => ({
      rankingId: row.rankingId,
      question: rankingQuestion(row.rankingId, row.question),
      category: row.category,
      image: resolveRankingCover(row.rankingId, row.imageUrl),
      voted: row.voted === true,
      played: row.played === true,
      completed: row.completed === true,
      winnerOptionId: row.winnerOptionId ? Number(row.winnerOptionId) : null,
      winner: row.winner || null,
      updatedAt: row.updatedAt,
    })),
    suggestions: {
      options: optionSuggestionRows.map((row) => ({
        ...row,
        question: rankingQuestion(row.rankingId, row.question),
      })),
      rankings: topicSuggestionRows,
    },
  });
}

async function leaderboard(req, res) {
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: 'authentication_required' });

  const rows = await sql.query(
    `
    WITH direct_stats AS (
      SELECT
        history.user_id,
        COUNT(*)::int AS direct_votes
      FROM user_vote_history history
      JOIN ranking_options option ON option.id = history.option_id
      JOIN rankings ranking ON ranking.id = option.ranking_id
      WHERE ranking.is_vip = false
      GROUP BY history.user_id
    ),
    duel_stats AS (
      SELECT
        round.user_id,
        COUNT(*) FILTER (WHERE round.skipped = false)::int AS duel_votes
      FROM ranking_duel_rounds round
      JOIN rankings ranking ON ranking.id = round.ranking_id
      WHERE round.user_id IS NOT NULL
        AND ranking.is_vip = false
      GROUP BY round.user_id
    ),
    activity_rankings AS (
      SELECT history.user_id, option.ranking_id
      FROM user_vote_history history
      JOIN ranking_options option ON option.id = history.option_id
      JOIN rankings ranking ON ranking.id = option.ranking_id
      WHERE ranking.is_vip = false
      UNION
      SELECT round.user_id, round.ranking_id
      FROM ranking_duel_rounds round
      JOIN rankings ranking ON ranking.id = round.ranking_id
      WHERE round.user_id IS NOT NULL
        AND round.skipped = false
        AND ranking.is_vip = false
    ),
    ranking_stats AS (
      SELECT user_id, COUNT(*)::int AS rankings
      FROM activity_rankings
      GROUP BY user_id
    ),
    score_stats AS (
      SELECT
        event.user_id,
        COALESCE(SUM(event.points), 0)::bigint AS points
      FROM user_score_events event
      GROUP BY event.user_id
    ),
    scored AS (
      SELECT
        u.id AS "userId",
        u.display_name AS name,
        (COALESCE(direct.direct_votes, 0) + COALESCE(duel.duel_votes, 0))::int AS votes,
        COALESCE(score.points, 0)::bigint AS points,
        COALESCE(activity.rankings, 0)::int AS rankings,
        CASE
          WHEN COALESCE(p.show_avatar_on_leaderboard, true)
            THEN p.avatar_data
          ELSE NULL
        END AS "avatarData"
      FROM users u
      LEFT JOIN direct_stats direct ON direct.user_id = u.id
      LEFT JOIN duel_stats duel ON duel.user_id = u.id
      LEFT JOIN ranking_stats activity ON activity.user_id = u.id
      LEFT JOIN score_stats score ON score.user_id = u.id
      LEFT JOIN user_profiles p ON p.user_id = u.id
    ),
    ranked AS (
      SELECT
        scored.*,
        DENSE_RANK() OVER (
          ORDER BY
            scored.points DESC,
            scored.rankings DESC
        )::int AS position
      FROM scored
    )
    SELECT
      "userId",
      name,
      votes,
      points,
      rankings,
      position,
      "avatarData",
      ("userId" = $1) AS "isCurrent",
      EXISTS (
        SELECT 1
        FROM user_name_reports report
        WHERE report.reporter_user_id = $1
          AND report.reported_user_id = "userId"
          AND report.status = 'pending'
      ) AS "reportedByCurrent"
    FROM ranked
    WHERE position <= 10 OR "userId" = $1
    ORDER BY position, name
  `,
    [user.id],
  );

  return json(res, 200, {
    leaderboard: rows.map((row) => ({
      userId: row.userId,
      name: row.name,
      votes: Number(row.votes || 0),
      points: Number(row.points || 0),
      rankings: Number(row.rankings || 0),
      position: Number(row.position || 0),
      avatarData: row.avatarData || null,
      isCurrent: row.isCurrent === true,
      reportedByCurrent: row.reportedByCurrent === true,
    })),
  });
}

async function createNameReport(req, res, body) {
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: 'authentication_required' });
  const reportedUserId = String(body.userId || '');
  if (!/^[0-9a-f-]{36}$/i.test(reportedUserId) || reportedUserId === user.id) {
    return json(res, 400, { error: 'invalid_name_report' });
  }

  const [target, dailyRows] = await Promise.all([
    sql.query(
      `
      SELECT id, display_name
      FROM users
      WHERE id = $1::uuid
      LIMIT 1
    `,
      [reportedUserId],
    ),
    sql.query(
      `
      SELECT COUNT(*)::int AS total
      FROM user_name_reports
      WHERE reporter_user_id = $1
        AND created_at >= now() - interval '24 hours'
    `,
      [user.id],
    ),
  ]);
  if (!target[0]) return json(res, 404, { error: 'reported_user_not_found' });
  if (Number(dailyRows[0]?.total || 0) >= NAME_REPORT_DAILY_LIMIT) {
    return json(res, 429, { error: 'name_report_limit' });
  }

  const rows = await sql.query(
    `
    INSERT INTO user_name_reports (
      id,
      reporter_user_id,
      reported_user_id,
      reported_name
    )
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (reporter_user_id, reported_user_id)
      WHERE status = 'pending'
    DO NOTHING
    RETURNING id
  `,
    [randomUUID(), user.id, reportedUserId, target[0].display_name],
  );

  return json(res, 200, { ok: true, alreadyReported: !rows[0] });
}

async function updateProfile(req, res, body) {
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: 'authentication_required' });

  const hasAvatar = Object.prototype.hasOwnProperty.call(body, 'avatarData');
  const hasVisibility = Object.prototype.hasOwnProperty.call(body, 'showAvatarOnLeaderboard');
  const hasDisplayName = Object.prototype.hasOwnProperty.call(body, 'displayName');
  if (!hasAvatar && !hasVisibility && !hasDisplayName) {
    return json(res, 400, { error: 'invalid_profile' });
  }

  if (
    hasAvatar &&
    body.avatarData !== null &&
    (typeof body.avatarData !== 'string' ||
      body.avatarData.length > PROFILE_AVATAR_MAX_LENGTH ||
      !/^data:image\/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/]+={0,2}$/.test(body.avatarData))
  ) {
    return json(res, 400, { error: 'invalid_profile_image' });
  }

  if (hasVisibility && typeof body.showAvatarOnLeaderboard !== 'boolean') {
    return json(res, 400, { error: 'invalid_profile_visibility' });
  }

  let savedUser = user;
  if (hasDisplayName) {
    const validation = validateDisplayName(
      body.displayName,
      process.env.TOPO_PROFILE_NAME_BLOCKLIST,
    );
    if (!validation.value) {
      return json(res, 400, {
        error: 'invalid_display_name',
        reason: validation.error || 'invalid',
      });
    }

    const [updatedUser] = await sql.query(
      `
      UPDATE users
      SET display_name = $2,
          display_name_updated_at = now()
      WHERE id = $1
        AND (
          display_name_updated_at IS NULL
          OR display_name_updated_at <= now() - interval '30 days'
        )
      RETURNING id, email, display_name, display_name_updated_at, created_at
    `,
      [user.id, validation.value],
    );
    if (!updatedUser) {
      const [currentUser] = await sql.query(
        `
        SELECT id, email, display_name, display_name_updated_at, created_at
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
        [user.id],
      );
      const state = displayNameChangeState(currentUser?.display_name_updated_at);
      return json(res, 409, {
        error: 'display_name_cooldown',
        availableAt: state.availableAt,
      });
    }
    savedUser = { ...updatedUser, clerk_user_id: user.clerk_user_id };
  }

  const [current] = await sql.query(
    `
    SELECT
      avatar_data AS "avatarData",
      show_avatar_on_leaderboard AS "showAvatarOnLeaderboard"
    FROM user_profiles
    WHERE user_id = $1
    LIMIT 1
  `,
    [user.id],
  );
  const avatarData = hasAvatar ? body.avatarData : current?.avatarData || null;
  const showAvatarOnLeaderboard = hasVisibility
    ? body.showAvatarOnLeaderboard
    : current?.showAvatarOnLeaderboard !== false;

  const [saved] = await sql.query(
    `
    INSERT INTO user_profiles (
      user_id,
      avatar_data,
      show_avatar_on_leaderboard,
      updated_at
    )
    VALUES ($1, $2, $3, now())
    ON CONFLICT (user_id)
    DO UPDATE SET
      avatar_data = EXCLUDED.avatar_data,
      show_avatar_on_leaderboard = EXCLUDED.show_avatar_on_leaderboard,
      updated_at = now()
    RETURNING
      avatar_data AS "avatarData",
      show_avatar_on_leaderboard AS "showAvatarOnLeaderboard"
  `,
    [user.id, avatarData, showAvatarOnLeaderboard],
  );

  return json(res, 200, {
    ok: true,
    user: profileNamePayload(savedUser),
    profile: {
      avatarData: saved?.avatarData || null,
      showAvatarOnLeaderboard: saved?.showAvatarOnLeaderboard !== false,
    },
  });
}

function validCommentBody(value) {
  if (typeof value !== 'string') return null;
  const body = value.trim();
  const length = [...body].length;
  return length >= 1 && length <= COMMENT_LIMIT ? body : null;
}

function commentPayload(row) {
  return {
    id: Number(row.id),
    name: row.name,
    body: row.body,
    optionId: Number(row.optionId),
    option: row.option,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    edited: Boolean(row.edited),
    isMine: Boolean(row.isMine),
  };
}

async function activeRanking(rankingId) {
  const [ranking] = await sql.query(
    `
    SELECT
      id,
      is_vip AS "isVip",
      vip_password_version AS "vipPasswordVersion",
      vip_owner_user_id AS "vipOwnerUserId"
    FROM rankings
    WHERE id = $1
      AND is_active = true
    LIMIT 1
  `,
    [rankingId],
  );
  return ranking || null;
}

async function comments(req, res) {
  const rankingId = queryValue(req, 'ranking_id').slice(0, 100);
  const all = queryValue(req, 'view') === 'all';
  const requestedPage = Number(queryValue(req, 'page'));
  const page =
    all && Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, 10000)
      : 0;
  const pageSize = all ? COMMENTS_PAGE_SIZE : 2;
  const offset = all ? page * pageSize : 0;
  if (!rankingId) return json(res, 400, { error: 'invalid_ranking' });
  const user = await sessionUser(req);
  const ranking = await activeRanking(rankingId);
  if (!ranking) {
    return json(res, 404, { error: 'ranking_not_found' });
  }
  if (!hasVipAccess(req, user, ranking)) {
    return json(res, 403, { error: 'vip_password_required' });
  }

  const recentQuery = sql.query(
    `
    SELECT
      c.id,
      u.display_name AS name,
      c.body,
      c.option_id AS "optionId",
      o.label AS option,
      c.created_at AS "createdAt",
      c.updated_at AS "updatedAt",
      c.updated_at > c.created_at AS edited,
      c.user_id = $2::uuid AS "isMine"
    FROM ranking_comments c
    JOIN users u ON u.id = c.user_id
    JOIN ranking_options o
      ON o.ranking_id = c.ranking_id
      AND o.id = c.option_id
    WHERE c.ranking_id = $1
      AND c.status = 'published'
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT $3
    OFFSET $4
  `,
    [rankingId, user?.id || null, pageSize, offset],
  );
  const countQuery = sql.query(
    `
    SELECT COUNT(*)::int AS total
    FROM ranking_comments
    WHERE ranking_id = $1
      AND status = 'published'
  `,
    [rankingId],
  );
  const mineQuery = user
    ? sql.query(
        `
    SELECT
      c.id,
      u.display_name AS name,
      c.body,
      c.option_id AS "optionId",
      o.label AS option,
      c.created_at AS "createdAt",
      c.updated_at AS "updatedAt",
      c.updated_at > c.created_at AS edited,
      true AS "isMine"
    FROM ranking_comments c
    JOIN users u ON u.id = c.user_id
    JOIN ranking_options o
      ON o.ranking_id = c.ranking_id
      AND o.id = c.option_id
    WHERE c.ranking_id = $1
      AND c.user_id = $2
      AND c.status = 'published'
    LIMIT 1
  `,
        [rankingId, user.id],
      )
    : Promise.resolve([]);

  const [recentRows, countRows, mineRows] = await Promise.all([recentQuery, countQuery, mineQuery]);

  const total = Number(countRows[0]?.total || 0);
  return json(res, 200, {
    comments: recentRows.map(commentPayload),
    total,
    mine: mineRows[0] ? commentPayload(mineRows[0]) : null,
    limit: COMMENT_LIMIT,
    page,
    pageSize,
    hasMore: offset + recentRows.length < total,
  });
}

async function writeComment(req, res, body, editing = false) {
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: 'authentication_required' });

  const rankingId = String(body.ranking_id || '')
    .trim()
    .slice(0, 100);
  const optionId = Number(body.option_id);
  const commentBody = validCommentBody(body.body);
  if (!rankingId || !Number.isSafeInteger(optionId) || optionId <= 0 || !commentBody) {
    return json(res, 400, { error: 'invalid_comment', limit: COMMENT_LIMIT });
  }

  const [option] = await sql.query(
    `
    SELECT
      o.id,
      r.is_vip AS "isVip",
      r.vip_password_version AS "vipPasswordVersion",
      r.vip_owner_user_id AS "vipOwnerUserId"
    FROM ranking_options o
    JOIN rankings r ON r.id = o.ranking_id
    WHERE o.ranking_id = $1
      AND o.id = $2
      AND r.is_active = true
    LIMIT 1
  `,
    [rankingId, optionId],
  );
  if (!option) return json(res, 404, { error: 'option_not_found' });
  if (!hasVipAccess(req, user, { ...option, id: rankingId })) {
    return json(res, 403, { error: 'vip_password_required' });
  }

  if (editing) {
    const updated = await sql.query(
      `
      UPDATE ranking_comments
      SET option_id = $3,
          body = $4,
          updated_at = now()
      WHERE ranking_id = $1
        AND user_id = $2
        AND status = 'published'
      RETURNING id
    `,
      [rankingId, user.id, optionId, commentBody],
    );
    if (!updated[0]) {
      return json(res, 404, { error: 'comment_not_found' });
    }
  } else {
    try {
      await sql.query(
        `
        INSERT INTO ranking_comments (ranking_id, user_id, option_id, body)
        VALUES ($1, $2, $3, $4)
      `,
        [rankingId, user.id, optionId, commentBody],
      );
    } catch (error) {
      if (
        error?.code === '23505' &&
        String(error.constraint || '').includes('ranking_comments_one_per_user')
      ) {
        return json(res, 409, { error: 'comment_exists' });
      }
      throw error;
    }
  }

  const [row] = await sql.query(
    `
    SELECT
      c.id,
      u.display_name AS name,
      c.body,
      c.option_id AS "optionId",
      o.label AS option,
      c.created_at AS "createdAt",
      c.updated_at AS "updatedAt",
      c.updated_at > c.created_at AS edited,
      true AS "isMine"
    FROM ranking_comments c
    JOIN users u ON u.id = c.user_id
    JOIN ranking_options o
      ON o.ranking_id = c.ranking_id
      AND o.id = c.option_id
    WHERE c.ranking_id = $1
      AND c.user_id = $2
    LIMIT 1
  `,
    [rankingId, user.id],
  );

  return json(res, editing ? 200 : 201, {
    ok: true,
    comment: commentPayload(row),
  });
}

function emailHtml(value) {
  return String(value || '').replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  );
}

function siteOrigin(req) {
  const configured = String(process.env.TOPO_SITE_URL || '').trim();
  if (/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(configured)) {
    return configured.replace(/\/$/, '');
  }

  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '')
    .trim()
    .toLowerCase();
  if (
    host === 'somostopo.com.br' ||
    host === 'www.somostopo.com.br' ||
    /^[a-z0-9-]+\.vercel\.app$/.test(host)
  ) {
    return `https://${host}`;
  }

  return 'https://somostopo.com.br';
}

function resendApiKey() {
  const configured = String(process.env.RESEND_API_KEY || '').trim();
  if (configured) return configured;

  const marketplaceKey = Object.entries(process.env).find(
    ([name, value]) =>
      name.startsWith('RESEND_') && typeof value === 'string' && value.trim().startsWith('re_'),
  );

  return String(marketplaceKey?.[1] || '').trim();
}

function notificationFrom() {
  return String(process.env.TOPO_EMAIL_FROM || 'TOPO <conta@somostopo.com.br>').trim();
}

function moderationOrigin(req) {
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '')
    .trim()
    .toLowerCase();
  if (
    host === 'somostopo.com.br' ||
    host === 'www.somostopo.com.br' ||
    /^[a-z0-9-]+\.vercel\.app$/.test(host)
  ) {
    return `https://${host}`;
  }
  return siteOrigin(req);
}

async function sendSuggestionModerationEmail(req, suggestion) {
  const apiKey = resendApiKey();
  const recipients = moderatorEmails();
  const from = notificationFrom();
  if (!apiKey || !from || !recipients.length) return { configured: false };

  const link = new URL('/moderacao', moderationOrigin(req));
  link.searchParams.set('tipo', suggestion.kind);
  link.searchParams.set('id', suggestion.id);
  const isOption = suggestion.kind === 'option';
  const subject = isOption
    ? `Nova opção sugerida: ${suggestion.label}`
    : `Nova ideia de ranking: ${suggestion.title}`;
  const heading = isOption ? 'Nova opção para analisar' : 'Nova ideia de ranking';
  const detail = isOption
    ? `<p><strong>Ranking:</strong> ${emailHtml(suggestion.question)}</p>
       <p><strong>Opção:</strong> ${emailHtml(suggestion.label)}</p>`
    : `<p><strong>Ideia:</strong> ${emailHtml(suggestion.title)}</p>
       <p>A categoria, as opções e a foto serão definidas pela equipe na moderação.</p>`;
  const flag = suggestion.flagReason
    ? `<p style="background:#f8e9e6;color:#8b3f36;border-radius:8px;padding:9px 11px"><strong>Atenção:</strong> ${emailHtml(suggestion.flagReason)}</p>`
    : '';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'idempotency-key': `topo-suggestion-${suggestion.kind}-${suggestion.id}`,
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject,
      html: `
        <div style="font-family:Arial,sans-serif;color:#191919;line-height:1.5;max-width:560px;margin:auto;padding:28px">
          <div style="font-family:Georgia,serif;font-size:34px;font-weight:700;color:#657986">TOPO</div>
          <h1 style="font-family:Georgia,serif;font-size:28px;line-height:1.1;margin:24px 0 12px">${heading}</h1>
          ${detail}
          <p><strong>Enviada por:</strong> ${emailHtml(suggestion.userName)} (${emailHtml(suggestion.userEmail)})</p>
          ${flag}
          <p style="margin:26px 0"><a href="${emailHtml(link.toString())}" style="background:#657986;color:white;text-decoration:none;border-radius:10px;padding:12px 18px;font-weight:700">Abrir para revisar</a></p>
          <p style="font-size:13px;color:#706d67">Por segurança, o clique abre o painel privado. Nenhuma decisão é tomada diretamente pelo e-mail.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const error = new Error(`Resend failed with status ${response.status}`);
    error.code = 'suggestion_email_failed';
    throw error;
  }
  return { configured: true };
}

async function notifySuggestionModerators(req, suggestion) {
  try {
    await sendSuggestionModerationEmail(req, suggestion);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'suggestion_email_failed',
        kind: suggestion.kind,
        suggestionId: suggestion.id,
        detail: String(error?.message || '').slice(0, 240),
      }),
    );
  }
}

async function createSuggestion(req, res, body) {
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: 'authentication_required' });
  const kind = String(body.kind || '');
  if (kind === 'option') {
    const rankingId = String(body.rankingId || '')
      .trim()
      .slice(0, 100);
    const label = suggestionText(body.label, 2, SUGGESTION_OPTION_LIMIT);
    const normalized = normalizeSuggestion(label);
    if (!rankingId || !label || !normalized) {
      return json(res, 400, { error: 'invalid_option_suggestion' });
    }
    const [ranking] = await sql.query(
      `
      SELECT
        id,
        question,
        is_vip AS "isVip",
        vip_password_version AS "vipPasswordVersion",
        vip_owner_user_id AS "vipOwnerUserId"
      FROM rankings
      WHERE id = $1 AND is_active = true
      LIMIT 1
    `,
      [rankingId],
    );
    if (!ranking) return json(res, 404, { error: 'ranking_not_found' });
    if (!hasVipAccess(req, user, ranking)) {
      return json(res, 403, { error: 'vip_password_required' });
    }

    const [existingOptionRows, recentRows] = await Promise.all([
      sql.query(
        `
        SELECT id, label
        FROM ranking_options
        WHERE ranking_id = $1
      `,
        [rankingId],
      ),
      sql.query(
        `
        SELECT COUNT(*)::int AS total
        FROM ranking_option_suggestions
        WHERE user_id = $1
          AND created_at >= now() - interval '24 hours'
      `,
        [user.id],
      ),
    ]);
    if (existingOptionRows.some((option) => normalizeSuggestion(option.label) === normalized)) {
      return json(res, 409, { error: 'option_already_exists' });
    }
    const possibleDuplicate = possibleOptionDuplicate(label, existingOptionRows);
    if (!isModerator(user) && Number(recentRows[0]?.total || 0) >= OPTION_SUGGESTION_DAILY_LIMIT) {
      return json(res, 429, {
        error: 'option_suggestion_limit',
        limit: OPTION_SUGGESTION_DAILY_LIMIT,
      });
    }

    const id = randomUUID();
    const flagReason = suggestionFlag(label);
    try {
      await sql.query(
        `
        INSERT INTO ranking_option_suggestions (
          id, ranking_id, user_id, label, normalized_label, flag_reason
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
        [id, rankingId, user.id, label, normalized, flagReason],
      );
    } catch (error) {
      if (error?.code === '23505') {
        return json(res, 409, { error: 'suggestion_already_pending' });
      }
      throw error;
    }

    await notifySuggestionModerators(req, {
      id,
      kind,
      label,
      question: rankingQuestion(ranking.id, ranking.question),
      flagReason,
      userName: user.display_name,
      userEmail: user.email,
    });
    return json(res, 201, {
      ok: true,
      id,
      status: 'pending',
      possibleDuplicate,
    });
  }

  if (kind === 'ranking') {
    const title = suggestionText(body.title, 8, SUGGESTION_TITLE_LIMIT);
    const category = PENDING_RANKING_CATEGORY;
    const exampleOptions = [...PENDING_RANKING_EXAMPLES];
    const normalized = normalizeSuggestion(title);
    if (!title || !normalized) {
      return json(res, 400, { error: 'invalid_ranking_suggestion' });
    }

    const [existingRankingRows, recentRows] = await Promise.all([
      sql.query(`
        SELECT id, question
        FROM rankings
        WHERE is_active = true
      `),
      sql.query(
        `
        SELECT COUNT(*)::int AS total
        FROM ranking_topic_suggestions
        WHERE user_id = $1
          AND created_at >= now() - interval '7 days'
      `,
        [user.id],
      ),
    ]);
    if (
      existingRankingRows.some(
        (ranking) =>
          normalizeSuggestion(rankingQuestion(ranking.id, ranking.question)) === normalized,
      )
    ) {
      return json(res, 409, { error: 'ranking_already_exists' });
    }
    if (Number(recentRows[0]?.total || 0) >= TOPIC_SUGGESTION_WEEKLY_LIMIT) {
      return json(res, 429, {
        error: 'ranking_suggestion_limit',
        limit: TOPIC_SUGGESTION_WEEKLY_LIMIT,
      });
    }

    const id = randomUUID();
    const flagReason = suggestionFlag(title);
    try {
      await sql.query(
        `
        INSERT INTO ranking_topic_suggestions (
          id,
          user_id,
          title,
          normalized_title,
          category,
          example_options,
          flag_reason
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
      `,
        [id, user.id, title, normalized, category, JSON.stringify(exampleOptions), flagReason],
      );
    } catch (error) {
      if (error?.code === '23505') {
        return json(res, 409, { error: 'suggestion_already_pending' });
      }
      throw error;
    }

    await notifySuggestionModerators(req, {
      id,
      kind,
      title,
      flagReason,
      userName: user.display_name,
      userEmail: user.email,
    });
    return json(res, 201, { ok: true, id, status: 'pending' });
  }

  return json(res, 400, { error: 'invalid_suggestion_kind' });
}

async function mySuggestions(req, res) {
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: 'authentication_required' });
  const [optionRows, rankingRows] = await Promise.all([
    sql.query(
      `
      SELECT
        s.id,
        s.ranking_id AS "rankingId",
        r.question,
        s.label,
        s.status,
        s.moderation_note AS "moderationNote",
        s.created_at AS "createdAt",
        s.reviewed_at AS "reviewedAt"
      FROM ranking_option_suggestions s
      JOIN rankings r ON r.id = s.ranking_id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC
      LIMIT 20
    `,
      [user.id],
    ),
    sql.query(
      `
      SELECT
        id,
        title,
        category,
        example_options AS "exampleOptions",
        status,
        moderation_note AS "moderationNote",
        published_ranking_id AS "publishedRankingId",
        created_at AS "createdAt",
        reviewed_at AS "reviewedAt"
      FROM ranking_topic_suggestions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `,
      [user.id],
    ),
  ]);

  return json(res, 200, {
    isModerator: isModerator(user),
    suggestions: {
      options: optionRows.map((row) => ({
        ...row,
        question: rankingQuestion(row.rankingId, row.question),
      })),
      rankings: rankingRows,
    },
  });
}

async function rankingImage(req, res) {
  const rankingId = queryValue(req, 'ranking_id').trim();
  if (!isValidRankingId(rankingId)) return json(res, 400, { error: 'invalid_ranking' });

  const [row] = await sql.query(
    `
      SELECT image.mime_type AS "mimeType", image.image_data AS "imageData"
      FROM ranking_images image
      JOIN rankings ranking ON ranking.id = image.ranking_id
      WHERE image.ranking_id = $1
        AND ranking.is_active = true
      LIMIT 1
    `,
    [rankingId],
  );
  if (!row) return json(res, 404, { error: 'image_not_found' });

  const image = Buffer.from(String(row.imageData || ''), 'base64');
  if (!image.length || image.length > RANKING_IMAGE_MAX_BYTES) {
    return json(res, 404, { error: 'image_not_found' });
  }
  res.setHeader('Content-Type', row.mimeType);
  res.setHeader('Content-Length', String(image.length));
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  res.setHeader('CDN-Cache-Control', 'public, max-age=31536000, immutable');
  return res.status(200).send(image);
}

function plainCommonsText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stableCommonsImageUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || url.hostname !== 'upload.wikimedia.org') return '';
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith('utm_')) url.searchParams.delete(key);
    }
    return url.href;
  } catch {
    return '';
  }
}

function commonsImageSuggestion(page) {
  const image = page?.imageinfo?.[0];
  const metadata = image?.extmetadata || {};
  const license = plainCommonsText(metadata.LicenseShortName?.value).toLowerCase();
  if (!(license === 'cc0' || license === 'pdm' || license.includes('public domain'))) return null;
  const width = Number(image?.width || 0);
  const height = Number(image?.height || 0);
  if (width < 1000 || height < 600 || width / height < 1.08) return null;
  if (!/^image\/(?:jpeg|png|webp)$/i.test(String(image?.mime || ''))) return null;

  const filename = String(page?.title || '').replace(/^File:/i, '');
  if (
    /\b(?:logo|logotipo|flag|bandeira|map|mapa|diagram|drawing|painting|poster|screenshot|svg|icon|coat of arms|bras[aã]o)\b/i.test(
      filename,
    )
  ) {
    return null;
  }
  const imageUrl = stableCommonsImageUrl(image.thumburl || image.url);
  if (!imageUrl) return null;
  return {
    id: String(page.pageid || filename),
    title: plainCommonsText(filename.replace(/\.(?:jpe?g|png|webp)$/i, '')) || 'Foto sugerida',
    imageUrl,
    sourceUrl: String(image.descriptionurl || ''),
    license: license === 'cc0' ? 'CC0' : 'Domínio público',
    width,
    height,
  };
}

async function searchCommonsImages(query) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrsearch', `${query} filetype:bitmap`);
  url.searchParams.set('gsrlimit', '24');
  url.searchParams.set('gsrsort', 'relevance');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|size|mime|extmetadata');
  url.searchParams.set('iiurlwidth', '1600');

  const response = await fetch(url, {
    headers: { 'user-agent': 'Somos TOPO semantic cover curator/1.0 (somostopo.com.br)' },
    signal: AbortSignal.timeout(RANKING_IMAGE_SEARCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`commons_search_${response.status}`);
  const payload = await response.json();
  return (payload?.query?.pages || []).map(commonsImageSuggestion).filter(Boolean);
}

async function rankingImageSuggestions(req, res) {
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: 'authentication_required' });
  if (!isModerator(user)) return json(res, 403, { error: 'moderator_required' });

  const rankingId = queryValue(req, 'ranking_id').trim();
  if (!isValidRankingId(rankingId)) return json(res, 400, { error: 'invalid_ranking' });
  const [rankingRows, optionRows] = await Promise.all([
    sql.query(
      `
        SELECT id, category, question
        FROM rankings
        WHERE id = $1 AND is_active = true
        LIMIT 1
      `,
      [rankingId],
    ),
    sql.query(
      `
        SELECT label
        FROM ranking_options
        WHERE ranking_id = $1
        ORDER BY position
        LIMIT 5
      `,
      [rankingId],
    ),
  ]);
  const ranking = rankingRows[0];
  if (!ranking) return json(res, 404, { error: 'ranking_not_found' });

  const queries = rankingImageSearchQueries({ ...ranking, options: optionRows });
  const searches = await Promise.allSettled(queries.map(searchCommonsImages));
  const suggestions = [];
  const seen = new Set();
  for (const result of searches) {
    if (result.status !== 'fulfilled') continue;
    for (const suggestion of result.value) {
      if (seen.has(suggestion.imageUrl)) continue;
      seen.add(suggestion.imageUrl);
      suggestions.push(suggestion);
      if (suggestions.length >= RANKING_IMAGE_SUGGESTION_LIMIT) break;
    }
    if (suggestions.length >= RANKING_IMAGE_SUGGESTION_LIMIT) break;
  }

  return json(res, 200, {
    suggestions,
    brief: queries[0] || ranking.question,
    unavailable: searches.length > 0 && searches.every((result) => result.status === 'rejected'),
  });
}

async function updateRankingContent(req, res, body) {
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: 'authentication_required' });
  if (!isModerator(user)) return json(res, 403, { error: 'moderator_required' });

  const rankingId = String(body.rankingId || '').trim();
  const title = suggestionText(body.title, 8, SUGGESTION_TITLE_LIMIT);
  const submittedOptions = Array.isArray(body.options) ? body.options : null;
  if (!isValidRankingId(rankingId) || !title || !submittedOptions) {
    return json(res, 400, { error: 'invalid_ranking_content' });
  }

  const [rankingRows, optionRows] = await Promise.all([
    sql.query(
      `
        SELECT
          id,
          question,
          image_url AS "imageUrl",
          content_updated_at AS "contentUpdatedAt",
          is_vip AS "isVip",
          vip_password_hash AS "vipPasswordHash",
          vip_password_version AS "vipPasswordVersion",
          vip_owner_user_id AS "vipOwnerUserId"
        FROM rankings
        WHERE id = $1 AND is_active = true
        LIMIT 1
      `,
      [rankingId],
    ),
    sql.query(
      `
        SELECT id, label, position
        FROM ranking_options
        WHERE ranking_id = $1
        ORDER BY position
      `,
      [rankingId],
    ),
  ]);
  const ranking = rankingRows[0];
  if (!ranking) return json(res, 404, { error: 'ranking_not_found' });
  if (ranking.vipOwnerUserId) {
    return json(res, 403, { error: 'user_vip_ranking_managed_by_owner' });
  }
  if (submittedOptions.length !== optionRows.length) {
    return json(res, 409, { error: 'ranking_options_changed' });
  }

  const existingById = new Map(optionRows.map((option) => [Number(option.id), option]));
  const options = [];
  const normalizedLabels = new Set();
  for (const submitted of submittedOptions) {
    const id = Number(submitted?.id);
    const label = suggestionText(submitted?.label, 2, SUGGESTION_OPTION_LIMIT);
    const normalized = normalizeSuggestion(label);
    if (!Number.isSafeInteger(id) || !existingById.has(id) || !label || !normalized) {
      return json(res, 400, { error: 'invalid_ranking_options' });
    }
    if (normalizedLabels.has(normalized)) {
      return json(res, 409, { error: 'duplicate_ranking_option' });
    }
    normalizedLabels.add(normalized);
    options.push({ id, label, position: Number(existingById.get(id).position) });
  }
  if (new Set(options.map((option) => option.id)).size !== optionRows.length) {
    return json(res, 400, { error: 'invalid_ranking_options' });
  }

  if (Object.hasOwn(body, 'isVip') && typeof body.isVip !== 'boolean') {
    return json(res, 400, { error: 'invalid_vip_settings' });
  }
  const nextIsVip = Object.hasOwn(body, 'isVip') ? body.isVip === true : ranking.isVip === true;
  const rawVipPassword = Object.hasOwn(body, 'vipPassword')
    ? String(body.vipPassword || '')
        .normalize('NFKC')
        .trim()
    : '';
  const nextVipPassword = rawVipPassword ? vipPassword(rawVipPassword) : null;
  if (rawVipPassword && !nextVipPassword) {
    return json(res, 400, { error: 'invalid_vip_password' });
  }
  if (nextIsVip && !ranking.vipPasswordHash && !nextVipPassword) {
    return json(res, 400, { error: 'vip_password_required' });
  }
  const vipSettingsChanged = nextIsVip !== (ranking.isVip === true) || Boolean(nextVipPassword);
  const nextVipPasswordHash = nextIsVip
    ? nextVipPassword
      ? hashVipPassword(nextVipPassword)
      : ranking.vipPasswordHash
    : null;
  const nextVipPasswordVersion =
    Number(ranking.vipPasswordVersion || 0) + (vipSettingsChanged ? 1 : 0);

  let nextImageUrl = ranking.imageUrl || null;
  let uploadedImage = null;
  let replaceStoredImage = false;
  if (Object.hasOwn(body, 'imageData')) {
    uploadedImage = rankingImageUpload(body.imageData);
    if (!uploadedImage) return json(res, 400, { error: 'invalid_ranking_image' });
    const version = randomUUID();
    nextImageUrl = `/api?action=ranking-image&ranking_id=${encodeURIComponent(rankingId)}&v=${version}`;
    replaceStoredImage = true;
  } else if (Object.hasOwn(body, 'imageUrl')) {
    const rawImageUrl = String(body.imageUrl || '').trim();
    nextImageUrl = rawImageUrl ? publishedRankingImage(rawImageUrl) : null;
    if (rawImageUrl && !nextImageUrl) {
      return json(res, 400, { error: 'invalid_ranking_image_url' });
    }
    replaceStoredImage = true;
  }

  const sortedOptions = options.sort((a, b) => a.position - b.position);
  const beforeContent = {
    title: ranking.question,
    imageUrl: ranking.imageUrl || null,
    vip: ranking.isVip === true,
    vipHasPassword: Boolean(ranking.vipPasswordHash),
    options: optionRows.map((option) => ({ id: Number(option.id), label: option.label })),
  };
  const afterContent = {
    title,
    imageUrl: nextImageUrl,
    vip: nextIsVip,
    vipHasPassword: Boolean(nextVipPasswordHash),
    options: sortedOptions.map((option) => ({ id: option.id, label: option.label })),
  };
  const changedOptions = sortedOptions.filter(
    (option) => existingById.get(option.id).label !== option.label,
  );
  const changed =
    title !== ranking.question ||
    nextImageUrl !== (ranking.imageUrl || null) ||
    changedOptions.length ||
    vipSettingsChanged;
  if (!changed) {
    return json(res, 200, {
      ok: true,
      unchanged: true,
      ranking: {
        id: rankingId,
        q: title,
        img: resolveRankingCover(rankingId, nextImageUrl),
        opts: sortedOptions,
        vip: nextIsVip,
        vipHasPassword: Boolean(nextVipPasswordHash),
      },
    });
  }

  const queries = [
    sql.query(
      `
        UPDATE rankings
        SET
          question = $2,
          image_url = $3,
          is_vip = $4,
          vip_password_hash = $5,
          vip_password_version = $6,
          vip_updated_at = CASE WHEN $7::boolean THEN now() ELSE vip_updated_at END,
          content_updated_at = now()
        WHERE id = $1 AND is_active = true
      `,
      [
        rankingId,
        title,
        nextImageUrl,
        nextIsVip,
        nextVipPasswordHash,
        nextVipPasswordVersion,
        vipSettingsChanged,
      ],
    ),
  ];
  if (uploadedImage) {
    queries.push(
      sql.query(
        `
          INSERT INTO ranking_images (ranking_id, mime_type, image_data, updated_at)
          VALUES ($1, $2, $3, now())
          ON CONFLICT (ranking_id) DO UPDATE SET
            mime_type = EXCLUDED.mime_type,
            image_data = EXCLUDED.image_data,
            updated_at = now()
        `,
        [rankingId, uploadedImage.mimeType, uploadedImage.base64],
      ),
    );
  } else if (replaceStoredImage) {
    queries.push(sql.query('DELETE FROM ranking_images WHERE ranking_id = $1', [rankingId]));
  }
  for (const option of changedOptions) {
    queries.push(
      sql.query('UPDATE ranking_options SET label = $1 WHERE id = $2 AND ranking_id = $3', [
        option.label,
        option.id,
        rankingId,
      ]),
    );
  }
  queries.push(
    sql.query(
      `
        INSERT INTO ranking_content_edits (
          id, ranking_id, moderator_user_id, before_content, after_content
        )
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
      `,
      [
        randomUUID(),
        rankingId,
        user.id,
        JSON.stringify(beforeContent),
        JSON.stringify(afterContent),
      ],
    ),
  );

  await sql.transaction(queries, { isolationLevel: 'Serializable' });
  return json(res, 200, {
    ok: true,
    ranking: {
      id: rankingId,
      q: title,
      img: resolveRankingCover(rankingId, nextImageUrl),
      opts: sortedOptions,
      vip: nextIsVip,
      vipHasPassword: Boolean(nextVipPasswordHash),
      contentUpdatedAt: new Date().toISOString(),
    },
  });
}

async function moderationQueue(req, res) {
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: 'authentication_required' });
  if (!isModerator(user)) return json(res, 403, { error: 'moderator_required' });
  const [optionRows, rankingRows, rankingOptionRows, nameReportRows] = await Promise.all([
    sql.query(`
      SELECT
        s.id,
        'option'::text AS kind,
        s.ranking_id AS "rankingId",
        r.question,
        s.label,
        s.status,
        s.duplicate_option_id AS "duplicateOptionId",
        s.flag_reason AS "flagReason",
        s.moderation_note AS "moderationNote",
        s.created_at AS "createdAt",
        s.reviewed_at AS "reviewedAt",
        u.display_name AS "userName",
        u.email AS "userEmail"
      FROM ranking_option_suggestions s
      JOIN rankings r ON r.id = s.ranking_id
      JOIN users u ON u.id = s.user_id
      ORDER BY (s.status = 'pending') DESC, s.created_at DESC
      LIMIT 100
    `),
    sql.query(`
      SELECT
        s.id,
        'ranking'::text AS kind,
        s.title,
        s.category,
        s.example_options AS "exampleOptions",
        s.status,
        s.flag_reason AS "flagReason",
        s.moderation_note AS "moderationNote",
        s.created_at AS "createdAt",
        s.reviewed_at AS "reviewedAt",
        s.published_ranking_id AS "publishedRankingId",
        u.display_name AS "userName",
        u.email AS "userEmail"
      FROM ranking_topic_suggestions s
      JOIN users u ON u.id = s.user_id
      ORDER BY (s.status = 'pending') DESC, s.created_at DESC
      LIMIT 100
    `),
    sql.query(`
      SELECT
        id AS "optionId",
        ranking_id AS "rankingId",
        label,
        position
      FROM ranking_options
      ORDER BY ranking_id, position, id
    `),
    sql.query(`
      SELECT
        report.id,
        'name'::text AS kind,
        report.reported_user_id AS "reportedUserId",
        report.reported_name AS "reportedName",
        target.display_name AS "currentName",
        report.status,
        report.moderation_note AS "moderationNote",
        report.created_at AS "createdAt",
        report.reviewed_at AS "reviewedAt",
        reporter.display_name AS "userName",
        reporter.email AS "userEmail",
        COUNT(*) FILTER (WHERE related.status = 'pending')::int AS "pendingReports"
      FROM user_name_reports report
      JOIN users reporter ON reporter.id = report.reporter_user_id
      JOIN users target ON target.id = report.reported_user_id
      LEFT JOIN user_name_reports related
        ON related.reported_user_id = report.reported_user_id
       AND related.reported_name = report.reported_name
      GROUP BY report.id, target.display_name, reporter.display_name, reporter.email
      ORDER BY (report.status = 'pending') DESC, report.created_at DESC
      LIMIT 100
    `),
  ]);

  const optionsByRanking = new Map();
  for (const option of rankingOptionRows) {
    const options = optionsByRanking.get(option.rankingId) || [];
    options.push({ optionId: option.optionId, label: option.label });
    optionsByRanking.set(option.rankingId, options);
  }

  const optionSuggestions = optionRows.map((suggestion) => {
    const existingOptions = optionsByRanking.get(suggestion.rankingId) || [];
    return {
      ...suggestion,
      question: rankingQuestion(suggestion.rankingId, suggestion.question),
      existingOptions,
      possibleDuplicate:
        suggestion.status === 'pending'
          ? possibleOptionDuplicate(suggestion.label, existingOptions)
          : null,
    };
  });

  return json(res, 200, {
    moderator: { name: user.display_name, email: user.email },
    options: optionSuggestions,
    rankings: rankingRows,
    names: nameReportRows,
  });
}

async function moderationUsers(req, res) {
  const moderator = await sessionUser(req);
  if (!moderator) return json(res, 401, { error: 'authentication_required' });
  if (!isModerator(moderator)) return json(res, 403, { error: 'moderator_required' });

  const rows = await sql.query(`
    SELECT
      u.display_name AS name,
      u.email,
      u.created_at AS "createdAt",
      COUNT(history.option_id)::int AS votes,
      COUNT(DISTINCT option.ranking_id)::int AS rankings
    FROM users u
    LEFT JOIN user_vote_history history ON history.user_id = u.id
    LEFT JOIN ranking_options option ON option.id = history.option_id
    GROUP BY u.id
    ORDER BY u.created_at DESC, lower(u.display_name), lower(u.email)
  `);

  return json(res, 200, {
    moderator: { name: moderator.display_name, email: moderator.email },
    total: rows.length,
    users: rows.map((user) => ({
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      votes: Number(user.votes || 0),
      rankings: Number(user.rankings || 0),
      isModerator: isModerator({ email: user.email }),
    })),
  });
}

async function moderationRankings(req, res) {
  const moderator = await sessionUser(req);
  if (!moderator) return json(res, 401, { error: 'authentication_required' });
  if (!isModerator(moderator)) return json(res, 403, { error: 'moderator_required' });

  const rows = await sql.query(`
    SELECT
      ranking.id,
      ranking.question,
      ranking.category,
      ranking.image_url AS "imageUrl",
      (
        ranking.baseline_votes
        + COUNT(vote.option_id)
      )::bigint AS votes,
      COUNT(vote.option_id) FILTER (
        WHERE vote.updated_at >= date_trunc('day', now())
      )::int AS "todayVotes"
    FROM rankings ranking
    LEFT JOIN ranking_options option ON option.ranking_id = ranking.id
    LEFT JOIN votes vote ON vote.option_id = option.id
    WHERE ranking.is_active = true
      AND ranking.is_vip = false
    GROUP BY
      ranking.id,
      ranking.question,
      ranking.category,
      ranking.image_url,
      ranking.baseline_votes
    ORDER BY votes DESC, lower(ranking.question), ranking.id
  `);

  const rankings = rows.map((ranking, index) => ({
    id: ranking.id,
    position: index + 1,
    question: rankingQuestion(ranking.id, ranking.question),
    category: ranking.category,
    imageUrl: resolveRankingCover(ranking.id, ranking.imageUrl),
    votes: Number(ranking.votes || 0),
    todayVotes: Number(ranking.todayVotes || 0),
  }));

  return json(res, 200, {
    moderator: { name: moderator.display_name, email: moderator.email },
    total: rankings.length,
    totalVotes: rankings.reduce((total, ranking) => total + ranking.votes, 0),
    rankings,
  });
}

async function moderateNameReport(res, moderator, id, decision, moderationNote) {
  const [report] = await sql.query(
    `
    SELECT
      id,
      reported_user_id AS "reportedUserId",
      reported_name AS "reportedName",
      status
    FROM user_name_reports
    WHERE id = $1::uuid
    LIMIT 1
  `,
    [id],
  );
  if (!report || report.status !== 'pending') {
    return json(res, 409, { error: 'name_report_already_reviewed' });
  }

  if (decision === 'dismiss') {
    await sql.query(
      `
      UPDATE user_name_reports
      SET status = 'dismissed',
          reviewed_by = $3,
          moderation_note = $4,
          reviewed_at = now()
      WHERE reported_user_id = $1
        AND reported_name = $2
        AND status = 'pending'
    `,
      [report.reportedUserId, report.reportedName, moderator.id, moderationNote],
    );
    return json(res, 200, { ok: true, decision });
  }

  const replacementName = defaultDisplayName(report.reportedUserId);
  const rows = await sql.query(
    `
    WITH changed_user AS (
      UPDATE users
      SET display_name = $3,
          display_name_updated_at = NULL
      WHERE id = $1
        AND display_name = $2
      RETURNING id
    )
    UPDATE user_name_reports
    SET status = CASE
          WHEN EXISTS (SELECT 1 FROM changed_user) THEN 'removed'
          ELSE 'dismissed'
        END,
        reviewed_by = $4,
        moderation_note = CASE
          WHEN EXISTS (SELECT 1 FROM changed_user) THEN $5
          ELSE COALESCE($5, 'O nome já havia sido alterado.')
        END,
        reviewed_at = now()
    WHERE reported_user_id = $1
      AND reported_name = $2
      AND status = 'pending'
    RETURNING status
  `,
    [report.reportedUserId, report.reportedName, replacementName, moderator.id, moderationNote],
  );

  return json(res, 200, {
    ok: true,
    decision: rows.some((row) => row.status === 'removed') ? 'remove' : 'dismiss',
    replacementName,
  });
}

async function publishRankingSuggestion(res, user, body, id, moderationNote) {
  const title = suggestionText(body.title, 8, SUGGESTION_TITLE_LIMIT);
  const normalizedTitle = normalizeSuggestion(title);
  const category = suggestionText(body.category, 2, 50);
  const options = publishedRankingOptions(body.options);
  const imageUrl = publishedRankingImage(body.imageUrl);
  if (
    !title ||
    !normalizedTitle ||
    !category ||
    !SUGGESTION_CATEGORIES.has(category) ||
    !options ||
    options.length !== GENERAL_PUBLIC_OPTION_COUNT
  ) {
    return json(res, 400, { error: 'invalid_published_ranking' });
  }
  if (imageUrl === null) {
    return json(res, 400, { error: 'invalid_image_url' });
  }

  const [suggestion] = await sql.query(
    `
    SELECT id, status
    FROM ranking_topic_suggestions
    WHERE id = $1::uuid
    LIMIT 1
  `,
    [id],
  );
  if (!suggestion) return json(res, 404, { error: 'suggestion_not_found' });
  if (suggestion.status !== 'approved') {
    return json(res, 409, { error: 'suggestion_already_reviewed' });
  }

  const existingRankings = await sql.query(`
    SELECT id, question
    FROM rankings
  `);
  if (
    existingRankings.some(
      (ranking) =>
        normalizeSuggestion(rankingQuestion(ranking.id, ranking.question)) === normalizedTitle,
    )
  ) {
    return json(res, 409, { error: 'ranking_already_exists' });
  }

  const baseSlug = publishedRankingSlug(title);
  if (!baseSlug) return json(res, 400, { error: 'invalid_published_ranking' });
  const matchingIds = new Set(
    (
      await sql.query(
        `
    SELECT id
    FROM rankings
    WHERE id = $1 OR id LIKE $2
  `,
        [baseSlug, `${baseSlug}-%`],
      )
    ).map((row) => row.id),
  );
  let rankingId = baseSlug;
  for (let suffix = 2; matchingIds.has(rankingId); suffix += 1) {
    rankingId = `${baseSlug}-${suffix}`;
  }

  const optionsJson = JSON.stringify(options);
  let transactionResults;
  try {
    transactionResults = await sql.transaction(
      [
        sql.query(
          `
        INSERT INTO rankings (
          id,
          category,
          question,
          image_url,
          baseline_votes,
          is_active,
          created_at
        )
        SELECT $2, $3, $4, $5, 0, true, now()
        FROM ranking_topic_suggestions
        WHERE id = $1::uuid AND status = 'approved'
        RETURNING id
      `,
          [id, rankingId, category, title, imageUrl || null],
        ),
        sql.query(
          `
        INSERT INTO ranking_options (ranking_id, label, position, baseline_score)
        SELECT
          $2,
          option.value,
          option.ordinality::int,
          0
        FROM jsonb_array_elements_text($3::jsonb)
          WITH ORDINALITY AS option(value, ordinality)
        WHERE EXISTS (
          SELECT 1
          FROM ranking_topic_suggestions
          WHERE id = $1::uuid AND status = 'approved'
        )
        RETURNING id
      `,
          [id, rankingId, optionsJson],
        ),
        sql.query(
          `
        UPDATE ranking_topic_suggestions
        SET title = $3,
            normalized_title = $4,
            category = $5,
            example_options = $6::jsonb,
            status = 'published',
            published_ranking_id = $7,
            reviewed_by = $2,
            moderation_note = COALESCE($8, moderation_note),
            reviewed_at = now()
        WHERE id = $1::uuid AND status = 'approved'
        RETURNING id, status, published_ranking_id AS "publishedRankingId"
      `,
          [id, user.id, title, normalizedTitle, category, optionsJson, rankingId, moderationNote],
        ),
      ],
      { isolationLevel: 'Serializable' },
    );
  } catch (error) {
    if (error?.code === '23505') {
      return json(res, 409, { error: 'ranking_already_exists' });
    }
    throw error;
  }

  const published = transactionResults?.[2]?.[0];
  if (!published) {
    return json(res, 409, { error: 'suggestion_already_reviewed' });
  }
  return json(res, 200, {
    ok: true,
    rankingId,
    suggestion: published,
  });
}

async function moderateSuggestion(req, res, body) {
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: 'authentication_required' });
  if (!isModerator(user)) return json(res, 403, { error: 'moderator_required' });
  const id = String(body.id || '');
  const kind = String(body.kind || '');
  const decision = String(body.decision || '');
  const moderationNote = suggestionText(String(body.note || ''), 1, 300) || null;
  const validDecision =
    ((kind === 'option' || kind === 'ranking') && ['approve', 'reject'].includes(decision)) ||
    (kind === 'ranking' && decision === 'publish') ||
    (kind === 'option' && decision === 'duplicate') ||
    (kind === 'name' && ['remove', 'dismiss'].includes(decision));
  const duplicateOptionId = String(body.duplicateOptionId || '');
  const hasCorrectedLabel = Object.prototype.hasOwnProperty.call(body, 'label');
  const correctedLabel = hasCorrectedLabel
    ? suggestionText(body.label, 2, SUGGESTION_OPTION_LIMIT)
    : null;
  const approvedRankingTitle =
    kind === 'ranking' && decision === 'approve'
      ? suggestionText(body.title, 8, SUGGESTION_TITLE_LIMIT)
      : null;
  const approvedRankingCategory =
    kind === 'ranking' && decision === 'approve' ? suggestionText(body.category, 2, 50) : null;
  if (
    !/^[0-9a-f-]{36}$/i.test(id) ||
    !['option', 'ranking', 'name'].includes(kind) ||
    !validDecision ||
    (kind === 'option' && decision === 'duplicate' && !/^\d+$/.test(duplicateOptionId)) ||
    (kind === 'option' && decision === 'approve' && hasCorrectedLabel && !correctedLabel) ||
    (kind === 'ranking' &&
      decision === 'approve' &&
      (!approvedRankingTitle ||
        !approvedRankingCategory ||
        !SUGGESTION_CATEGORIES.has(approvedRankingCategory)))
  ) {
    return json(res, 400, { error: 'invalid_moderation' });
  }

  if (kind === 'name') {
    return moderateNameReport(res, user, id, decision, moderationNote);
  }

  if (kind === 'ranking' && decision === 'publish') {
    return publishRankingSuggestion(res, user, body, id, moderationNote);
  }

  let rows;
  if (kind === 'ranking' && decision === 'approve') {
    const normalizedTitle = normalizeSuggestion(approvedRankingTitle);
    const [existingRanking, existingSuggestion] = await Promise.all([
      sql.query(`
        SELECT id, question
        FROM rankings
      `),
      sql.query(
        `
        SELECT id, title, status
        FROM ranking_topic_suggestions
        WHERE id <> $1::uuid
          AND normalized_title = $2
          AND status IN ('pending', 'approved', 'published')
        LIMIT 1
      `,
        [id, normalizedTitle],
      ),
    ]);
    if (
      existingRanking.some(
        (ranking) =>
          normalizeSuggestion(rankingQuestion(ranking.id, ranking.question)) === normalizedTitle,
      ) ||
      existingSuggestion.length
    ) {
      return json(res, 409, { error: 'ranking_already_exists' });
    }
    rows = await sql.query(
      `
      UPDATE ranking_topic_suggestions
      SET title = $3,
          normalized_title = $4,
          category = $5,
          status = 'approved',
          reviewed_by = $2,
          moderation_note = $6,
          reviewed_at = now()
      WHERE id = $1::uuid AND status = 'pending'
      RETURNING id, title, category, status
    `,
      [id, user.id, approvedRankingTitle, normalizedTitle, approvedRankingCategory, moderationNote],
    );
  } else if (kind === 'option' && decision === 'approve') {
    const [suggestion] = await sql.query(
      `
      SELECT id, ranking_id AS "rankingId", label, status
      FROM ranking_option_suggestions
      WHERE id = $1::uuid
      LIMIT 1
    `,
      [id],
    );
    if (!suggestion || suggestion.status !== 'pending') {
      return json(res, 409, { error: 'suggestion_already_reviewed' });
    }

    const finalLabel = correctedLabel || suggestion.label;
    const normalizedLabel = normalizeSuggestion(finalLabel);
    const existingOptions = await sql.query(
      `
      SELECT id, label
      FROM ranking_options
      WHERE ranking_id = $1
      ORDER BY position, id
    `,
      [suggestion.rankingId],
    );
    const exactMatch = existingOptions.find(
      (option) => normalizeSuggestion(option.label) === normalizedLabel,
    );
    if (exactMatch) {
      return json(res, 409, {
        error: 'option_already_exists',
        option: { optionId: exactMatch.id, label: exactMatch.label },
      });
    }

    try {
      rows = await sql.query(
        `
      WITH selected AS (
        SELECT id, ranking_id
        FROM ranking_option_suggestions
        WHERE id = $1::uuid AND status = 'pending'
        FOR UPDATE
      ),
      positioned AS (
        SELECT
          selected.id,
          selected.ranking_id,
          COALESCE(MAX(ranking_options.position), 0) + 1 AS next_position
        FROM selected
        LEFT JOIN ranking_options
          ON ranking_options.ranking_id = selected.ranking_id
        GROUP BY selected.id, selected.ranking_id
      ),
      existing AS (
        SELECT ranking_options.id
        FROM ranking_options
        JOIN selected ON selected.ranking_id = ranking_options.ranking_id
        WHERE lower(regexp_replace(btrim(ranking_options.label), '\\s+', ' ', 'g')) =
              lower(regexp_replace(btrim($4::text), '\\s+', ' ', 'g'))
        ORDER BY ranking_options.position, ranking_options.id
        LIMIT 1
      ),
      inserted AS (
        INSERT INTO ranking_options (ranking_id, label, position, baseline_score)
        SELECT ranking_id, $4, next_position, 0
        FROM positioned
        WHERE NOT EXISTS (SELECT 1 FROM existing)
        RETURNING id
      )
      UPDATE ranking_option_suggestions suggestion
      SET label = $4,
          normalized_label = $5,
          status = 'approved',
          approved_option_id = (SELECT id FROM inserted),
          reviewed_by = $2,
          moderation_note = $3,
          reviewed_at = now()
      FROM selected
      WHERE suggestion.id = selected.id
        AND EXISTS (SELECT 1 FROM inserted)
      RETURNING
        suggestion.id,
        suggestion.label,
        suggestion.status,
        suggestion.approved_option_id AS "optionId"
      `,
        [id, user.id, moderationNote, finalLabel, normalizedLabel],
      );
    } catch (error) {
      if (error?.code === '23505') {
        return json(res, 409, { error: 'suggestion_already_pending' });
      }
      throw error;
    }
    if (!rows[0]) {
      const refreshedOptions = await sql.query(
        `
        SELECT id, label
        FROM ranking_options
        WHERE ranking_id = $1
      `,
        [suggestion.rankingId],
      );
      const refreshedMatch = refreshedOptions.find(
        (option) => normalizeSuggestion(option.label) === normalizedLabel,
      );
      if (refreshedMatch) {
        return json(res, 409, {
          error: 'option_already_exists',
          option: { optionId: refreshedMatch.id, label: refreshedMatch.label },
        });
      }
    }
  } else if (kind === 'option' && decision === 'duplicate') {
    rows = await sql.query(
      `
      UPDATE ranking_option_suggestions suggestion
      SET status = 'duplicate',
          duplicate_option_id = existing.id,
          reviewed_by = $2,
          moderation_note = COALESCE(
            $4,
            'Já existe no ranking como “' || existing.label || '”.'
          ),
          reviewed_at = now()
      FROM ranking_options existing
      WHERE suggestion.id = $1::uuid
        AND suggestion.status = 'pending'
        AND existing.id = $3::bigint
        AND existing.ranking_id = suggestion.ranking_id
      RETURNING
        suggestion.id,
        suggestion.status,
        suggestion.duplicate_option_id AS "duplicateOptionId",
        existing.label AS "duplicateOptionLabel"
    `,
      [id, user.id, duplicateOptionId, moderationNote],
    );
  } else if (kind === 'option') {
    rows = await sql.query(
      `
      UPDATE ranking_option_suggestions
      SET status = 'rejected',
          reviewed_by = $2,
          moderation_note = $3,
          reviewed_at = now()
      WHERE id = $1::uuid AND status = 'pending'
      RETURNING id, status
    `,
      [id, user.id, moderationNote],
    );
  } else {
    rows = await sql.query(
      `
      UPDATE ranking_topic_suggestions
      SET status = 'rejected',
          reviewed_by = $2,
          moderation_note = $3,
          reviewed_at = now()
      WHERE id = $1::uuid AND status = 'pending'
      RETURNING id, status
    `,
      [id, user.id, moderationNote],
    );
  }

  if (!rows[0]) return json(res, 409, { error: 'suggestion_already_reviewed' });
  return json(res, 200, { ok: true, suggestion: rows[0] });
}

async function rankingVotingContext(req, res, deviceId, rankingId, write = false) {
  if (!isValidDevice(deviceId) || !isValidRankingId(rankingId)) {
    json(res, 400, { error: 'invalid_ranking_vote_mode' });
    return null;
  }

  const user = await sessionUser(req);
  if (user && !(await ensureSessionDevice(user, deviceId))) {
    json(res, 409, { error: 'device_rekey_required' });
    return null;
  }

  const [ranking] = await sql.query(
    `
    SELECT
      id,
      is_vip AS "isVip",
      vip_voting_open AS "vipVotingOpen",
      vip_password_version AS "vipPasswordVersion",
      vip_owner_user_id AS "vipOwnerUserId"
    FROM rankings
    WHERE id = $1
      AND is_active = true
    LIMIT 1
  `,
    [rankingId],
  );

  if (!ranking) {
    json(res, 404, { error: 'ranking_not_found' });
    return null;
  }
  if (write && !user && (await deviceAccountId(deviceId)) && ranking.isVip !== true) {
    json(res, 403, { error: 'account_required_on_this_device' });
    return null;
  }
  if (!hasVipAccess(req, user, ranking)) {
    json(res, 403, { error: 'vip_password_required' });
    return null;
  }
  if (write && ranking.isVip === true && ranking.vipVotingOpen === false) {
    json(res, 409, { error: 'ranking_voting_closed' });
    return null;
  }

  return { user, ranking };
}

async function rankingVotingModeState(rankingId, user, deviceId, votingOpen = true) {
  const userId = user?.id || null;
  const ownerSeed = userId ? `user:${userId}` : `device:${deviceId}`;
  const sessionOwnerClause = `(
    ($2::uuid IS NOT NULL AND session.user_id = $2::uuid)
    OR (
      $2::uuid IS NULL
      AND session.user_id IS NULL
      AND session.device_id = $3
    )
  )`;

  const sessionQuery = sql.query(
    `
    SELECT
      session.id AS "sessionId",
      session.champion_option_id AS "championOptionId",
      champion.label AS "championLabel",
      session.pot,
      session.completed,
      (
        SELECT COUNT(*)::int
        FROM ranking_duel_rounds round
        WHERE round.session_id = session.id
          AND round.skipped = false
      ) AS "myDuels",
      (
        SELECT COUNT(DISTINCT entry.option_id)::int
        FROM ranking_duel_rounds round
        JOIN ranking_duel_entries entry ON entry.round_id = round.id
        WHERE round.session_id = session.id
      ) AS "seenOptions"
    FROM ranking_duel_sessions session
    LEFT JOIN ranking_options champion
      ON champion.ranking_id = session.ranking_id
     AND champion.id = session.champion_option_id
    WHERE session.ranking_id = $1
      AND ${sessionOwnerClause}
    LIMIT 1
  `,
    [rankingId, userId, deviceId],
  );
  const pairQuery = votingOpen
    ? sql.query(
        `
        WITH viewer_session AS (
          SELECT
            session.id,
            session.champion_option_id,
            session.pot,
            session.completed,
            session.order_seed
          FROM ranking_duel_sessions session
          WHERE session.ranking_id = $1
            AND ${sessionOwnerClause}
          LIMIT 1
        ),
        seen AS (
          SELECT DISTINCT entry.option_id
          FROM viewer_session session
          JOIN ranking_duel_rounds round ON round.session_id = session.id
          JOIN ranking_duel_entries entry ON entry.round_id = round.id
        ),
        incumbent AS (
          SELECT
            option.id AS "optionId",
            option.label,
            0::int AS "roleOrder",
            'incumbent'::text AS role,
            ''::text AS "randomOrder"
          FROM viewer_session session
          JOIN ranking_options option
            ON option.ranking_id = $1
           AND option.id = session.champion_option_id
          WHERE session.completed = false
        ),
        candidate_pool AS (
          SELECT
            option.id AS "optionId",
            option.label,
            1::int AS "roleOrder",
            CASE
              WHEN (SELECT champion_option_id FROM viewer_session) IS NULL THEN 'starter'
              ELSE 'challenger'
            END::text AS role,
            md5(
              COALESCE((SELECT order_seed FROM viewer_session), $4)
              || ':' || option.id::text
            ) AS "randomOrder"
          FROM ranking_options option
          WHERE option.ranking_id = $1
            AND COALESCE((SELECT completed FROM viewer_session), false) = false
            AND NOT EXISTS (SELECT 1 FROM seen WHERE seen.option_id = option.id)
          ORDER BY
            "randomOrder",
            option.position
          LIMIT COALESCE(
            (SELECT CASE WHEN champion_option_id IS NULL THEN 2 ELSE 1 END FROM viewer_session),
            2
          )
        )
        SELECT
          pair."optionId", pair.label, pair.role
        FROM (
          SELECT * FROM incumbent
          UNION ALL
          SELECT * FROM candidate_pool
        ) pair
        ORDER BY pair."roleOrder", pair."randomOrder", pair."optionId"
      `,
        [rankingId, userId, deviceId, ownerSeed],
      )
    : Promise.resolve([]);
  const summaryQuery = sql.query(
    `
    SELECT
      (
        SELECT COUNT(*)::int
        FROM ranking_duel_rounds round
        WHERE round.ranking_id = $1
          AND round.session_id IS NOT NULL
          AND round.skipped = false
      ) AS "totalDuels",
      (
        SELECT COUNT(*)::int
        FROM ranking_options option
        WHERE option.ranking_id = $1
      ) AS "totalOptions"
  `,
    [rankingId],
  );

  const [sessionRows, pairRows, summaryRows] = await Promise.all([
    sessionQuery,
    pairQuery,
    summaryQuery,
  ]);
  const summary = summaryRows[0] || {},
    session = sessionRows[0] || {};

  return {
    duel: {
      pair:
        pairRows.length === 2
          ? pairRows.map((row) => ({
              optionId: Number(row.optionId),
              label: row.label,
              role: row.role,
            }))
          : [],
      sessionId: session.sessionId || null,
      champion: session.championOptionId
        ? {
            optionId: Number(session.championOptionId),
            label: session.championLabel,
          }
        : null,
      pot: Number(session.pot || 0),
      completed: session.completed === true,
      totalDuels: Number(summary.totalDuels || 0),
      myDuels: Number(session.myDuels || 0),
      seenOptions: Number(session.seenOptions || 0),
      totalOptions: Number(summary.totalOptions || 0),
    },
  };
}

async function rankingVotingModes(req, res) {
  const deviceId = queryValue(req, 'device_id');
  const rankingId = queryValue(req, 'ranking_id').trim();
  const context = await rankingVotingContext(req, res, deviceId, rankingId);
  if (!context) return;

  const votingOpen = context.ranking.isVip !== true || context.ranking.vipVotingOpen !== false;
  const [modes, currentViewer] = await Promise.all([
    rankingVotingModeState(rankingId, context.user, deviceId, votingOpen),
    viewerFor(context.user, deviceId, false, context.ranking.isVip === true),
  ]);

  return json(res, 200, { ok: true, votingOpen, ...modes, viewer: currentViewer });
}

async function resetDuel(req, res, body) {
  const deviceId = String(body.device_id || '');
  const rankingId = String(body.ranking_id || '').trim();
  const context = await rankingVotingContext(req, res, deviceId, rankingId, true);
  if (!context) return;

  const userId = context.user?.id || null;
  const ownerKey = userId ? `user:${userId}` : `device:${deviceId}`;
  if (!context.user && context.ranking.isVip !== true) {
    const participation = await anonymousParticipation(deviceId);
    const reason = anonymousRegistrationReason(participation, true);
    if (reason) {
      return registrationRequired(res, context.user, deviceId, false, reason);
    }
  }
  const deleteSession = userId
    ? sql.query(
        `
          DELETE FROM ranking_duel_sessions session
          WHERE session.ranking_id = $1
            AND session.user_id = $2::uuid
            AND session.completed = true
          RETURNING session.id
        `,
        [rankingId, userId],
      )
    : sql.query(
        `
          DELETE FROM ranking_duel_sessions session
          WHERE session.ranking_id = $1
            AND session.user_id IS NULL
            AND session.device_id = $2
            AND session.completed = true
          RETURNING session.id
        `,
        [rankingId, deviceId],
      );
  const transaction = await sql.transaction([
    sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 37))', [
      `${rankingId}:${ownerKey}`,
    ]),
    deleteSession,
  ]);

  if (!transaction[1]?.[0]) {
    const modes = await rankingVotingModeState(rankingId, context.user, deviceId, true);
    return json(res, 409, {
      error: modes.duel.sessionId ? 'duel_not_completed' : 'duel_not_found',
      ...modes,
    });
  }

  return json(res, 200, {
    ok: true,
    duelReset: true,
    viewer: await viewerFor(context.user, deviceId, false, context.ranking.isVip === true),
  });
}

async function saveTop3(req, res, body) {
  const deviceId = String(body.device_id || '');
  const rankingId = String(body.ranking_id || '').trim();
  const optionIds = [
    ...new Set((Array.isArray(body.option_ids) ? body.option_ids : []).map(Number)),
  ];
  if (optionIds.length !== 3 || optionIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    return json(res, 400, { error: 'top3_requires_three_options' });
  }

  const context = await rankingVotingContext(req, res, deviceId, rankingId, true);
  if (!context) return;
  const userId = context.user?.id || null;
  const ownerKey = userId ? `user:${userId}` : `device:${deviceId}`;
  const currentSelectionQuery = userId
    ? sql.query(
        `SELECT COUNT(*)::int AS total FROM ranking_top3_selections
         WHERE ranking_id = $1 AND user_id = $2`,
        [rankingId, userId],
      )
    : sql.query(
        `SELECT COUNT(*)::int AS total FROM ranking_top3_selections
         WHERE ranking_id = $1 AND user_id IS NULL AND device_id = $2`,
        [rankingId, deviceId],
      );
  const [validOptions, currentSelections] = await Promise.all([
    sql.query(
      `
      SELECT COUNT(*)::int AS total
      FROM ranking_options
      WHERE ranking_id = $1
        AND id = ANY($2::bigint[])
    `,
      [rankingId, optionIds],
    ),
    currentSelectionQuery,
  ]);
  if (Number(validOptions[0]?.total || 0) !== 3) {
    return json(res, 400, { error: 'invalid_top3_options' });
  }

  const hadBallot = Number(currentSelections[0]?.total || 0) > 0;
  const consumesAnonymousVote = !context.user && context.ranking.isVip !== true && !hadBallot;
  if (consumesAnonymousVote) {
    const participation = await anonymousParticipation(deviceId);
    const reason = anonymousRegistrationReason(participation);
    if (reason) {
      return registrationRequired(res, context.user, deviceId, false, reason);
    }
  }

  const statements = [
    sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 31))', [
      `${rankingId}:${ownerKey}`,
    ]),
  ];
  if (consumesAnonymousVote) {
    statements.push(
      sql.query(
        `
        INSERT INTO anonymous_vote_usage (device_id, votes_used, updated_at)
        SELECT $1, 1, now()
        WHERE NOT EXISTS (
          SELECT 1
          FROM ranking_top3_selections
          WHERE ranking_id = $2
            AND user_id IS NULL
            AND device_id = $1
        )
        ON CONFLICT (device_id)
        DO UPDATE SET
          votes_used = anonymous_vote_usage.votes_used + 1,
          updated_at = now()
      `,
        [deviceId, rankingId],
      ),
    );
  }
  if (userId) {
    statements.push(
      sql.query('DELETE FROM ranking_top3_selections WHERE ranking_id = $1 AND user_id = $2', [
        rankingId,
        userId,
      ]),
    );
  } else {
    statements.push(
      sql.query(
        `DELETE FROM ranking_top3_selections
         WHERE ranking_id = $1 AND user_id IS NULL AND device_id = $2`,
        [rankingId, deviceId],
      ),
    );
  }
  statements.push(
    sql.query(
      `
      INSERT INTO ranking_top3_selections (
        ranking_id,
        option_id,
        device_id,
        user_id,
        created_at,
        updated_at
      )
      SELECT $1, selected.option_id, $2, $3::uuid, now(), now()
      FROM unnest($4::bigint[]) AS selected(option_id)
    `,
      [rankingId, deviceId, userId, optionIds],
    ),
  );
  await sql.transaction(statements);

  const [modes, currentViewer] = await Promise.all([
    rankingVotingModeState(rankingId, context.user, deviceId, true),
    viewerFor(context.user, deviceId, false, context.ranking.isVip === true),
  ]);
  return json(res, 200, { ok: true, ...modes, viewer: currentViewer });
}

async function saveDuel(req, res, body) {
  const deviceId = String(body.device_id || '');
  const rankingId = String(body.ranking_id || '').trim();
  const referralToken = String(body.referral_token || '');
  const optionIds = [
    ...new Set((Array.isArray(body.option_ids) ? body.option_ids : []).map(Number)),
  ];
  const winnerOptionId = body.winner_option_id == null ? null : Number(body.winner_option_id);
  if (
    optionIds.length !== 2 ||
    optionIds.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
    (winnerOptionId !== null && !optionIds.includes(winnerOptionId))
  ) {
    return json(res, 400, { error: 'invalid_duel' });
  }

  const context = await rankingVotingContext(req, res, deviceId, rankingId, true);
  if (!context) return;
  const userId = context.user?.id || null;
  const ownerKey = userId ? `user:${userId}` : `device:${deviceId}`;
  const modesBefore = await rankingVotingModeState(rankingId, context.user, deviceId, true);
  const expectedOptionIds = (modesBefore.duel.pair || [])
    .map((option) => Number(option.optionId))
    .sort((a, b) => a - b);
  const submittedOptionIds = [...optionIds].sort((a, b) => a - b);
  if (
    expectedOptionIds.length !== 2 ||
    submittedOptionIds.some((optionId, index) => optionId !== expectedOptionIds[index])
  ) {
    return json(res, 409, { error: 'duel_state_changed', ...modesBefore });
  }

  const skipped = winnerOptionId === null;
  const orderBefore = skipped ? '' : await rankingOrderSignature(rankingId);
  const tracksAnonymousDuel = !context.user && context.ranking.isVip !== true;
  if (tracksAnonymousDuel && !modesBefore.duel.sessionId) {
    const participation = await anonymousParticipation(deviceId);
    const reason = anonymousRegistrationReason(participation, true);
    if (reason) {
      return registrationRequired(res, context.user, deviceId, false, reason);
    }
  }

  const roundId = randomUUID(),
    sessionId = modesBefore.duel.sessionId || randomUUID(),
    championBeforeOptionId = modesBefore.duel.champion?.optionId || null,
    potBefore = Number(modesBefore.duel.pot || 0),
    championAfterOptionId = skipped ? championBeforeOptionId : winnerOptionId,
    potAfter = skipped ? potBefore : potBefore + 1;
  const statements = [
    sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 37))', [
      `${rankingId}:${ownerKey}`,
    ]),
  ];
  if (!modesBefore.duel.sessionId) {
    statements.push(
      sql.query(
        `
        INSERT INTO ranking_duel_sessions (
          id,
          ranking_id,
          device_id,
          user_id,
          order_seed,
          champion_option_id,
          pot,
          completed,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4::uuid, $5, NULL, 0, false, now(), now())
      `,
        [sessionId, rankingId, deviceId, userId, ownerKey],
      ),
    );
  }
  statements.push(
    sql.query(
      `
      INSERT INTO ranking_duel_rounds (
        id,
        ranking_id,
        device_id,
        user_id,
        skipped,
        session_id,
        pot_before,
        pot_after,
        champion_before_option_id,
        champion_after_option_id,
        created_at
      )
      VALUES ($1, $2, $3, $4::uuid, $5, $6, $7, $8, $9, $10, now())
    `,
      [
        roundId,
        rankingId,
        deviceId,
        userId,
        skipped,
        sessionId,
        potBefore,
        potAfter,
        championBeforeOptionId,
        championAfterOptionId,
      ],
    ),
    sql.query(
      `
      INSERT INTO ranking_duel_entries (
        round_id,
        ranking_id,
        option_id,
        device_id,
        user_id,
        won,
        created_at
      )
      SELECT
        $1,
        $2,
        option.option_id,
        $3,
        $4::uuid,
        CASE
          WHEN $5::bigint IS NULL THEN NULL
          ELSE option.option_id = $5::bigint
        END,
        now()
      FROM unnest($6::bigint[]) AS option(option_id)
    `,
      [roundId, rankingId, deviceId, userId, winnerOptionId, optionIds],
    ),
    sql.query(
      `
      WITH updated_session AS (
        UPDATE ranking_duel_sessions session
        SET
          champion_option_id = $2::bigint,
          pot = $3,
          completed = (
            SELECT CASE
              WHEN $2::bigint IS NULL THEN COUNT(*) < 2
              ELSE COUNT(*) < 1
            END
            FROM ranking_options option
            WHERE option.ranking_id = $4
              AND NOT EXISTS (
                SELECT 1
                FROM ranking_duel_rounds round
                JOIN ranking_duel_entries entry ON entry.round_id = round.id
                WHERE round.session_id = session.id
                  AND entry.option_id = option.id
              )
          ),
          updated_at = now()
        WHERE session.id = $1
        RETURNING completed
      ),
      tracked_completion AS (
        INSERT INTO anonymous_duel_usage (device_id, duels_completed, updated_at)
        SELECT $5, 1, now()
        FROM updated_session
        WHERE $6::boolean = true
          AND completed = true
        ON CONFLICT (device_id)
        DO UPDATE SET
          duels_completed = anonymous_duel_usage.duels_completed + 1,
          updated_at = now()
        RETURNING duels_completed
      )
      SELECT completed FROM updated_session
    `,
      [sessionId, championAfterOptionId, potAfter, rankingId, deviceId, tracksAnonymousDuel],
    ),
  );
  if (userId && !skipped) {
    statements.push(
      ...scoreParticipationQueries(sql, {
        userId,
        rankingId,
        duelSessionId: sessionId,
      }),
    );
  }

  try {
    await sql.transaction(statements);
  } catch (error) {
    if (error?.code !== '23505') throw error;
    const modes = await rankingVotingModeState(rankingId, context.user, deviceId, true);
    return json(res, 409, { error: 'duel_state_changed', ...modes });
  }

  if (!skipped && referralToken) {
    try {
      await qualifyRankingShare(sql, {
        token: referralToken,
        rankingId,
        voterUserId: userId,
        deviceId,
      });
    } catch (error) {
      console.error('TOPO ranking share qualification error', error);
    }
  }

  const [modes, currentViewer, scoreUpdate, orderAfter] = await Promise.all([
    rankingVotingModeState(rankingId, context.user, deviceId, true),
    viewerFor(context.user, deviceId, false, context.ranking.isVip === true),
    winnerOptionId ? officialOptionState(winnerOptionId) : Promise.resolve(null),
    skipped ? Promise.resolve('') : rankingOrderSignature(rankingId),
  ]);
  if (orderBefore && orderAfter && orderBefore !== orderAfter) {
    try {
      await queueRankingChangeNotifications(rankingId, userId);
    } catch (error) {
      console.error('TOPO duel notification update error', error);
    }
  }
  return json(res, 200, { ok: true, ...modes, scoreUpdate, viewer: currentViewer });
}

async function vote(req, res, body) {
  const deviceId = String(body.device_id || '');
  const optionId = Number(body.option_id);
  const direction = Number(body.direction);
  const requestedWeight = body.weight === undefined ? 1 : Number(body.weight);
  const referralToken = String(body.referral_token || '');

  if (
    !isValidDevice(deviceId) ||
    !Number.isSafeInteger(optionId) ||
    optionId <= 0 ||
    ![-1, 0, 1].includes(direction) ||
    ![1, 2].includes(requestedWeight) ||
    (direction === 0 && requestedWeight !== 1)
  ) {
    return json(res, 400, { error: 'invalid_vote' });
  }

  const user = await sessionUser(req);

  if (user && !(await ensureSessionDevice(user, deviceId))) {
    return json(res, 409, { error: 'device_rekey_required' });
  }

  const [option] = await sql.query(
    `
    SELECT
      o.id,
      o.ranking_id,
      r.is_vip AS "isVip",
      r.vip_voting_open AS "vipVotingOpen",
      r.vip_password_version AS "vipPasswordVersion",
      r.vip_owner_user_id AS "vipOwnerUserId"
    FROM ranking_options o
    JOIN rankings r ON r.id = o.ranking_id
    WHERE o.id = $1
      AND r.is_active = true
    LIMIT 1
  `,
    [optionId],
  );

  if (!option) {
    return json(res, 404, { error: 'option_not_found' });
  }
  if (!user && (await deviceAccountId(deviceId)) && option.isVip !== true) {
    return json(res, 403, { error: 'account_required_on_this_device' });
  }
  if (!hasVipAccess(req, user, { ...option, id: option.ranking_id })) {
    return json(res, 403, { error: 'vip_password_required' });
  }
  if (option.isVip === true && option.vipVotingOpen === false) {
    return json(res, 409, { error: 'ranking_voting_closed' });
  }

  const currentVoteQuery = user
    ? sql.query(
        `
        SELECT direction
        FROM votes
        WHERE option_id = $1
          AND user_id = $2
        LIMIT 1
      `,
        [optionId, user.id],
      )
    : sql.query(
        `
        SELECT direction
        FROM votes
        WHERE option_id = $1
          AND device_id = $2
          AND user_id IS NULL
        LIMIT 1
      `,
        [optionId, deviceId],
      );
  const rankingVoteCountQuery = user
    ? sql.query(
        `
        SELECT COUNT(*)::int AS count
        FROM votes v
        JOIN ranking_options o ON o.id = v.option_id
        WHERE v.user_id = $1
          AND o.ranking_id = $2
      `,
        [user.id, option.ranking_id],
      )
    : sql.query(
        `
        SELECT COUNT(*)::int AS count
        FROM votes v
        JOIN ranking_options o ON o.id = v.option_id
        WHERE v.device_id = $1
          AND v.user_id IS NULL
          AND o.ranking_id = $2
      `,
        [deviceId, option.ranking_id],
      );
  const [currentRows, countRows, orderBefore] = await Promise.all([
    currentVoteQuery,
    rankingVoteCountQuery,
    rankingOrderSignature(option.ranking_id),
  ]);

  const hasCurrentVote = Boolean(currentRows[0]);
  const currentDirection = Number(currentRows[0]?.direction || 0);
  const rankingVoteCount = Number(countRows[0]?.count || 0);

  if (direction !== 0 && !hasCurrentVote && rankingVoteCount >= RANKING_LIMIT) {
    return json(res, 409, {
      error: 'ranking_vote_limit',
      limit: RANKING_LIMIT,
    });
  }

  const consumesAnonymousVote =
    !user && option.isVip !== true && direction !== 0 && !hasCurrentVote;

  if (consumesAnonymousVote) {
    const participation = await anonymousParticipation(deviceId);
    const reason = anonymousRegistrationReason(participation);
    if (reason) {
      return registrationRequired(res, user, deviceId, false, reason);
    }
  }

  let weight = direction === 0 ? 0 : 1;

  if (requestedWeight === 2) {
    if (!user) {
      return json(res, 403, { error: 'double_vote_requires_account' });
    }
    if (!hasCurrentVote || currentDirection !== direction) {
      return json(res, 409, { error: 'double_vote_requires_vote' });
    }

    const [existingDouble] = await sql.query(
      `
      SELECT slot, direction
      FROM user_double_votes
      WHERE user_id = $1
        AND option_id = $2
      LIMIT 1
    `,
      [user.id, optionId],
    );

    if (!existingDouble) {
      const state = await doubleVoteState(user);
      if (state.unlocked === 0) {
        return json(res, 409, {
          error: 'double_vote_locked',
          nextAt: state.nextAt,
          remaining: state.remaining,
        });
      }
      if (state.available === 0) {
        return json(res, 409, {
          error: 'double_vote_limit',
          unlocked: state.unlocked,
          active: state.active,
        });
      }

      const [created] = await sql.query(
        `
        WITH free_slot AS (
          SELECT candidate.slot
          FROM generate_series(1, $3::int) AS candidate(slot)
          WHERE NOT EXISTS (
            SELECT 1
            FROM user_double_votes used
            WHERE used.user_id = $1
              AND used.slot = candidate.slot
          )
          ORDER BY candidate.slot
          LIMIT 1
        )
        INSERT INTO user_double_votes (
          user_id,
          slot,
          option_id,
          direction,
          updated_at
        )
        SELECT $1, slot, $2, $4, now()
        FROM free_slot
        ON CONFLICT DO NOTHING
        RETURNING slot
      `,
        [user.id, optionId, state.unlocked, direction],
      );

      if (!created) {
        const [createdByRace] = await sql.query(
          `
          SELECT slot
          FROM user_double_votes
          WHERE user_id = $1
            AND option_id = $2
          LIMIT 1
        `,
          [user.id, optionId],
        );
        if (!createdByRace) {
          const currentState = await doubleVoteState(user);
          return json(res, 409, {
            error: 'double_vote_limit',
            unlocked: currentState.unlocked,
            active: currentState.active,
          });
        }
      }
    } else if (Number(existingDouble.direction) !== direction) {
      await sql.query(
        `
        UPDATE user_double_votes
        SET direction = $3, updated_at = now()
        WHERE user_id = $1
          AND option_id = $2
      `,
        [user.id, optionId, direction],
      );
    }

    weight = 2;
  } else if (user) {
    const statements = [
      sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 17))', [
        option.ranking_id,
      ]),
      sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [user.id]),
      sql.query(
        `
        DELETE FROM user_double_votes
        WHERE user_id = $1
          AND option_id = $2
      `,
        [user.id, optionId],
      ),
      sql.query(
        `
        DELETE FROM votes
        WHERE user_id = $1
          AND option_id = $2
      `,
        [user.id, optionId],
      ),
    ];

    if (direction !== 0) {
      statements.push(
        sql.query(
          `
        INSERT INTO votes (device_id, user_id, option_id, direction, updated_at)
        VALUES ($1, $2, $3, $4, now())
      `,
          [deviceId, user.id, optionId, direction],
        ),
      );
      statements.push(
        sql.query(
          `
        INSERT INTO user_vote_history (user_id, option_id, first_voted_at)
        VALUES ($1, $2, now())
        ON CONFLICT (user_id, option_id) DO NOTHING
      `,
          [user.id, optionId],
        ),
      );
      statements.push(
        ...scoreParticipationQueries(sql, {
          userId: user.id,
          rankingId: option.ranking_id,
          optionId,
        }),
      );
    }

    await sql.transaction(statements);
  } else if (direction === 0) {
    await sql.transaction([
      sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 17))', [
        option.ranking_id,
      ]),
      sql.query('DELETE FROM votes WHERE device_id = $1 AND option_id = $2', [deviceId, optionId]),
    ]);
  } else if (consumesAnonymousVote) {
    await sql.transaction([
      sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 17))', [
        option.ranking_id,
      ]),
      sql.query(
        `
        INSERT INTO votes (device_id, option_id, direction, updated_at)
        VALUES ($1, $2, $3, now())
        ON CONFLICT (device_id, option_id)
        DO UPDATE SET direction = EXCLUDED.direction, updated_at = now()
      `,
        [deviceId, optionId, direction],
      ),
      sql.query(
        `
        INSERT INTO anonymous_vote_usage (device_id, votes_used, updated_at)
        VALUES ($1, 1, now())
        ON CONFLICT (device_id)
        DO UPDATE SET
          votes_used = anonymous_vote_usage.votes_used + 1,
          updated_at = now()
      `,
        [deviceId],
      ),
    ]);
  } else {
    await sql.transaction([
      sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 17))', [
        option.ranking_id,
      ]),
      sql.query(
        `
        INSERT INTO votes (device_id, option_id, direction, updated_at)
        VALUES ($1, $2, $3, now())
        ON CONFLICT (device_id, option_id)
        DO UPDATE SET direction = EXCLUDED.direction, updated_at = now()
      `,
        [deviceId, optionId, direction],
      ),
    ]);
  }

  if (direction !== 0 && referralToken) {
    try {
      await qualifyRankingShare(sql, {
        token: referralToken,
        rankingId: option.ranking_id,
        voterUserId: user?.id || null,
        deviceId,
      });
    } catch (error) {
      console.error('TOPO ranking share qualification error', error);
    }
  }

  const [stateRows, updatedViewer, orderAfter] = await Promise.all([
    sql.query(
      `
      WITH option_state AS (
        SELECT
          o.id,
          o.ranking_id,
          o.baseline_score
            + COALESCE((SELECT SUM(v.direction) FROM votes v WHERE v.option_id = o.id), 0)
            + COALESCE((
                SELECT SUM(dv.direction)
                FROM user_double_votes dv
                WHERE dv.option_id = o.id
              ), 0)
            + COALESCE(duel_bonus.score_bonus, 0) AS score
        FROM ranking_options o
        LEFT JOIN ranking_duel_option_bonuses duel_bonus
          ON duel_bonus.ranking_id = o.ranking_id
         AND duel_bonus.option_id = o.id
        WHERE o.id = $1
      ),
      ranking_state AS (
        SELECT
          r.id,
          r.baseline_votes + COUNT(v.*)::int AS votes,
          COUNT(v.*) FILTER (
            WHERE v.updated_at >= date_trunc('day', now())
          )::int AS today_votes
        FROM rankings r
        JOIN ranking_options o ON o.ranking_id = r.id
        LEFT JOIN votes v ON v.option_id = o.id
        WHERE r.id = (SELECT ranking_id FROM option_state)
        GROUP BY r.id, r.baseline_votes
      ),
      community_state AS (
        SELECT
          COALESCE((
            SELECT SUM(r.baseline_votes)
            FROM rankings r
            WHERE r.is_active = true
              AND r.is_vip = false
          ), 0)
          + (
            SELECT COUNT(*)
            FROM votes v
            JOIN ranking_options o ON o.id = v.option_id
            JOIN rankings r ON r.id = o.ranking_id
            WHERE r.is_active = true
              AND r.is_vip = false
          ) AS votes
      )
      SELECT
        os.ranking_id AS "rankingId",
        os.score,
        rs.votes AS "rankingVotes",
        rs.today_votes AS "todayVotes",
        cs.votes AS "communityVotes"
      FROM option_state os
      JOIN ranking_state rs ON rs.id = os.ranking_id
      CROSS JOIN community_state cs
    `,
      [optionId],
    ),
    viewerFor(user, deviceId, false, option.isVip === true),
    rankingOrderSignature(option.ranking_id),
  ]);
  const state = stateRows[0];

  try {
    const notificationTasks = [];
    if (orderBefore !== orderAfter) {
      notificationTasks.push(queueRankingChangeNotifications(option.ranking_id, user?.id));
    }
    if (user) notificationTasks.push(syncAchievementNotifications(user));
    await Promise.all(notificationTasks);
  } catch (error) {
    console.error('TOPO notification update error', error);
  }

  return json(res, 200, {
    ok: true,
    rankingId: state?.rankingId || option.ranking_id,
    score: Number(state?.score || 0),
    rankingVotes: Number(state?.rankingVotes || 0),
    todayVotes: Number(state?.todayVotes || 0),
    communityVotes: Number(state?.communityVotes || 0),
    direction,
    weight,
    viewer: updatedViewer,
  });
}

export default async function handler(req, res) {
  try {
    const method = String(req.method || 'GET').toUpperCase();
    const action = queryValue(req, 'action');

    if (method === 'GET') {
      if (!action) return catalog(req, res);
      if (action === 'ranking-image') return rankingImage(req, res);
      if (action === 'ranking-image-suggestions') return rankingImageSuggestions(req, res);
      if (action === 'vip-catalog') return vipCatalog(req, res);
      if (action === 'vip-ranking') return vipRanking(req, res);
      if (action === 'favorites') return favorites(req, res);
      if (action === 'favorite-collection') return favoriteCollection(req, res);
      if (action === 'ranking-vote-modes') return rankingVotingModes(req, res);
      if (action === 'auth-config') return clerkConfig(req, res);
      if (action === 'notifications') return notifications(req, res);
      if (action === 'profile') return profile(req, res);
      if (action === 'leaderboard') return leaderboard(req, res);
      if (action === 'comments') return comments(req, res);
      if (action === 'suggestions') return mySuggestions(req, res);
      if (action === 'moderation') return moderationQueue(req, res);
      if (action === 'moderation-users') return moderationUsers(req, res);
      if (action === 'moderation-rankings') return moderationRankings(req, res);
      return json(res, 404, { error: 'action_not_found' });
    }

    if (method === 'POST' || method === 'PATCH') {
      let body;
      try {
        body = parseBody(req);
      } catch {
        return json(res, 400, { error: 'invalid_request' });
      }

      if (method === 'POST') {
        if (!action) return vote(req, res, body);
        if (action === 'signup' || action === 'login') {
          return json(res, 410, { error: 'legacy_auth_disabled' });
        }
        if (action === 'logout') return logout(req, res);
        if (action === 'vip-unlock') return unlockVipRanking(req, res, body);
        if (action === 'vip-rankings') return createUserVipRanking(req, res, body);
        if (action === 'favorites') return addFavorite(req, res, body);
        if (action === 'favorite-share') return shareFavorites(req, res);
        if (action === 'ranking-share') return createRankingShare(req, res, body);
        if (action === 'ranking-duel') return saveDuel(req, res, body);
        if (action === 'ranking-duel-reset') return resetDuel(req, res, body);
        if (action === 'comments') return writeComment(req, res, body);
        if (action === 'name-reports') return createNameReport(req, res, body);
        if (action === 'notifications') return notifications(req, res, body);
        if (action === 'suggestions') return createSuggestion(req, res, body);
        if (action === 'request-password-reset' || action === 'reset-password') {
          return json(res, 410, { error: 'password_auth_disabled' });
        }
      }
      if (method === 'PATCH' && action === 'comments') {
        return writeComment(req, res, body, true);
      }
      if (method === 'PATCH' && action === 'profile') {
        return updateProfile(req, res, body);
      }
      if (method === 'PATCH' && action === 'vip-rankings') {
        return updateUserVipRanking(req, res, body);
      }
      if (method === 'PATCH' && action === 'moderation') {
        return moderateSuggestion(req, res, body);
      }
      if (method === 'PATCH' && action === 'ranking-content') {
        return updateRankingContent(req, res, body);
      }
      return json(res, 404, { error: 'action_not_found' });
    }

    if (method === 'DELETE') {
      if (action === 'vip-rankings') return deleteUserVipRanking(req, res);
      if (action === 'favorites') return removeFavorite(req, res);
      return json(res, 404, { error: 'action_not_found' });
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (error) {
    console.error('TOPO API error', error);
    return json(res, 500, { error: 'database_error' });
  }
}
