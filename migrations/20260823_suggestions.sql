CREATE TABLE IF NOT EXISTS ranking_option_suggestions (
  id uuid PRIMARY KEY,
  ranking_id text NOT NULL REFERENCES rankings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label text NOT NULL,
  normalized_label text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  flag_reason text,
  approved_option_id bigint REFERENCES ranking_options(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  moderation_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CONSTRAINT ranking_option_suggestions_label_length
    CHECK (char_length(btrim(label)) BETWEEN 2 AND 80),
  CONSTRAINT ranking_option_suggestions_status
    CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ranking_option_suggestions_pending_unique
  ON ranking_option_suggestions (ranking_id, normalized_label)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS ranking_option_suggestions_user_recent_idx
  ON ranking_option_suggestions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ranking_option_suggestions_queue_idx
  ON ranking_option_suggestions (status, created_at);

CREATE TABLE IF NOT EXISTS ranking_topic_suggestions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  normalized_title text NOT NULL,
  category text NOT NULL,
  example_options jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  flag_reason text,
  published_ranking_id text REFERENCES rankings(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  moderation_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CONSTRAINT ranking_topic_suggestions_title_length
    CHECK (char_length(btrim(title)) BETWEEN 8 AND 120),
  CONSTRAINT ranking_topic_suggestions_category_length
    CHECK (char_length(btrim(category)) BETWEEN 2 AND 50),
  CONSTRAINT ranking_topic_suggestions_examples
    CHECK (
      jsonb_typeof(example_options) = 'array'
      AND jsonb_array_length(example_options) BETWEEN 3 AND 20
    ),
  CONSTRAINT ranking_topic_suggestions_status
    CHECK (status IN ('pending', 'approved', 'rejected', 'published'))
);

DO $$
DECLARE
  current_definition text;
BEGIN
  SELECT pg_get_constraintdef(oid)
  INTO current_definition
  FROM pg_constraint
  WHERE conrelid = 'ranking_topic_suggestions'::regclass
    AND conname = 'ranking_topic_suggestions_examples';

  IF current_definition IS NOT NULL
     AND position('20' in current_definition) = 0 THEN
    ALTER TABLE ranking_topic_suggestions
      DROP CONSTRAINT ranking_topic_suggestions_examples;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'ranking_topic_suggestions'::regclass
      AND conname = 'ranking_topic_suggestions_examples'
  ) THEN
    ALTER TABLE ranking_topic_suggestions
      ADD CONSTRAINT ranking_topic_suggestions_examples
      CHECK (
        jsonb_typeof(example_options) = 'array'
        AND jsonb_array_length(example_options) BETWEEN 3 AND 20
      );
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS ranking_topic_suggestions_pending_unique
  ON ranking_topic_suggestions (normalized_title)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS ranking_topic_suggestions_user_recent_idx
  ON ranking_topic_suggestions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ranking_topic_suggestions_queue_idx
  ON ranking_topic_suggestions (status, created_at);
