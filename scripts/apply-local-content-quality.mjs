import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

const exclusions = JSON.parse(
  await readFile(new URL('../data/local-option-exclusions.json', import.meta.url), 'utf8'),
);
const rows = Object.entries(exclusions).flatMap(([rankingId, labels]) =>
  labels.map((label) => ({ rankingId, label })),
);
const payload = JSON.stringify(rows).replaceAll("'", "''");
const incoming = `
  SELECT *
  FROM jsonb_to_recordset('${payload}'::jsonb) AS excluded(
    "rankingId" text,
    label text
  )
`;

const statements = [
  `DO $$
  BEGIN
    IF EXISTS (
      WITH excluded AS (${incoming})
      SELECT 1
      FROM excluded
      JOIN ranking_options option
        ON option.ranking_id = excluded."rankingId"
       AND option.label = excluded.label
      WHERE EXISTS (SELECT 1 FROM votes vote WHERE vote.option_id = option.id)
         OR EXISTS (SELECT 1 FROM user_double_votes vote WHERE vote.option_id = option.id)
    ) THEN
      RAISE EXCEPTION 'A curadoria encontrou opção com voto e foi interrompida.';
    END IF;
  END $$;`,
  `UPDATE rankings
   SET question = 'Qual é o melhor restaurante vegano em ' || category || '?'
   WHERE is_active = true
     AND id LIKE 'restaurantes-veganos-%';`,
  `WITH excluded AS (${incoming})
   DELETE FROM ranking_options option
   USING excluded
   WHERE option.ranking_id = excluded."rankingId"
     AND option.label = excluded.label;`,
  `DO $$
  BEGIN
    IF EXISTS (
      WITH excluded AS (${incoming})
      SELECT 1
      FROM excluded
      JOIN ranking_options option
        ON option.ranking_id = excluded."rankingId"
       AND option.label = excluded.label
    ) THEN
      RAISE EXCEPTION 'Ainda há opções excluídas no catálogo.';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM rankings ranking
      LEFT JOIN ranking_options option ON option.ranking_id = ranking.id
      WHERE ranking.is_active = true
        AND ranking.id IN (
          SELECT DISTINCT excluded."rankingId"
          FROM (${incoming}) excluded
        )
      GROUP BY ranking.id
      HAVING COUNT(option.id) < 5
    ) THEN
      RAISE EXCEPTION 'A curadoria deixou ranking com menos de 5 opções.';
    END IF;
  END $$;`,
];

if (process.argv.includes('--sql')) {
  process.stdout.write(JSON.stringify(statements));
} else {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const sql = neon(process.env.DATABASE_URL);
  await sql.transaction(
    statements.map((statement) => sql.query(statement)),
    {
      isolationLevel: 'Serializable',
    },
  );
  console.log(`Curadoria aplicada: ${rows.length} opções locais excluídas.`);
}
