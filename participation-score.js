export const PARTICIPATION_SCORE = Object.freeze({
  directVote: 1,
  completedDuel: 10,
  rankingParticipation: 5,
  activeDay: 10,
  qualifiedShare: 20,
  qualifiedSharesPerDay: 3,
});

export const SHARE_TOKEN_PATTERN = /^[a-zA-Z0-9_-]{24,64}$/;
const DEVICE_PATTERN = /^[a-zA-Z0-9-]{16,100}$/;

export function normalizeShareToken(value) {
  const token = String(value || '').trim();
  return SHARE_TOKEN_PATTERN.test(token) ? token : '';
}

export function scoreParticipationQueries(
  sql,
  { userId, rankingId, optionId = null, duelSessionId = null },
) {
  if (!userId || !rankingId) return [];

  const statements = [];
  if (Number.isSafeInteger(Number(optionId)) && Number(optionId) > 0) {
    statements.push(
      sql.query(
        `
        INSERT INTO user_score_events (
          user_id, event_type, event_key, ranking_id, points, created_at
        )
        SELECT $1::uuid, 'direct_vote', ($2::bigint)::text, ranking.id, $4, now()
        FROM rankings ranking
        WHERE ranking.id = $3
          AND ranking.is_vip = false
        ON CONFLICT (user_id, event_type, event_key) DO NOTHING
        `,
        [userId, Number(optionId), rankingId, PARTICIPATION_SCORE.directVote],
      ),
    );
  }

  statements.push(
    sql.query(
      `
        INSERT INTO user_score_events (
          user_id, event_type, event_key, ranking_id, points, created_at
        )
        SELECT $1::uuid, 'ranking_participation', ranking.id, ranking.id, $3, now()
        FROM rankings ranking
        WHERE ranking.id = $2
          AND ranking.is_vip = false
        ON CONFLICT (user_id, event_type, event_key) DO NOTHING
      `,
      [userId, rankingId, PARTICIPATION_SCORE.rankingParticipation],
    ),
    sql.query(
      `
        INSERT INTO user_score_events (
          user_id, event_type, event_key, ranking_id, points, created_at
        )
        SELECT
          $1::uuid,
          'active_day',
          to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD'),
          NULL,
          $3,
          now()
        FROM rankings ranking
        WHERE ranking.id = $2
          AND ranking.is_vip = false
        ON CONFLICT (user_id, event_type, event_key) DO NOTHING
      `,
      [userId, rankingId, PARTICIPATION_SCORE.activeDay],
    ),
  );

  if (duelSessionId) {
    statements.push(
      sql.query(
        `
          INSERT INTO user_score_events (
            user_id, event_type, event_key, ranking_id, points, created_at
          )
          SELECT
            $1::uuid,
            'completed_duel',
            session.ranking_id,
            session.ranking_id,
            $3,
            now()
          FROM ranking_duel_sessions session
          JOIN rankings ranking ON ranking.id = session.ranking_id
          WHERE session.id = $2::uuid
            AND session.user_id = $1::uuid
            AND session.completed = true
            AND ranking.is_vip = false
          ON CONFLICT (user_id, event_type, event_key) DO NOTHING
        `,
        [userId, duelSessionId, PARTICIPATION_SCORE.completedDuel],
      ),
    );
  }

  return statements;
}

export async function qualifyRankingShare(
  sql,
  { token: rawToken, rankingId, voterUserId = null, deviceId },
) {
  const token = normalizeShareToken(rawToken);
  if (!token || !rankingId || !DEVICE_PATTERN.test(String(deviceId || ''))) return false;

  const [candidate] = await sql.query(
    `
      SELECT
        referral.id,
        referral.sharer_user_id AS "sharerUserId"
      FROM ranking_share_referrals referral
      WHERE referral.token = $1
        AND referral.ranking_id = $2
        AND referral.converted_at IS NULL
        AND referral.sharer_user_id IS DISTINCT FROM $3::uuid
        AND referral.sharer_device_id <> $4
      LIMIT 1
    `,
    [token, rankingId, voterUserId, deviceId],
  );
  if (!candidate?.id || !candidate.sharerUserId) return false;

  const transaction = await sql.transaction([
    sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 83))', [
      candidate.sharerUserId,
    ]),
    sql.query(
      `
        WITH converted AS (
          UPDATE ranking_share_referrals referral
          SET
            converted_at = now(),
            converted_by_user_id = $2::uuid,
            converted_by_device_id = $3
          WHERE referral.id = $1::uuid
            AND referral.converted_at IS NULL
          RETURNING referral.id, referral.sharer_user_id, referral.ranking_id
        ),
        eligible AS (
          SELECT converted.*
          FROM converted
          WHERE (
            SELECT COUNT(*)
            FROM user_score_events event
            WHERE event.user_id = converted.sharer_user_id
              AND event.event_type = 'qualified_share'
              AND (event.created_at AT TIME ZONE 'America/Sao_Paulo')::date
                = (now() AT TIME ZONE 'America/Sao_Paulo')::date
          ) < $5::int
        )
        INSERT INTO user_score_events (
          user_id, event_type, event_key, ranking_id, points, created_at
        )
        SELECT
          eligible.sharer_user_id,
          'qualified_share',
          eligible.id::text,
          eligible.ranking_id,
          $4,
          now()
        FROM eligible
        ON CONFLICT (user_id, event_type, event_key) DO NOTHING
        RETURNING id
      `,
      [
        candidate.id,
        voterUserId,
        deviceId,
        PARTICIPATION_SCORE.qualifiedShare,
        PARTICIPATION_SCORE.qualifiedSharesPerDay,
      ],
    ),
  ]);

  return Boolean(transaction[1]?.[0]?.id);
}
