-- drive-file-proxy's own module-level token cache (comment in the function explains why
-- it was added) turns out to rarely help in practice: Supabase Edge Functions don't
-- reliably reuse the same warm isolate between separate client requests, so nearly every
-- real request was paying a fresh ~250ms Google OAuth round-trip on top of the Drive
-- fetch itself — directly adding to how long a client waits for a video to start playing
-- on the public Cronograma approval link.
--
-- A DB-backed cache survives across isolates/cold starts, so any invocation anywhere can
-- reuse a still-valid token with one fast Postgres read instead of a network round-trip
-- to Google. RLS is enabled with zero policies (default-deny for anon/authenticated) since
-- only the edge function's service-role client should ever touch this — it holds a live
-- Google API credential.
create table public.drive_oauth_token_cache (
  id int primary key default 1,
  access_token text not null,
  expires_at timestamptz not null,
  constraint drive_oauth_token_cache_singleton check (id = 1)
);

alter table public.drive_oauth_token_cache enable row level security;
