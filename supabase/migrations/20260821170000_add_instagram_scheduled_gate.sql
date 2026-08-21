-- Instagram auto-publish (the cron in instagram-publish/run_schedules) currently fires purely
-- off publish_date/publish_time being in the past — nothing requires a human to have actually
-- confirmed that this specific publication should go out automatically. Filling in a date just
-- to organize the Cronograma calendar was enough to make something eligible.
--
-- This adds an explicit opt-in gate: the cron now also requires instagram_scheduled = true,
-- set either individually (per-publication "Agendar" button) or in bulk (a cycle-wide "Agendar
-- publicações" action) — both introduced in the same change as this migration.
alter table public.calendar_publications
  add column instagram_scheduled boolean not null default false;

comment on column public.calendar_publications.instagram_scheduled is
  'Team explicitly confirmed this publication is cleared for the Instagram auto-publish cron to pick up at its publish_date/publish_time. Required in addition to publish_date/publish_time being set and in the past.';
