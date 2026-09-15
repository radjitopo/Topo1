import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements.mjs';

const sqlOutputMode = process.argv.includes('--sql');

if (!sqlOutputMode && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const [cafes, fixes, optionArchiveMigration, coverArchiveMigration, auditMigration] =
  await Promise.all([
    readFile(new URL('../data/cafes-floripa-refresh.json', import.meta.url), 'utf8').then(
      JSON.parse,
    ),
    readFile(new URL('../data/topo-audit-fixes-20260915.json', import.meta.url), 'utf8').then(
      JSON.parse,
    ),
    readFile(
      new URL('../migrations/20260901_option_relevance_review.sql', import.meta.url),
      'utf8',
    ),
    readFile(new URL('../migrations/20260901_ranking_cover_review.sql', import.meta.url), 'utf8'),
    readFile(new URL('../migrations/20260915_topo_audit_fixes.sql', import.meta.url), 'utf8'),
  ]);

if (
  cafes.rankingId !== 'cafes-floripa' ||
  cafes.options.length !== 20 ||
  new Set(cafes.options).size !== 20 ||
  !fixes.cafesReviewKey ||
  fixes.unexpectedCafeOptions.length !== 6 ||
  new Set(fixes.unexpectedCafeOptions).size !== 6 ||
  fixes.unexpectedCafeOptions.some((label) => cafes.options.includes(label)) ||
  !fixes.coverReviewKey ||
  fixes.covers.length !== 2 ||
  new Set(fixes.covers.map(({ rankingId }) => rankingId)).size !== 2 ||
  fixes.covers.some(
    (cover) =>
      !cover.rankingId ||
      !cover.replacement.startsWith('https://images.unsplash.com/') ||
      !cover.sourcePage.startsWith('https://unsplash.com/photos/') ||
      cover.license !== 'Unsplash License' ||
      !cover.reason,
  )
) {
  throw new Error('Invalid TOPO audit fix data');
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const rankingId = quote(cafes.rankingId);
const cafesReviewKey = quote(fixes.cafesReviewKey);
const coverReviewKey = quote(fixes.coverReviewKey);
const desiredCafeValues = cafes.options
  .map((label, index) => `(${index + 1}, ${quote(label)})`)
  .join(',\n');
const unexpectedCafeValues = fixes.unexpectedCafeOptions
  .map((label) => `(${quote(label)})`)
  .join(',\n');
const coverValues = fixes.covers
  .map(
    (cover) =>
      `(${[cover.rankingId, cover.replacement, cover.sourcePage, cover.license, cover.reason]
        .map(quote)
        .join(', ')})`,
  )
  .join(',\n');

const setupStatements = [
  ...splitSqlStatements(optionArchiveMigration),
  ...splitSqlStatements(coverArchiveMigration),
  ...splitSqlStatements(auditMigration),
];

const fixStatements = [
  `CREATE TEMP TABLE cafes_floripa_desired (
     position integer PRIMARY KEY,
     label text NOT NULL UNIQUE
   ) ON COMMIT DROP`,
  `INSERT INTO cafes_floripa_desired (position, label) VALUES\n${desiredCafeValues}`,
  `CREATE TEMP TABLE cafes_floripa_unexpected (
     label text PRIMARY KEY
   ) ON COMMIT DROP`,
  `INSERT INTO cafes_floripa_unexpected (label) VALUES\n${unexpectedCafeValues}`,
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${cafesReviewKey}
     ) THEN
       IF NOT EXISTS (
         SELECT 1 FROM rankings
         WHERE id = ${rankingId} AND is_active = true AND is_vip = false
       ) THEN
         RAISE EXCEPTION 'O ranking público cafes-floripa não está ativo.';
       END IF;

       IF (SELECT COUNT(*) FROM ranking_options WHERE ranking_id = ${rankingId}) <> 24 OR
          (SELECT COUNT(*)
             FROM ranking_options option
             JOIN cafes_floripa_desired desired ON desired.label = option.label
            WHERE option.ranking_id = ${rankingId}) <> 18 OR
          (SELECT COUNT(*)
             FROM ranking_options option
             JOIN cafes_floripa_unexpected unexpected ON unexpected.label = option.label
            WHERE option.ranking_id = ${rankingId}) <> 6 THEN
         RAISE EXCEPTION 'A lista de cafés mudou desde a auditoria; nenhuma opção foi alterada.';
       END IF;
     END IF;
   END $$`,
  `CREATE TEMP TABLE cafes_options_to_remove ON COMMIT DROP AS
   SELECT option.*
   FROM ranking_options option
   JOIN cafes_floripa_unexpected unexpected ON unexpected.label = option.label
   WHERE option.ranking_id = ${rankingId}
     AND NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${cafesReviewKey}
     )`,
  `CREATE TEMP TABLE cafes_sessions_to_reset ON COMMIT DROP AS
   SELECT DISTINCT round.session_id AS id
   FROM ranking_duel_rounds round
   JOIN ranking_duel_entries entry ON entry.round_id = round.id
   JOIN cafes_options_to_remove removed ON removed.id = entry.option_id
   WHERE round.ranking_id = ${rankingId}
   UNION
   SELECT session.id
   FROM ranking_duel_sessions session
   JOIN cafes_options_to_remove removed ON removed.id = session.champion_option_id
   WHERE session.ranking_id = ${rankingId}`,
  `CREATE TEMP TABLE cafes_duel_reset_snapshot ON COMMIT DROP AS
   SELECT
     (SELECT COUNT(*)::int FROM cafes_sessions_to_reset) AS sessions,
     (SELECT COUNT(*)::int
        FROM ranking_duel_rounds round
       WHERE round.session_id IN (SELECT id FROM cafes_sessions_to_reset)) AS rounds,
     (SELECT COUNT(*)::int
        FROM ranking_duel_entries entry
        JOIN ranking_duel_rounds round ON round.id = entry.round_id
       WHERE round.session_id IN (SELECT id FROM cafes_sessions_to_reset)) AS entries`,
  `CREATE TEMP TABLE cafes_kept_participation ON COMMIT DROP AS
   SELECT
     option.id,
     (SELECT COUNT(*)::int FROM votes vote WHERE vote.option_id = option.id) AS votes,
     (SELECT COUNT(*)::int FROM user_double_votes vote WHERE vote.option_id = option.id) AS double_votes,
     (SELECT COUNT(*)::int FROM user_vote_history history WHERE history.option_id = option.id) AS vote_history,
     (SELECT COUNT(*)::int FROM ranking_top3_selections selection WHERE selection.option_id = option.id) AS top3_selections,
     (SELECT COUNT(*)::int FROM ranking_comments comment WHERE comment.option_id = option.id) AS comments
   FROM ranking_options option
   JOIN cafes_floripa_desired desired ON desired.label = option.label
   WHERE option.ranking_id = ${rankingId}
     AND NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${cafesReviewKey}
     )`,
  `INSERT INTO option_relevance_review_archive (
     review_key, option_id, ranking_id, old_label, new_label, change_kind,
     previous_position, baseline_score, live_votes, double_votes, vote_history,
     duel_entries, top3_selections, comments, source_url
   )
   SELECT
     ${cafesReviewKey}, removed.id, removed.ranking_id, removed.label, '', 'removal',
     removed.position, removed.baseline_score,
     (SELECT COUNT(*)::int FROM votes vote WHERE vote.option_id = removed.id),
     (SELECT COUNT(*)::int FROM user_double_votes vote WHERE vote.option_id = removed.id),
     (SELECT COUNT(*)::int FROM user_vote_history history WHERE history.option_id = removed.id),
     (SELECT COUNT(*)::int FROM ranking_duel_entries entry WHERE entry.option_id = removed.id),
     (SELECT COUNT(*)::int FROM ranking_top3_selections selection WHERE selection.option_id = removed.id),
     (SELECT COUNT(*)::int FROM ranking_comments comment WHERE comment.option_id = removed.id),
     'internal:topo-audit-20260915'
   FROM cafes_options_to_remove removed
   ON CONFLICT (review_key, option_id) DO NOTHING`,
  `DELETE FROM ranking_duel_sessions session
   USING cafes_sessions_to_reset affected
   WHERE session.id = affected.id`,
  `UPDATE ranking_options option
   SET position = option.position + 1000
   WHERE option.ranking_id = ${rankingId}
     AND EXISTS (SELECT 1 FROM cafes_floripa_desired desired WHERE desired.label = option.label)
     AND NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${cafesReviewKey}
     )`,
  `DELETE FROM ranking_options option
   USING cafes_options_to_remove removed
   WHERE option.id = removed.id`,
  `UPDATE ranking_options option
   SET position = desired.position
   FROM cafes_floripa_desired desired
   WHERE option.ranking_id = ${rankingId}
     AND option.label = desired.label
     AND NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${cafesReviewKey}
     )`,
  `INSERT INTO ranking_options (ranking_id, label, position, baseline_score)
   SELECT ${rankingId}, desired.label, desired.position, 0
   FROM cafes_floripa_desired desired
   WHERE NOT EXISTS (
     SELECT 1
     FROM ranking_options option
     WHERE option.ranking_id = ${rankingId} AND option.label = desired.label
   )
     AND NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${cafesReviewKey}
     )
   ORDER BY desired.position`,
  `UPDATE rankings
   SET question = ${quote(cafes.question)}, content_updated_at = now()
   WHERE id = ${rankingId}
     AND NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${cafesReviewKey}
     )`,
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${cafesReviewKey}
     ) AND (
       (SELECT COUNT(*) FROM cafes_kept_participation) <> 18 OR
       (SELECT COUNT(*)
          FROM cafes_kept_participation before
          JOIN ranking_options option ON option.id = before.id) <> 18 OR
       EXISTS (
         SELECT 1
         FROM cafes_kept_participation before
         JOIN ranking_options option ON option.id = before.id
         WHERE before.votes <> (SELECT COUNT(*)::int FROM votes vote WHERE vote.option_id = option.id)
            OR before.double_votes <> (SELECT COUNT(*)::int FROM user_double_votes vote WHERE vote.option_id = option.id)
            OR before.vote_history <> (SELECT COUNT(*)::int FROM user_vote_history history WHERE history.option_id = option.id)
            OR before.top3_selections <> (SELECT COUNT(*)::int FROM ranking_top3_selections selection WHERE selection.option_id = option.id)
            OR before.comments <> (SELECT COUNT(*)::int FROM ranking_comments comment WHERE comment.option_id = option.id)
       )
     ) THEN
       RAISE EXCEPTION 'A participação dos 18 cafés preservados foi alterada.';
     END IF;
   END $$`,
  `INSERT INTO option_relevance_review_state (review_key, summary)
   SELECT
     ${cafesReviewKey},
     jsonb_build_object(
       'ranking_id', ${rankingId},
       'preserved_options', 18,
       'added_options', 2,
       'removed_options', (SELECT COUNT(*) FROM option_relevance_review_archive archive WHERE archive.review_key = ${cafesReviewKey}),
       'removed_direct_votes', COALESCE((SELECT SUM(archive.live_votes) FROM option_relevance_review_archive archive WHERE archive.review_key = ${cafesReviewKey}), 0),
       'removed_double_votes', COALESCE((SELECT SUM(archive.double_votes) FROM option_relevance_review_archive archive WHERE archive.review_key = ${cafesReviewKey}), 0),
       'removed_vote_history', COALESCE((SELECT SUM(archive.vote_history) FROM option_relevance_review_archive archive WHERE archive.review_key = ${cafesReviewKey}), 0),
       'removed_duel_entries', COALESCE((SELECT SUM(archive.duel_entries) FROM option_relevance_review_archive archive WHERE archive.review_key = ${cafesReviewKey}), 0),
       'removed_top3_selections', COALESCE((SELECT SUM(archive.top3_selections) FROM option_relevance_review_archive archive WHERE archive.review_key = ${cafesReviewKey}), 0),
       'removed_comments', COALESCE((SELECT SUM(archive.comments) FROM option_relevance_review_archive archive WHERE archive.review_key = ${cafesReviewKey}), 0),
       'reset_duel_sessions', snapshot.sessions,
       'reset_duel_rounds', snapshot.rounds,
       'reset_duel_entries', snapshot.entries
     )
   FROM cafes_duel_reset_snapshot snapshot
   WHERE NOT EXISTS (
     SELECT 1 FROM option_relevance_review_state WHERE review_key = ${cafesReviewKey}
   )
   ON CONFLICT (review_key) DO NOTHING`,
  `CREATE TEMP TABLE missing_cover_changes (
     ranking_id text PRIMARY KEY,
     replacement text NOT NULL,
     source_page text NOT NULL,
     license text NOT NULL,
     reason text NOT NULL
   ) ON COMMIT DROP`,
  `INSERT INTO missing_cover_changes (
     ranking_id, replacement, source_page, license, reason
   ) VALUES\n${coverValues}`,
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM ranking_cover_review_state WHERE review_key = ${coverReviewKey}
     ) AND EXISTS (
       SELECT 1
       FROM missing_cover_changes change
       LEFT JOIN rankings ranking ON ranking.id = change.ranking_id
       WHERE ranking.id IS NULL OR ranking.is_active = false OR ranking.is_vip = true
     ) THEN
       RAISE EXCEPTION 'Uma capa aponta para um ranking que não é público e ativo.';
     END IF;
   END $$`,
  `CREATE TEMP TABLE missing_cover_matches ON COMMIT DROP AS
   SELECT change.*, COALESCE(ranking.image_url, '') AS previous_image_url
   FROM missing_cover_changes change
   JOIN rankings ranking ON ranking.id = change.ranking_id
   WHERE COALESCE(ranking.image_url, '') = ''
     AND NOT EXISTS (
       SELECT 1 FROM ranking_cover_review_state WHERE review_key = ${coverReviewKey}
     )`,
  `INSERT INTO ranking_cover_review_archive (
     review_key, ranking_id, previous_image_url, replacement_image_url,
     source_page, license, reason
   )
   SELECT
     ${coverReviewKey}, match.ranking_id, match.previous_image_url, match.replacement,
     match.source_page, match.license, match.reason
   FROM missing_cover_matches match
   ON CONFLICT (review_key, ranking_id) DO NOTHING`,
  `UPDATE rankings ranking
   SET image_url = match.replacement, content_updated_at = now()
   FROM missing_cover_matches match
   WHERE ranking.id = match.ranking_id`,
  `INSERT INTO ranking_cover_review_state (review_key, summary)
   SELECT
     ${coverReviewKey},
     jsonb_build_object(
       'reviewed', (SELECT COUNT(*) FROM missing_cover_changes),
       'changed', (SELECT COUNT(*) FROM missing_cover_matches),
       'preserved_existing',
         (SELECT COUNT(*) FROM missing_cover_changes) -
         (SELECT COUNT(*) FROM missing_cover_matches)
     )
   WHERE NOT EXISTS (
     SELECT 1 FROM ranking_cover_review_state WHERE review_key = ${coverReviewKey}
   )
   ON CONFLICT (review_key) DO NOTHING`,
  `DO $$
   BEGIN
     IF (SELECT COUNT(*) FROM ranking_options WHERE ranking_id = ${rankingId}) <> 20 OR
        EXISTS (
          SELECT 1
          FROM cafes_floripa_desired desired
          LEFT JOIN ranking_options option
            ON option.ranking_id = ${rankingId}
           AND option.label = desired.label
           AND option.position = desired.position
          WHERE option.id IS NULL
        ) THEN
       RAISE EXCEPTION 'A lista final de cafés ficou incompleta ou fora de ordem.';
     END IF;

     IF EXISTS (
       SELECT 1
       FROM missing_cover_changes change
       JOIN rankings ranking ON ranking.id = change.ranking_id
       WHERE ranking.image_url IS DISTINCT FROM change.replacement
     ) THEN
       RAISE EXCEPTION 'Uma das capas ausentes não foi corrigida.';
     END IF;
   END $$`,
];

if (sqlOutputMode) {
  process.stdout.write(JSON.stringify([...setupStatements, ...fixStatements]));
  process.exit(0);
}

const sql = neon(process.env.DATABASE_URL);
await sql.transaction(
  [...setupStatements, ...fixStatements].map((statement) => sql.query(statement)),
  { isolationLevel: 'Serializable' },
);

const [validation] = await sql.query(
  `SELECT
     (SELECT COUNT(*)::int FROM ranking_options WHERE ranking_id = $1) AS cafe_options,
     (SELECT summary FROM option_relevance_review_state WHERE review_key = $2) AS cafe_summary,
     (SELECT summary FROM ranking_cover_review_state WHERE review_key = $3) AS cover_summary`,
  [cafes.rankingId, fixes.cafesReviewKey, fixes.coverReviewKey],
);

if (
  Number(validation?.cafe_options) !== 20 ||
  Number(validation?.cafe_summary?.removed_options) !== 6 ||
  Number(validation?.cover_summary?.changed) !== 2
) {
  throw new Error(`TOPO audit fix validation failed: ${JSON.stringify(validation)}`);
}

console.log(
  `Auditoria corrigida: ${validation.cafe_options} cafés e ${validation.cover_summary.changed} capas restauradas.`,
);
