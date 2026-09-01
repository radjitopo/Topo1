import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-statements.mjs';

const sqlOutputMode = process.argv.includes('--sql');

if (!sqlOutputMode && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const [review, archiveMigration] = await Promise.all([
  readFile(new URL('../data/vegan-floripa-refresh.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../migrations/20260901_option_relevance_review.sql', import.meta.url), 'utf8'),
]);

const renameOldLabels = review.renames.map((change) => change.oldLabel);
const renameNewLabels = review.renames.map((change) => change.newLabel);
const currentLabels = [...renameOldLabels, ...review.removedOptions];

if (
  !review.reviewKey ||
  review.rankingId !== 'restaurantes-veganos-floripa' ||
  !review.question ||
  review.options.length !== 20 ||
  new Set(review.options).size !== 20 ||
  review.renames.length !== 10 ||
  review.removedOptions.length !== 4 ||
  review.newOptions.length !== 4 ||
  new Set(currentLabels).size !== currentLabels.length ||
  new Set(renameNewLabels).size !== renameNewLabels.length ||
  review.renames.some(
    (change) =>
      !change.oldLabel ||
      !change.newLabel ||
      change.oldLabel === change.newLabel ||
      !review.options.includes(change.newLabel),
  ) ||
  review.newOptions.some((label) => !review.options.includes(label)) ||
  review.removedOptions.some((label) => review.options.includes(label)) ||
  review.options.some((label) => !label || label.trim() !== label)
) {
  throw new Error('Invalid vegan/vegetarian Florianópolis refresh data');
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function values(rows) {
  return rows.map((row) => `(${row.map(quote).join(', ')})`).join(',\n');
}

const rankingId = quote(review.rankingId);
const reviewKey = quote(review.reviewKey);
const question = quote(review.question);
const desiredValues = review.options
  .map((label, index) => `(${index + 1}, ${quote(label)})`)
  .join(',\n');
const renameValues = values(review.renames.map((change) => [change.oldLabel, change.newLabel]));
const removedValues = values(review.removedOptions.map((label) => [label]));
const newValues = values(review.newOptions.map((label) => [label]));
const setupStatements = splitSqlStatements(archiveMigration);

const refreshStatements = [
  `CREATE TEMP TABLE vegan_floripa_desired (
     position integer PRIMARY KEY,
     label text NOT NULL UNIQUE
   ) ON COMMIT DROP`,
  `INSERT INTO vegan_floripa_desired (position, label) VALUES\n${desiredValues}`,
  `CREATE TEMP TABLE vegan_floripa_renames (
     old_label text PRIMARY KEY,
     new_label text NOT NULL UNIQUE
   ) ON COMMIT DROP`,
  `INSERT INTO vegan_floripa_renames (old_label, new_label) VALUES\n${renameValues}`,
  `CREATE TEMP TABLE vegan_floripa_removed (
     label text PRIMARY KEY
   ) ON COMMIT DROP`,
  `INSERT INTO vegan_floripa_removed (label) VALUES\n${removedValues}`,
  `CREATE TEMP TABLE vegan_floripa_new (
     label text PRIMARY KEY
   ) ON COMMIT DROP`,
  `INSERT INTO vegan_floripa_new (label) VALUES\n${newValues}`,
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
     ) THEN
       IF NOT EXISTS (
         SELECT 1 FROM rankings
         WHERE id = ${rankingId} AND is_active = true AND is_vip = false
       ) THEN
         RAISE EXCEPTION 'O ranking público vegano de Florianópolis não está ativo.';
       END IF;

       IF (SELECT COUNT(*) FROM ranking_options WHERE ranking_id = ${rankingId}) <> 20 THEN
         RAISE EXCEPTION 'A atualização esperava exatamente 20 opções antigas.';
       END IF;

       IF EXISTS (
         SELECT rename.old_label
         FROM vegan_floripa_renames rename
         LEFT JOIN ranking_options option
           ON option.ranking_id = ${rankingId}
          AND option.label = rename.old_label
         GROUP BY rename.old_label
         HAVING COUNT(option.id) <> 1
       ) OR EXISTS (
         SELECT removed.label
         FROM vegan_floripa_removed removed
         LEFT JOIN ranking_options option
           ON option.ranking_id = ${rankingId}
          AND option.label = removed.label
         GROUP BY removed.label
         HAVING COUNT(option.id) <> 1
       ) THEN
         RAISE EXCEPTION 'A lista atual não corresponde à base esperada para a atualização.';
       END IF;

       IF EXISTS (
         SELECT 1
         FROM vegan_floripa_renames rename
         JOIN ranking_options option
           ON option.ranking_id = ${rankingId}
          AND option.label = rename.new_label
       ) THEN
         RAISE EXCEPTION 'Uma renomeação criaria opção duplicada.';
       END IF;
     END IF;
   END $$`,
  `CREATE TEMP TABLE vegan_floripa_changed_options ON COMMIT DROP AS
   SELECT
     option.id,
     option.ranking_id,
     option.label AS old_label,
     COALESCE(rename.new_label, '[removida da seleção]') AS new_label,
     CASE WHEN rename.old_label IS NULL THEN 'replacement' ELSE 'rename' END AS change_kind,
     option.position,
     option.baseline_score
   FROM ranking_options option
   LEFT JOIN vegan_floripa_renames rename ON rename.old_label = option.label
   LEFT JOIN vegan_floripa_removed removed ON removed.label = option.label
   WHERE option.ranking_id = ${rankingId}
     AND (rename.old_label IS NOT NULL OR removed.label IS NOT NULL)
     AND NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
     )`,
  `INSERT INTO option_relevance_review_archive (
     review_key, option_id, ranking_id, old_label, new_label, change_kind,
     previous_position, baseline_score, live_votes, double_votes, vote_history,
     duel_entries, top3_selections, comments, source_url
   )
   SELECT
     ${reviewKey}, changed.id, changed.ranking_id, changed.old_label,
     changed.new_label, changed.change_kind, changed.position, changed.baseline_score,
     (SELECT COUNT(*)::int FROM votes vote WHERE vote.option_id = changed.id),
     (SELECT COUNT(*)::int FROM user_double_votes vote WHERE vote.option_id = changed.id),
     (SELECT COUNT(*)::int FROM user_vote_history history WHERE history.option_id = changed.id),
     (SELECT COUNT(*)::int FROM ranking_duel_entries entry WHERE entry.option_id = changed.id),
     (SELECT COUNT(*)::int FROM ranking_top3_selections selection WHERE selection.option_id = changed.id),
     (SELECT COUNT(*)::int FROM ranking_comments comment WHERE comment.option_id = changed.id),
     NULL
   FROM vegan_floripa_changed_options changed
   ON CONFLICT (review_key, option_id) DO NOTHING`,
  `UPDATE ranking_duel_rounds round
   SET champion_before_option_id = CASE
         WHEN round.champion_before_option_id IN (
           SELECT id FROM vegan_floripa_changed_options WHERE change_kind = 'replacement'
         ) THEN NULL
         ELSE round.champion_before_option_id
       END,
       champion_after_option_id = CASE
         WHEN round.champion_after_option_id IN (
           SELECT id FROM vegan_floripa_changed_options WHERE change_kind = 'replacement'
         ) THEN NULL
         ELSE round.champion_after_option_id
       END
   WHERE round.ranking_id = ${rankingId}
     AND (
       round.champion_before_option_id IN (
         SELECT id FROM vegan_floripa_changed_options WHERE change_kind = 'replacement'
       )
       OR round.champion_after_option_id IN (
         SELECT id FROM vegan_floripa_changed_options WHERE change_kind = 'replacement'
       )
     )`,
  `DELETE FROM public_option_target_additions addition
   USING vegan_floripa_changed_options changed
   WHERE changed.change_kind = 'replacement'
     AND addition.option_id = changed.id`,
  `DELETE FROM ranking_options option
   USING vegan_floripa_changed_options changed
   WHERE changed.change_kind = 'replacement'
     AND option.id = changed.id
     AND option.ranking_id = ${rankingId}`,
  `UPDATE ranking_options option
   SET label = rename.new_label
   FROM vegan_floripa_renames rename
   WHERE option.ranking_id = ${rankingId}
     AND option.label = rename.old_label
     AND NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
     )`,
  `UPDATE ranking_options option
   SET position = option.position + 1000000
   WHERE option.ranking_id = ${rankingId}
     AND NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
     )`,
  `INSERT INTO ranking_options (ranking_id, label, position, baseline_score)
   SELECT ${rankingId}, desired.label, desired.position, 0
   FROM vegan_floripa_desired desired
   WHERE NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
     )
     AND NOT EXISTS (
       SELECT 1 FROM ranking_options option
       WHERE option.ranking_id = ${rankingId} AND option.label = desired.label
     )
   ORDER BY desired.position`,
  `UPDATE ranking_options option
   SET position = desired.position
   FROM vegan_floripa_desired desired
   WHERE option.ranking_id = ${rankingId}
     AND option.label = desired.label
     AND NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
     )`,
  `UPDATE public_option_target_additions addition
   SET label = option.label
   FROM ranking_options option
   WHERE addition.option_id = option.id
     AND option.ranking_id = ${rankingId}
     AND NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
     )`,
  `INSERT INTO public_option_target_additions (
     migration_key, option_id, ranking_id, label, source
   )
   SELECT ${reviewKey}, option.id, option.ranking_id, option.label, 'editorial_expansion'
   FROM ranking_options option
   JOIN vegan_floripa_new fresh ON fresh.label = option.label
   WHERE option.ranking_id = ${rankingId}
     AND NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
     )
   ON CONFLICT (option_id) DO UPDATE
   SET migration_key = EXCLUDED.migration_key,
       ranking_id = EXCLUDED.ranking_id,
       label = EXCLUDED.label,
       source = EXCLUDED.source`,
  `UPDATE rankings
   SET question = ${question},
       is_active = true,
       content_updated_at = now()
   WHERE id = ${rankingId}
     AND NOT EXISTS (
       SELECT 1 FROM option_relevance_review_state WHERE review_key = ${reviewKey}
     )`,
  `INSERT INTO option_relevance_review_state (review_key, summary)
   SELECT
     ${reviewKey},
     jsonb_build_object(
       'ranking_id', ${rankingId},
       'new_options', 4,
       'removed_options', 4,
       'renamed_options', 10,
       'preserved_direct_votes', COALESCE(SUM(archive.live_votes)
         FILTER (WHERE archive.change_kind = 'rename'), 0),
       'removed_direct_votes', COALESCE(SUM(archive.live_votes)
         FILTER (WHERE archive.change_kind = 'replacement'), 0),
       'removed_double_votes', COALESCE(SUM(archive.double_votes)
         FILTER (WHERE archive.change_kind = 'replacement'), 0),
       'removed_vote_history', COALESCE(SUM(archive.vote_history)
         FILTER (WHERE archive.change_kind = 'replacement'), 0),
       'removed_duel_entries', COALESCE(SUM(archive.duel_entries)
         FILTER (WHERE archive.change_kind = 'replacement'), 0)
     )
   FROM option_relevance_review_archive archive
   WHERE archive.review_key = ${reviewKey}
   ON CONFLICT (review_key) DO NOTHING`,
  `DO $$
   BEGIN
     IF (SELECT COUNT(*) FROM ranking_options WHERE ranking_id = ${rankingId}) <> 20 OR
        (SELECT COUNT(DISTINCT label) FROM ranking_options WHERE ranking_id = ${rankingId}) <> 20 OR
        EXISTS (
          SELECT 1
          FROM vegan_floripa_desired desired
          LEFT JOIN ranking_options option
            ON option.ranking_id = ${rankingId}
           AND option.position = desired.position
           AND option.label = desired.label
          WHERE option.id IS NULL
        ) OR
        (SELECT question FROM rankings WHERE id = ${rankingId}) <> ${question} THEN
       RAISE EXCEPTION 'A lista final ficou incompleta, fora de ordem ou com título incorreto.';
     END IF;

     IF EXISTS (
       SELECT 1
       FROM option_relevance_review_archive archive
       LEFT JOIN ranking_options option ON option.id = archive.option_id
       WHERE archive.review_key = ${reviewKey}
         AND archive.change_kind = 'rename'
         AND (
           option.id IS NULL OR
           option.label <> archive.new_label OR
           archive.live_votes <> (SELECT COUNT(*) FROM votes vote WHERE vote.option_id = option.id) OR
           archive.double_votes <> (SELECT COUNT(*) FROM user_double_votes vote WHERE vote.option_id = option.id) OR
           archive.vote_history <> (SELECT COUNT(*) FROM user_vote_history history WHERE history.option_id = option.id) OR
           archive.duel_entries <> (SELECT COUNT(*) FROM ranking_duel_entries entry WHERE entry.option_id = option.id) OR
           archive.top3_selections <> (SELECT COUNT(*) FROM ranking_top3_selections selection WHERE selection.option_id = option.id) OR
           archive.comments <> (SELECT COUNT(*) FROM ranking_comments comment WHERE comment.option_id = option.id)
         )
     ) THEN
       RAISE EXCEPTION 'A atualização não preservou toda a participação das opções mantidas.';
     END IF;

     IF EXISTS (
       SELECT 1
       FROM option_relevance_review_archive archive
       WHERE archive.review_key = ${reviewKey}
         AND archive.change_kind = 'replacement'
         AND (
           EXISTS (SELECT 1 FROM ranking_options option WHERE option.id = archive.option_id) OR
           EXISTS (SELECT 1 FROM votes vote WHERE vote.option_id = archive.option_id) OR
           EXISTS (SELECT 1 FROM user_double_votes vote WHERE vote.option_id = archive.option_id) OR
           EXISTS (SELECT 1 FROM user_vote_history history WHERE history.option_id = archive.option_id) OR
           EXISTS (SELECT 1 FROM ranking_duel_entries entry WHERE entry.option_id = archive.option_id) OR
           EXISTS (SELECT 1 FROM ranking_top3_selections selection WHERE selection.option_id = archive.option_id) OR
           EXISTS (SELECT 1 FROM ranking_comments comment WHERE comment.option_id = archive.option_id) OR
           EXISTS (SELECT 1 FROM public_option_target_additions addition WHERE addition.option_id = archive.option_id)
         )
     ) THEN
       RAISE EXCEPTION 'Uma opção removida ainda possui dados ativos.';
     END IF;
   END $$`,
];

if (sqlOutputMode) {
  process.stdout.write(JSON.stringify([...setupStatements, ...refreshStatements]));
  process.exit(0);
}

const sql = neon(process.env.DATABASE_URL);
await sql.transaction(
  [...setupStatements, ...refreshStatements].map((statement) => sql.query(statement)),
  { isolationLevel: 'Serializable' },
);

const [validation] = await sql.query(
  `SELECT
     (SELECT COUNT(*)::int FROM ranking_options WHERE ranking_id = $1) AS option_count,
     (SELECT question FROM rankings WHERE id = $1) AS question,
     (SELECT summary FROM option_relevance_review_state WHERE review_key = $2) AS summary`,
  [review.rankingId, review.reviewKey],
);

if (
  Number(validation?.option_count) !== 20 ||
  validation?.question !== review.question ||
  !validation?.summary
) {
  throw new Error(
    `Vegan/vegetarian Florianópolis refresh validation failed: ${JSON.stringify(validation)}`,
  );
}

console.log(
  `Ranking vegano/vegetariano de Florianópolis atualizado: ${validation.option_count} opções.`,
);
