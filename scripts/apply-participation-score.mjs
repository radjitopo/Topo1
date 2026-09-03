import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements.mjs';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const sql = neon(process.env.DATABASE_URL);
const migration = await readFile(
  new URL('../migrations/20260903_participation_score.sql', import.meta.url),
  'utf8',
);

await sql.transaction(
  splitSqlStatements(migration).map((statement) => sql.query(statement)),
  { isolationLevel: 'Serializable' },
);

const [validation] = await sql.query(`
  SELECT
    to_regclass('public.user_score_events') IS NOT NULL AS score_events_table,
    to_regclass('public.ranking_share_referrals') IS NOT NULL AS share_referrals_table,
    COUNT(*) FILTER (WHERE event_type = 'direct_vote')::int AS direct_vote_events,
    COUNT(*) FILTER (WHERE event_type = 'completed_duel')::int AS completed_duel_events,
    COUNT(*) FILTER (WHERE event_type = 'ranking_participation')::int AS ranking_events,
    COUNT(*) FILTER (WHERE event_type = 'active_day')::int AS active_day_events
  FROM user_score_events
`);

if (!validation?.score_events_table || !validation?.share_referrals_table) {
  throw new Error(`Participation score validation failed: ${JSON.stringify(validation)}`);
}

console.log('Participation score tables, backfill and share attribution applied and validated.');
