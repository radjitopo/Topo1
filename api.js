import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const deviceId =
        typeof req.query.device_id === 'string'
          ? req.query.device_id.slice(0, 100)
          : '';

      const rows = await sql.query(`
        SELECT
          r.id AS ranking_id,
          r.category,
          r.question,
          r.image_url,
          r.baseline_votes,
          o.id AS option_id,
          o.label,
          o.position,
          o.baseline_score + COALESCE(SUM(v.direction), 0)::int AS score,
          COUNT(v.option_id)::int AS live_votes,
          MAX(CASE WHEN v.device_id = $1 THEN v.direction END)::int AS my_direction
        FROM rankings r
        JOIN ranking_options o ON o.ranking_id = r.id
        LEFT JOIN votes v ON v.option_id = o.id
        WHERE r.is_active = true
        GROUP BY
          r.id,
          r.category,
          r.question,
          r.image_url,
          r.baseline_votes,
          o.id,
          o.label,
          o.position,
          o.baseline_score
        ORDER BY r.created_at, o.position
      `, [deviceId]);

      const byId = new Map();

      for (const row of rows) {
        if (!byId.has(row.ranking_id)) {
          byId.set(row.ranking_id, {
            id: row.ranking_id,
            cat: row.category,
            q: row.question,
            img: row.image_url || null,
            votes: Number(row.baseline_votes),
            opts: []
          });
        }

        const ranking = byId.get(row.ranking_id);
        ranking.votes += Number(row.live_votes || 0);

        ranking.opts.push({
          id: Number(row.option_id),
          label: row.label,
          score: Number(row.score),
          originalPosition: Number(row.position),
          mine: Number(row.my_direction || 0)
        });
      }

      const data = [...byId.values()].map((ranking) => ({
        ...ranking,
        opts: ranking.opts.sort(
          (a, b) =>
            b.score - a.score ||
            a.originalPosition - b.originalPosition
        )
      }));

      return json(res, 200, data);
    }

    if (req.method === 'POST') {
      const body =
        typeof req.body === 'string'
          ? JSON.parse(req.body || '{}')
          : (req.body || {});

      const deviceId = String(body.device_id || '');
      const optionId = Number(body.option_id);
      const direction = Number(body.direction);

      if (
        !/^[a-zA-Z0-9-]{16,100}$/.test(deviceId) ||
        !Number.isInteger(optionId) ||
        ![-1, 0, 1].includes(direction)
      ) {
        return json(res, 400, { error: 'invalid_vote' });
      }

      if (direction === 0) {
        await sql.query(
          'DELETE FROM votes WHERE device_id = $1 AND option_id = $2',
          [deviceId, optionId]
        );
      } else {
        await sql.query(`
          INSERT INTO votes (device_id, option_id, direction, updated_at)
          VALUES ($1, $2, $3, now())
          ON CONFLICT (device_id, option_id)
          DO UPDATE SET
            direction = EXCLUDED.direction,
            updated_at = now()
        `, [deviceId, optionId, direction]);
      }

      const [row] = await sql.query(`
        SELECT
          o.baseline_score + COALESCE(SUM(v.direction), 0)::int AS score
        FROM ranking_options o
        LEFT JOIN votes v ON v.option_id = o.id
        WHERE o.id = $1
        GROUP BY o.id, o.baseline_score
      `, [optionId]);

      return json(res, 200, {
        ok: true,
        score: Number(row?.score || 0),
        direction
      });
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'database_error' });
  }
}
