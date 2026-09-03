import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import baseHandler from './api.js';
import { qualifyRankingShare, scoreParticipationQueries } from './participation-score.js';

const sql = neon(process.env.DATABASE_URL);

function queryValue(req, key) {
  const value = req.query?.[key];
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

function parseBody(req) {
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) return req.body;
  return {};
}

export function parseStartOptionIds(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split('-'),
    optionIds = [...new Set(raw.map(Number))];
  return optionIds.length === 2 &&
    optionIds.every((optionId) => Number.isSafeInteger(optionId) && optionId > 0)
    ? optionIds
    : [];
}

function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

function captureResponse() {
  const captured = { statusCode: 200, body: null };
  const response = {
    setHeader() {},
    status(code) {
      captured.statusCode = code;
      return response;
    },
    json(body) {
      captured.body = body;
      return body;
    },
    send(body) {
      captured.body = body;
      return body;
    },
  };
  return { response, captured };
}

function validationRequest(req, rankingId, deviceId) {
  const copy = Object.create(req);
  Object.defineProperties(copy, {
    method: { value: 'GET', configurable: true },
    query: {
      value: {
        ...(req.query || {}),
        action: 'ranking-vote-modes',
        ranking_id: rankingId,
        device_id: deviceId,
      },
      configurable: true,
    },
    body: { value: undefined, configurable: true },
  });
  return copy;
}

async function baseVotingState(req, rankingId, deviceId) {
  const { response, captured } = captureResponse();
  await baseHandler(validationRequest(req, rankingId, deviceId), response);
  return captured;
}

async function linkedUserId(deviceId) {
  const rows = await sql.query(
    `
      SELECT account.user_id AS "userId"
      FROM (
        SELECT user_id FROM user_devices WHERE device_id = $1
        UNION
        SELECT user_id FROM clerk_device_links WHERE device_id = $1
      ) account
      LIMIT 1
    `,
    [deviceId],
  );
  return rows[0]?.userId || null;
}

async function bottomUpPair(rankingId, duel) {
  if (duel?.completed) return [];
  const champion = duel?.champion || null;
  const sessionId = duel?.sessionId || null;
  const limit = champion ? 1 : 2;
  const rows = await sql.query(
    `
      WITH scored AS (
        SELECT
          option.id AS "optionId",
          option.label,
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
      ),
      seen AS (
        SELECT DISTINCT entry.option_id
        FROM ranking_duel_rounds round
        JOIN ranking_duel_entries entry ON entry.round_id = round.id
        WHERE $2::uuid IS NOT NULL
          AND round.session_id = $2::uuid
      )
      SELECT scored."optionId", scored.label
      FROM scored
      WHERE NOT EXISTS (SELECT 1 FROM seen WHERE seen.option_id = scored."optionId")
      ORDER BY scored.score ASC, scored.position DESC, scored."optionId" DESC
      LIMIT $3
    `,
    [rankingId, sessionId, limit],
  );

  const candidates = rows.map((row) => ({
    optionId: Number(row.optionId),
    label: row.label,
    role: champion ? 'challenger' : 'starter',
  }));
  if (!champion) return candidates;
  if (!candidates.length) return [];
  return [
    { optionId: Number(champion.optionId), label: champion.label, role: 'incumbent' },
    candidates[0],
  ];
}

async function sharedStartPair(rankingId, duel, startOptionIds) {
  if (duel?.sessionId || duel?.completed || startOptionIds.length !== 2) return [];
  const rows = await sql.query(
    `
      SELECT option.id AS "optionId", option.label
      FROM ranking_options option
      WHERE option.ranking_id = $1
        AND option.id = ANY($2::bigint[])
    `,
    [rankingId, startOptionIds],
  );
  if (rows.length !== 2) return [];
  const optionsById = new Map(rows.map((row) => [Number(row.optionId), row]));
  return startOptionIds.map((optionId) => ({
    optionId,
    label: optionsById.get(optionId).label,
    role: 'starter',
  }));
}

async function customizedState(req, rankingId, deviceId, startOptionIds = []) {
  const base = await baseVotingState(req, rankingId, deviceId);
  if (base.statusCode >= 400 || !base.body?.duel) return base;
  const sharedPair = await sharedStartPair(rankingId, base.body.duel, startOptionIds),
    pair = sharedPair.length === 2 ? sharedPair : await bottomUpPair(rankingId, base.body.duel);
  return {
    statusCode: base.statusCode,
    body: {
      ...base.body,
      duel: { ...base.body.duel, pair, sharedStart: sharedPair.length === 2 },
    },
  };
}

function samePair(expected, submitted) {
  const left = [...expected].map(Number).sort((a, b) => a - b);
  const right = [...submitted].map(Number).sort((a, b) => a - b);
  return left.length === 2 && right.length === 2 && left.every((id, index) => id === right[index]);
}

function anonymousRegistrationReason(viewer, includeActiveDuels = false) {
  const voteLimit = Number(viewer.anonymousLimit || 10);
  const duelLimit = Number(viewer.anonymousDuelLimit || 2);
  const votesUsed = Number(viewer.anonymousUsed || 0);
  const duelsUsed = Number(viewer.anonymousDuelsUsed || 0);
  const activeDuels = Number(viewer.anonymousActiveDuels || 0);
  if (votesUsed >= voteLimit) return 'votes';
  if (duelsUsed >= duelLimit) return 'duels';
  if (includeActiveDuels && duelsUsed + activeDuels >= duelLimit) return 'duel_slots';
  return '';
}

async function officialOptionState(optionId) {
  const [row] = await sql.query(
    `
      SELECT option.id AS "optionId",
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
  return row ? { optionId: Number(row.optionId), score: Number(row.score || 0) } : null;
}

async function saveBottomUpDuel(req, res) {
  let body;
  try {
    body = parseBody(req);
  } catch {
    return json(res, 400, { error: 'invalid_request' });
  }

  const deviceId = String(body.device_id || '');
  const rankingId = String(body.ranking_id || '').trim();
  const referralToken = String(body.referral_token || '');
  const optionIds = [
    ...new Set((Array.isArray(body.option_ids) ? body.option_ids : []).map(Number)),
  ];
  const startOptionIds = parseStartOptionIds(body.start_option_ids);
  const winnerOptionId = body.winner_option_id == null ? null : Number(body.winner_option_id);
  if (
    optionIds.length !== 2 ||
    optionIds.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
    (winnerOptionId !== null && !optionIds.includes(winnerOptionId))
  ) {
    return json(res, 400, { error: 'invalid_duel' });
  }

  const current = await customizedState(req, rankingId, deviceId, startOptionIds);
  if (current.statusCode >= 400) return json(res, current.statusCode, current.body);
  if (current.body?.votingOpen === false) return json(res, 409, { error: 'ranking_voting_closed' });

  const duel = current.body.duel || {};
  const expectedIds = (duel.pair || []).map((option) => Number(option.optionId));
  if (!samePair(expectedIds, optionIds)) {
    return json(res, 409, { error: 'duel_state_changed', ...current.body });
  }

  const viewer = current.body.viewer || {};
  const accountUserId = await linkedUserId(deviceId);
  const userId = viewer.registered ? accountUserId : null;
  if (viewer.registered && !userId) return json(res, 409, { error: 'device_rekey_required' });
  if (!viewer.registered && accountUserId) {
    return json(res, 403, { error: 'account_required_on_this_device' });
  }

  const skipped = winnerOptionId === null;
  const tracksAnonymousDuel = !viewer.registered && viewer.privateVoting !== true;
  const registrationReason =
    tracksAnonymousDuel && !duel.sessionId ? anonymousRegistrationReason(viewer, true) : '';
  if (registrationReason) {
    return json(res, 403, {
      error: 'registration_required',
      reason: registrationReason,
      limit:
        registrationReason === 'votes'
          ? Number(viewer.anonymousLimit || 10)
          : Number(viewer.anonymousDuelLimit || 2),
      viewer,
    });
  }

  const sessionId = duel.sessionId || randomUUID();
  const championBeforeOptionId = duel.champion?.optionId || null;
  const potBefore = Number(duel.pot || 0);
  const championAfterOptionId = skipped ? championBeforeOptionId : winnerOptionId;
  const potAfter = skipped ? potBefore : potBefore + 1;
  const ownerKey = userId ? `user:${userId}` : `device:${deviceId}`;
  const roundId = randomUUID();
  const statements = [
    sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 37))', [
      `${rankingId}:${ownerKey}`,
    ]),
  ];

  if (!duel.sessionId) {
    statements.push(
      sql.query(
        `
          INSERT INTO ranking_duel_sessions (
            id, ranking_id, device_id, user_id, order_seed,
            champion_option_id, pot, completed, created_at, updated_at
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
          id, ranking_id, device_id, user_id, skipped, session_id,
          pot_before, pot_after, champion_before_option_id,
          champion_after_option_id, created_at
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
          round_id, ranking_id, option_id, device_id, user_id, won, created_at
        )
        SELECT $1, $2, option.option_id, $3, $4::uuid,
          CASE WHEN $5::bigint IS NULL THEN NULL ELSE option.option_id = $5::bigint END,
          now()
        FROM unnest($6::bigint[]) AS option(option_id)
      `,
      [roundId, rankingId, deviceId, userId, winnerOptionId, optionIds],
    ),
    sql.query(
      `
        WITH updated_session AS (
          UPDATE ranking_duel_sessions session
          SET champion_option_id = $2::bigint,
              pot = $3,
              completed = (
                SELECT CASE WHEN $2::bigint IS NULL THEN COUNT(*) < 2 ELSE COUNT(*) < 1 END
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
    const changed = await customizedState(req, rankingId, deviceId);
    return json(res, 409, { error: 'duel_state_changed', ...(changed.body || {}) });
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

  const [fresh, scoreUpdate] = await Promise.all([
    customizedState(req, rankingId, deviceId),
    winnerOptionId ? officialOptionState(winnerOptionId) : Promise.resolve(null),
  ]);
  if (fresh.statusCode >= 400) return json(res, fresh.statusCode, fresh.body);
  return json(res, 200, { ok: true, ...fresh.body, scoreUpdate });
}

export default async function handler(req, res) {
  try {
    const method = String(req.method || 'GET').toUpperCase();
    const action = queryValue(req, 'action');
    if (method === 'GET' && action === 'ranking-vote-modes') {
      const rankingId = queryValue(req, 'ranking_id').trim();
      const deviceId = queryValue(req, 'device_id');
      const startOptionIds = parseStartOptionIds(queryValue(req, 'start_option_ids'));
      const state = await customizedState(req, rankingId, deviceId, startOptionIds);
      return json(res, state.statusCode, state.body);
    }
    if (method === 'POST' && action === 'ranking-duel') return saveBottomUpDuel(req, res);
    return json(res, 404, { error: 'action_not_found' });
  } catch (error) {
    console.error('TOPO bottom-up duel API error', error);
    return json(res, 500, { error: 'database_error' });
  }
}
