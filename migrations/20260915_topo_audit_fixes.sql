DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'option_relevance_review_archive_change_kind_check'
      AND conrelid = 'option_relevance_review_archive'::regclass
  ) THEN
    ALTER TABLE option_relevance_review_archive
      DROP CONSTRAINT option_relevance_review_archive_change_kind_check;
  END IF;

  ALTER TABLE option_relevance_review_archive
    ADD CONSTRAINT option_relevance_review_archive_change_kind_check
    CHECK (change_kind IN ('replacement', 'rename', 'removal'));
END $$;
