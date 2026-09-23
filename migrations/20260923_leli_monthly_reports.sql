CREATE TABLE IF NOT EXISTS leli_schedule_versions (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES leli_users(id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by uuid REFERENCES leli_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, effective_from)
);

CREATE INDEX IF NOT EXISTS leli_schedule_versions_user_date_idx
  ON leli_schedule_versions(user_id, effective_from);

INSERT INTO leli_schedule_versions(user_id,effective_from,schedule)
SELECT s.user_id,
  min((s.updated_at AT TIME ZONE 'America/Sao_Paulo')::date),
  jsonb_agg(jsonb_build_object(
    'weekday',s.weekday,
    'start_time',to_char(s.start_time,'HH24:MI'),
    'break_start_time',to_char(s.break_start_time,'HH24:MI'),
    'break_end_time',to_char(s.break_end_time,'HH24:MI'),
    'end_time',to_char(s.end_time,'HH24:MI')
  ) ORDER BY s.weekday)
FROM leli_schedules s
WHERE NOT EXISTS (SELECT 1 FROM leli_schedule_versions v WHERE v.user_id=s.user_id)
GROUP BY s.user_id;
