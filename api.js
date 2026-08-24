import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { neon } from '@neondatabase/serverless';
import { possibleOptionDuplicate } from './option-similarity.js';
import {
  defaultDisplayName,
  displayNameChangeState,
  validateDisplayName,
} from './profile-names.js';
import { rankingQuestion } from './ranking-titles.js';

const sql = neon(process.env.DATABASE_URL);
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
const RANKING_LIMIT = 20;
const DOUBLE_VOTE_THRESHOLDS = [20, 75, 200];
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
const PUBLISHED_RANKING_IMAGE_LIMIT = 1000;
const BUILT_IN_MODERATOR_EMAIL_HASHES = new Set([
  '225c33c5e9c8aff600ac4f1576d55f0ddbd9e9934b58270a51d1d7887c7b1794',
]);
const SESSION_COOKIE = 'topo_session';
const DEVICE_PATTERN = /^[a-zA-Z0-9-]{16,100}$/;
const SUGGESTION_CATEGORY_VALUES = Object.freeze([
  'Cinema',
  'Música',
  'TV & Séries',
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

async function anonymousUsed(deviceId) {
  if (!isValidDevice(deviceId)) return 0;

  const [row] = await sql.query('SELECT votes_used FROM anonymous_usage WHERE device_id = $1', [
    deviceId,
  ]);

  return Number(row?.votes_used || 0);
}

function unlockedDoubleVoteCount(totalVotes) {
  const total = Math.max(0, Number(totalVotes || 0));
  return DOUBLE_VOTE_THRESHOLDS.filter((threshold) => total >= threshold).length;
}

async function syncUserVoteHistory(userId, deviceIds) {
  if (!userId || !deviceIds.length) return;

  await sql.query(
    `
    INSERT INTO user_vote_history (user_id, option_id, first_voted_at)
    SELECT $1, v.option_id, MIN(v.updated_at)
    FROM votes v
    WHERE v.device_id = ANY($2::text[])
    GROUP BY v.option_id
    ON CONFLICT (user_id, option_id) DO NOTHING
  `,
    [userId, deviceIds],
  );
}

async function doubleVoteState(user, deviceId, knownDeviceIds = null) {
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

  const deviceIds = knownDeviceIds || (await devicesFor(user, deviceId));
  await syncUserVoteHistory(user.id, deviceIds);

  const [historyRows, activeRows] = await Promise.all([
    sql.query(
      `
      SELECT COUNT(*)::int AS total
      FROM user_vote_history
      WHERE user_id = $1
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

async function viewerFor(user, deviceId) {
  const [used, doubleVotes] = await Promise.all([
    anonymousUsed(deviceId),
    doubleVoteState(user, deviceId),
  ]);

  return {
    registered: Boolean(user),
    isModerator: isModerator(user),
    anonymousUsed: used,
    anonymousLimit: ANONYMOUS_LIMIT,
    rankingLimit: RANKING_LIMIT,
    doubleVotes,
  };
}

async function devicesFor(user, deviceId) {
  if (!user) {
    return isValidDevice(deviceId) ? [deviceId] : [];
  }

  if (user.clerk_user_id) {
    const rows = await sql.query(
      `
      SELECT device_id
      FROM clerk_device_links
      WHERE clerk_user_id = $1
        AND user_id = $2
      ORDER BY created_at
    `,
      [user.clerk_user_id, user.id],
    );
    return rows.map((row) => row.device_id);
  }

  const rows = await sql.query(
    'SELECT device_id FROM user_devices WHERE user_id = $1 ORDER BY linked_at',
    [user.id],
  );

  return rows.map((row) => row.device_id);
}

async function ensureUserDevice(userId, deviceId) {
  const [existing] = await sql.query('SELECT user_id FROM user_devices WHERE device_id = $1', [
    deviceId,
  ]);

  if (existing && existing.user_id !== userId) {
    return false;
  }
  if (existing) return true;

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

  return linked?.user_id === userId;
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

  const [created] = await sql.query(
    `
    WITH new_device AS (
      INSERT INTO user_devices (device_id, user_id)
      VALUES ($1, $3)
      ON CONFLICT (device_id) DO NOTHING
      RETURNING device_id
    )
    INSERT INTO clerk_device_links (device_id, clerk_user_id, user_id)
    SELECT device_id, $2, $3
    FROM new_device
    ON CONFLICT DO NOTHING
    RETURNING device_id
  `,
    [deviceId, user.clerk_user_id, user.id],
  );

  if (created) return true;

  const [linkedAfterRace] = await sql.query(
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
  return Boolean(linkedAfterRace);
}

async function ensureSessionDevice(user, deviceId) {
  if (user.clerk_user_id) return ensureClerkDevice(user, deviceId);
  return ensureUserDevice(user.id, deviceId);
}

async function catalog(req, res) {
  const deviceId = queryValue(req, 'device_id').slice(0, 100);
  const user = await sessionUser(req);
  if (user && isValidDevice(deviceId) && !(await ensureSessionDevice(user, deviceId))) {
    return json(res, 409, { error: 'device_rekey_required' });
  }
  const deviceIds = await devicesFor(user, deviceId);

  const [rows, userCountRows] = await Promise.all([
    sql.query(
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
      SELECT DISTINCT ON (option_id)
        option_id,
        direction
      FROM votes
      WHERE device_id = ANY($1::text[])
      ORDER BY option_id, updated_at DESC, device_id
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
      o.baseline_score
        + COALESCE(vt.score_delta, 0)::int
        + COALESCE(dvt.score_delta, 0)::int AS score,
      COALESCE(vt.live_votes, 0)::int AS live_votes,
      COALESCE(vt.today_votes, 0)::int AS today_votes,
      COALESCE(mv.direction, 0)::int AS my_direction,
      CASE
        WHEN mdv.direction = mv.direction THEN 2
        ELSE 1
      END::int AS my_weight
    FROM rankings r
    JOIN ranking_options o ON o.ranking_id = r.id
    LEFT JOIN vote_totals vt ON vt.option_id = o.id
    LEFT JOIN double_vote_totals dvt ON dvt.option_id = o.id
    LEFT JOIN my_votes mv ON mv.option_id = o.id
    LEFT JOIN my_double_votes mdv ON mdv.option_id = o.id
    WHERE r.is_active = true
    ORDER BY r.created_at, r.id, o.position
  `,
      [deviceIds, user?.id || null],
    ),
    sql.query('SELECT COUNT(*)::int AS total FROM users'),
  ]);

  const byId = new Map();

  for (const row of rows) {
    if (!byId.has(row.ranking_id)) {
      byId.set(row.ranking_id, {
        id: row.ranking_id,
        cat: row.category,
        q: rankingQuestion(row.ranking_id, row.question),
        img: row.image_url || null,
        votes: Number(row.baseline_votes || 0),
        todayVotes: 0,
        createdAt: row.created_at,
        opts: [],
      });
    }

    const ranking = byId.get(row.ranking_id);
    ranking.votes += Number(row.live_votes || 0);
    ranking.todayVotes += Number(row.today_votes || 0);
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
      rankings: rankings.length,
      votes: rankings.reduce((total, ranking) => total + Number(ranking.votes || 0), 0),
      users: Number(userCountRows[0]?.total || 0),
    },
    location: { city: geolocationCity(req) },
    viewer: await viewerFor(user, deviceId),
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

async function profile(req, res) {
  const user = await sessionUser(req);
  if (!user) return json(res, 401, { error: 'authentication_required' });
  const deviceId = queryValue(req, 'device_id').slice(0, 100);
  if (isValidDevice(deviceId) && !(await ensureSessionDevice(user, deviceId))) {
    return json(res, 409, { error: 'device_rekey_required' });
  }

  const deviceIds = await devicesFor(user, deviceId);
  await syncUserVoteHistory(user.id, deviceIds);

  const [
    statsRows,
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
        SELECT DISTINCT ON (v.option_id)
          v.option_id,
          v.direction
        FROM votes v
        WHERE v.device_id = ANY($1::text[])
        ORDER BY v.option_id, v.updated_at DESC, v.device_id
      )
      SELECT
        COUNT(*)::int AS votes,
        COUNT(DISTINCT o.ranking_id)::int AS rankings,
        COUNT(*) FILTER (WHERE l.direction = 1)::int AS up_votes,
        COUNT(*) FILTER (WHERE l.direction = -1)::int AS down_votes
      FROM latest l
      JOIN ranking_options o ON o.id = l.option_id
    `,
      [deviceIds],
    ),
    sql.query(
      `
      WITH latest AS (
        SELECT DISTINCT ON (v.option_id)
          v.option_id,
          v.direction,
          v.updated_at
        FROM votes v
        WHERE v.device_id = ANY($1::text[])
        ORDER BY v.option_id, v.updated_at DESC, v.device_id
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
        ON dv.user_id = $2
       AND dv.option_id = l.option_id
       AND dv.direction = l.direction
      ORDER BY l.updated_at DESC
      LIMIT 20
    `,
      [deviceIds, user.id],
    ),
    sql.query(
      `
      WITH latest AS (
        SELECT DISTINCT ON (v.option_id)
          v.option_id
        FROM votes v
        WHERE v.device_id = ANY($1::text[])
        ORDER BY v.option_id, v.updated_at DESC, v.device_id
      )
      SELECT r.category AS name, COUNT(*)::int AS votes
      FROM latest l
      JOIN ranking_options o ON o.id = l.option_id
      JOIN rankings r ON r.id = o.ranking_id
      GROUP BY r.category
      ORDER BY votes DESC, r.category
    `,
      [deviceIds],
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
      SELECT DISTINCT (
        (now() AT TIME ZONE 'America/Sao_Paulo')::date
        - (first_voted_at AT TIME ZONE 'America/Sao_Paulo')::date
      )::int AS "daysAgo"
      FROM user_vote_history
      WHERE user_id = $1
        AND first_voted_at >= now() - interval '400 days'
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
    doubleVoteState(user, deviceId, deviceIds),
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
      votes: Number(stats.votes || 0),
      rankings: Number(stats.rankings || 0),
      upVotes: Number(stats.up_votes || 0),
      downVotes: Number(stats.down_votes || 0),
      streak: currentVoteStreak(streakRows),
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
    WITH ranked AS (
      SELECT
        u.id AS "userId",
        u.display_name AS name,
        COUNT(h.option_id)::int AS votes,
        COUNT(DISTINCT o.ranking_id)::int AS rankings,
        DENSE_RANK() OVER (
          ORDER BY
            COUNT(h.option_id) DESC,
            COUNT(DISTINCT o.ranking_id) DESC
        )::int AS position,
        CASE
          WHEN COALESCE(p.show_avatar_on_leaderboard, true)
            THEN p.avatar_data
          ELSE NULL
        END AS "avatarData"
      FROM users u
      LEFT JOIN user_vote_history h ON h.user_id = u.id
      LEFT JOIN ranking_options o ON o.id = h.option_id
      LEFT JOIN user_profiles p ON p.user_id = u.id
      GROUP BY
        u.id,
        u.display_name,
        p.avatar_data,
        p.show_avatar_on_leaderboard
    )
    SELECT
      "userId",
      name,
      votes,
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
    SELECT id
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
  if (!(await activeRanking(rankingId))) {
    return json(res, 404, { error: 'ranking_not_found' });
  }

  const user = await sessionUser(req);
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
    SELECT o.id
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
      SELECT id, question
      FROM rankings
      WHERE id = $1 AND is_active = true
      LIMIT 1
    `,
      [rankingId],
    );
    if (!ranking) return json(res, 404, { error: 'ranking_not_found' });

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
  if (!title || !normalizedTitle || !category || !SUGGESTION_CATEGORIES.has(category) || !options) {
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

async function vote(req, res, body) {
  const deviceId = String(body.device_id || '');
  const optionId = Number(body.option_id);
  const direction = Number(body.direction);
  const requestedWeight = body.weight === undefined ? 1 : Number(body.weight);

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
    SELECT o.id, o.ranking_id
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

  const deviceIds = await devicesFor(user, deviceId);
  const [currentRows, countRows] = await Promise.all([
    sql.query(
      `
      SELECT direction
      FROM votes
      WHERE option_id = $1
        AND device_id = ANY($2::text[])
      ORDER BY updated_at DESC, device_id
      LIMIT 1
    `,
      [optionId, deviceIds],
    ),
    sql.query(
      `
      SELECT COUNT(DISTINCT v.option_id)::int AS count
      FROM votes v
      JOIN ranking_options o ON o.id = v.option_id
      WHERE v.device_id = ANY($1::text[])
        AND o.ranking_id = $2
    `,
      [deviceIds, option.ranking_id],
    ),
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

  const consumesAnonymousVote = !user && direction !== 0 && !hasCurrentVote;

  if (consumesAnonymousVote && (await anonymousUsed(deviceId)) >= ANONYMOUS_LIMIT) {
    return json(res, 403, {
      error: 'registration_required',
      limit: ANONYMOUS_LIMIT,
    });
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
      const state = await doubleVoteState(user, deviceId, deviceIds);
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
          const currentState = await doubleVoteState(user, deviceId, deviceIds);
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
        WHERE option_id = $1
          AND device_id = ANY($2::text[])
      `,
        [optionId, deviceIds],
      ),
    ];

    if (direction !== 0) {
      statements.push(
        sql.query(
          `
        INSERT INTO votes (device_id, option_id, direction, updated_at)
        VALUES ($1, $2, $3, now())
      `,
          [deviceId, optionId, direction],
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
    }

    await sql.transaction(statements);
  } else if (direction === 0) {
    await sql.query('DELETE FROM votes WHERE device_id = $1 AND option_id = $2', [
      deviceId,
      optionId,
    ]);
  } else if (consumesAnonymousVote) {
    await sql.transaction([
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
        INSERT INTO anonymous_usage (device_id, votes_used, updated_at)
        VALUES ($1, 1, now())
        ON CONFLICT (device_id)
        DO UPDATE SET
          votes_used = anonymous_usage.votes_used + 1,
          updated_at = now()
      `,
        [deviceId],
      ),
    ]);
  } else {
    await sql.query(
      `
      INSERT INTO votes (device_id, option_id, direction, updated_at)
      VALUES ($1, $2, $3, now())
      ON CONFLICT (device_id, option_id)
      DO UPDATE SET direction = EXCLUDED.direction, updated_at = now()
    `,
      [deviceId, optionId, direction],
    );
  }

  const [stateRows, updatedViewer] = await Promise.all([
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
              ), 0) AS score
        FROM ranking_options o
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
          ), 0)
          + (
            SELECT COUNT(*)
            FROM votes v
            JOIN ranking_options o ON o.id = v.option_id
            JOIN rankings r ON r.id = o.ranking_id
            WHERE r.is_active = true
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
    viewerFor(user, deviceId),
  ]);
  const state = stateRows[0];

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
      if (action === 'auth-config') return clerkConfig(req, res);
      if (action === 'profile') return profile(req, res);
      if (action === 'leaderboard') return leaderboard(req, res);
      if (action === 'comments') return comments(req, res);
      if (action === 'suggestions') return mySuggestions(req, res);
      if (action === 'moderation') return moderationQueue(req, res);
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
        if (action === 'comments') return writeComment(req, res, body);
        if (action === 'name-reports') return createNameReport(req, res, body);
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
      if (method === 'PATCH' && action === 'moderation') {
        return moderateSuggestion(req, res, body);
      }
      return json(res, 404, { error: 'action_not_found' });
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (error) {
    console.error('TOPO API error', error);
    return json(res, 500, { error: 'database_error' });
  }
}
