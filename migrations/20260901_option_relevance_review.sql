CREATE TABLE IF NOT EXISTS option_relevance_review_state (
  review_key text PRIMARY KEY,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS option_relevance_review_archive (
  review_key text NOT NULL,
  option_id bigint NOT NULL,
  ranking_id text NOT NULL,
  old_label text NOT NULL,
  new_label text NOT NULL,
  change_kind text NOT NULL CHECK (change_kind IN ('replacement', 'rename')),
  previous_position integer NOT NULL,
  baseline_score integer NOT NULL,
  live_votes integer NOT NULL,
  double_votes integer NOT NULL,
  vote_history integer NOT NULL,
  duel_entries integer NOT NULL,
  top3_selections integer NOT NULL,
  comments integer NOT NULL,
  source_url text,
  archived_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_key, option_id)
);

CREATE INDEX IF NOT EXISTS option_relevance_review_archive_ranking_idx
  ON option_relevance_review_archive (ranking_id, change_kind);
