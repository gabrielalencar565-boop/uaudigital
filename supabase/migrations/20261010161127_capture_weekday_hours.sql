-- Working hours per weekday (e.g. Saturday only until noon): {"6": {"start": 8, "end": 12}}. A day missing from the map uses day_start_hour / day_end_hour.
alter table public.capture_settings
  add column weekday_hours jsonb not null default '{}'::jsonb check (jsonb_typeof(weekday_hours) = 'object');
