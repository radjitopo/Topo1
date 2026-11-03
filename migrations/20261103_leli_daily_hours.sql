ALTER TABLE public.leli_users
  ADD COLUMN IF NOT EXISTS daily_work_minutes integer NOT NULL DEFAULT 480
  CONSTRAINT leli_users_daily_work_minutes_check
  CHECK (daily_work_minutes BETWEEN 60 AND 720 AND daily_work_minutes % 15 = 0);
