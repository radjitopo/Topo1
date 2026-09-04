import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const FALLBACK_DEVICE_ID = 'moderator-delete-0001';

function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

function parseBody(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}');
    } catch {
      return {};
    }
  }
  return req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
}

function requestOrigin(req) {
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '')
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9.-]+(?::\d+)?$/.test(host)) return '';
  const protocol = String(req.headers?.['x-forwarded-proto'] || 'https').toLowerCase();
  return `${protocol === 'http' ? 'http' : 'https'}://${host}`;
}

async function moderatorProfile(req, deviceId) {
  const origin = requestOrigin(req);
  if (!origin) return null;
  const headers = {};
  if (req.headers?.cookie) headers.cookie = String(req.headers.cookie);
  if (req.headers?.authorization) headers.authorization = String(req.headers.authorization);
  const safeDevice = /^[a-zA-Z0-9-]{16,100}$/.test(String(deviceId || ''))
    ? String(deviceId)
    : FALLBACK_DEVICE_ID;
  const response = await fetch(
    `${origin}/api?action=profile&device_id=${encodeURIComponent(safeDevice)}`,
    { headers, cache: 'no-store' },
  );
  if (!response.ok) return null;
  const profile = await response.json().catch(() => null);
  return profile?.isModerator === true && profile?.user?.id ? profile : null;
}

function validRankingId(value) {
  return /^[a-z0-9][a-z0-9-]{0,99}$/.test(String(value || ''));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const body = parseBody(req);
  const profile = await moderatorProfile(req, body.deviceId);
  if (!profile) return json(res, 403, { error: 'moderator_required' });

  const rankingId = String(body.rankingId || '').trim();
  const optionId = Number(body.optionId);
  if (!validRankingId(rankingId) || !Number.isSafeInteger(optionId) || optionId <= 0) {
    return json(res, 400, { error: 'invalid_option' });
  }

  const [rankingRows, optionRows] = await Promise.all([
    sql.query(
      `
        SELECT id, question, image_url AS "imageUrl", is_vip AS "isVip"
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
        ORDER BY position, id
      `,
      [rankingId],
    ),
  ]);

  const ranking = rankingRows[0];
  if (!ranking) return json(res, 404, { error: 'ranking_not_found' });
  if (optionRows.length <= 2) return json(res, 409, { error: 'minimum_options' });

  const removed = optionRows.find((option) => Number(option.id) === optionId);
  if (!removed) return json(res, 404, { error: 'option_not_found' });

  const beforeContent = {
    title: ranking.question,
    imageUrl: ranking.imageUrl || null,
    vip: ranking.isVip === true,
    options: optionRows.map((option) => ({ id: Number(option.id), label: option.label })),
  };
  const remaining = optionRows.filter((option) => Number(option.id) !== optionId);
  const afterContent = {
    title: ranking.question,
    imageUrl: ranking.imageUrl || null,
    vip: ranking.isVip === true,
    options: remaining.map((option) => ({ id: Number(option.id), label: option.label })),
    removedOption: { id: optionId, label: removed.label },
  };

  const queries = [
    sql.query('DELETE FROM ranking_comments WHERE option_id = $1', [optionId]),
    sql.query('DELETE FROM ranking_duel_entries WHERE option_id = $1', [optionId]),
    sql.query('DELETE FROM ranking_duel_option_bonuses WHERE option_id = $1', [optionId]),
    sql.query('DELETE FROM ranking_top3_selections WHERE option_id = $1', [optionId]),
    sql.query(
      `
        UPDATE ranking_duel_rounds
        SET champion_before_option_id = CASE WHEN champion_before_option_id = $1 THEN NULL ELSE champion_before_option_id END,
            champion_after_option_id = CASE WHEN champion_after_option_id = $1 THEN NULL ELSE champion_after_option_id END
        WHERE champion_before_option_id = $1 OR champion_after_option_id = $1
      `,
      [optionId],
    ),
    sql.query(
      `
        UPDATE ranking_duel_sessions
        SET champion_option_id = NULL,
            pot = 0,
            completed = false,
            updated_at = now()
        WHERE champion_option_id = $1
      `,
      [optionId],
    ),
    sql.query('DELETE FROM ranking_options WHERE id = $1 AND ranking_id = $2', [optionId, rankingId]),
    sql.query(
      `
        WITH ordered AS (
          SELECT id, row_number() OVER (ORDER BY position, id)::int AS new_position
          FROM ranking_options
          WHERE ranking_id = $1
        )
        UPDATE ranking_options option
        SET position = ordered.new_position
        FROM ordered
        WHERE option.id = ordered.id
      `,
      [rankingId],
    ),
    sql.query('UPDATE rankings SET content_updated_at = now() WHERE id = $1', [rankingId]),
    sql.query(
      `
        INSERT INTO ranking_content_edits (
          id, ranking_id, moderator_user_id, before_content, after_content
        )
        VALUES (gen_random_uuid(), $1, $2::uuid, $3::jsonb, $4::jsonb)
      `,
      [rankingId, profile.user.id, JSON.stringify(beforeContent), JSON.stringify(afterContent)],
    ),
  ];

  try {
    await sql.transaction(queries, { isolationLevel: 'Serializable' });
  } catch (error) {
    console.error('moderator_option_delete_failed', error);
    return json(res, 500, { error: 'delete_failed' });
  }

  return json(res, 200, {
    ok: true,
    rankingId,
    removed: { id: optionId, label: removed.label },
    optionCount: remaining.length,
  });
}
