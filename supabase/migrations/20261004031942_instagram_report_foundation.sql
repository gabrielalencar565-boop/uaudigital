alter table public.instagram_metric_snapshots
  add column views integer,
  add column profile_views integer,
  add column follower_delta integer;

-- Latest audience demographics per client (gender/age/city/country as {label: value} maps).
create table public.instagram_audience_snapshots (
  client_id uuid primary key references public.clients(id) on delete cascade,
  agency_id uuid not null references public.agencies(id),
  captured_at timestamptz not null default now(),
  gender jsonb,
  age jsonb,
  city jsonb,
  country jsonb
);
create index instagram_audience_snapshots_agency_id_idx on public.instagram_audience_snapshots (agency_id);
alter table public.instagram_audience_snapshots enable row level security;
create policy "instagram_audience_snapshots_select_beta" on public.instagram_audience_snapshots
  for select to authenticated
  using (public.has_beta_access('resultados') and agency_id = (select public.current_agency_id()));

-- One shareable report link per client. The public page reads through an edge function (service
-- role) by token, so there is deliberately no anon policy here.
create table public.instagram_report_links (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.current_agency_id() references public.agencies(id),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  period_days integer not null default 30 check (period_days in (7, 30, 90)),
  enabled boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index instagram_report_links_agency_id_idx on public.instagram_report_links (agency_id);
alter table public.instagram_report_links enable row level security;
create policy "instagram_report_links_beta_all" on public.instagram_report_links
  for all to authenticated
  using (public.has_beta_access('resultados') and agency_id = (select public.current_agency_id()))
  with check (public.has_beta_access('resultados') and agency_id = (select public.current_agency_id()));
