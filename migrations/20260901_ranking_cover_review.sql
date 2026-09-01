CREATE TABLE IF NOT EXISTS ranking_cover_review_state (
  review_key text PRIMARY KEY,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ranking_cover_review_archive (
  review_key text NOT NULL,
  ranking_id text NOT NULL,
  previous_image_url text NOT NULL,
  replacement_image_url text NOT NULL,
  source_page text,
  license text NOT NULL,
  reason text NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_key, ranking_id)
);

CREATE INDEX IF NOT EXISTS ranking_cover_review_archive_ranking_idx
  ON ranking_cover_review_archive (ranking_id, archived_at DESC);
