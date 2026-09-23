BEGIN;

CREATE TABLE IF NOT EXISTS leli_schedules (
  user_id uuid NOT NULL REFERENCES leli_users(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  break_start_time time NOT NULL,
  break_end_time time NOT NULL,
  end_time time NOT NULL,
  updated_by uuid REFERENCES leli_users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, weekday)
);

COMMIT;
