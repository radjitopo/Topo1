import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements.mjs';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const sql = neon(process.env.DATABASE_URL);
const migrations = await Promise.all(
  [
    '20260828_voting_modes.sql',
    '20260829_winner_stays.sql',
    '20260829_single_duel_play.sql',
    '20260829_duel_bonus_four.sql',
  ].map((filename) => readFile(new URL(`../migrations/${filename}`, import.meta.url), 'utf8')),
);

await sql.transaction(
  migrations.flatMap((migration) =>
    splitSqlStatements(migration).map((statement) => sql.query(statement)),
  ),
  { isolationLevel: 'Serializable' },
);

const [validation] = await sql.query(`
  SELECT
    to_regclass('public.ranking_top3_selections') IS NOT NULL AS top3_table,
    to_regclass('public.ranking_duel_rounds') IS NOT NULL AS duel_rounds_table,
    to_regclass('public.ranking_duel_entries') IS NOT NULL AS duel_entries_table,
    to_regclass('public.ranking_duel_sessions') IS NOT NULL AS duel_sessions_table,
    to_regclass('public.ranking_duel_session_user_ranking_unique_idx') IS NOT NULL
      AS duel_session_user_index,
    to_regclass('public.ranking_duel_session_device_ranking_unique_idx') IS NOT NULL
      AS duel_session_device_index,
    to_regclass('public.ranking_duel_session_pot_unique_idx') IS NOT NULL
      AS duel_session_pot_index,
    to_regclass('public.ranking_duel_option_bonuses') IS NOT NULL
      AS duel_bonus_view,
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ranking_duel_rounds'
        AND column_name = 'session_id'
    ) AS duel_round_session_column,
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ranking_duel_sessions'
        AND column_name = 'order_seed'
    ) AS duel_session_order_seed_column
`);

if (
  !validation?.top3_table ||
  !validation?.duel_rounds_table ||
  !validation?.duel_entries_table ||
  !validation?.duel_sessions_table ||
  !validation?.duel_session_user_index ||
  !validation?.duel_session_device_index ||
  !validation?.duel_session_pot_index ||
  !validation?.duel_bonus_view ||
  !validation?.duel_round_session_column ||
  !validation?.duel_session_order_seed_column
) {
  throw new Error(`Voting modes schema validation failed: ${JSON.stringify(validation)}`);
}

console.log(
  'Single-play Ganha, Fica schema and 4-point hidden ranking bonus applied and validated.',
);
