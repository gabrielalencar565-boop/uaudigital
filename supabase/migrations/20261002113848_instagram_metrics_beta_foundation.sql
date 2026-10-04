-- Trava por usuário (não por cargo/role): admin NÃO passa automaticamente aqui, só quem tem linha.
create table public.beta_feature_access (
  feature text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (feature, user_id)
);
alter table public.beta_feature_access enable row level security;
create policy "beta_feature_access_select_own" on public.beta_feature_access
  for select to authenticated
  using (user_id = (select auth.uid()));

create function public.has_beta_access(_feature text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.beta_feature_access
    where feature = _feature and user_id = (select auth.uid())
  );
$$;
revoke execute on function public.has_beta_access(text) from public, anon;
grant execute on function public.has_beta_access(text) to authenticated;

insert into public.beta_feature_access (feature, user_id)
values ('resultados', 'e674c34f-b268-4dfd-82c5-9aea9cba853e');

create table public.instagram_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id),
  client_id uuid not null references public.clients(id) on delete cascade,
  snapshot_date date not null,
  followers_count integer,
  reach integer,
  accounts_engaged integer,
  total_interactions integer,
  created_at timestamptz not null default now(),
  unique (client_id, snapshot_date)
);
create index instagram_metric_snapshots_agency_id_idx on public.instagram_metric_snapshots (agency_id);

create table public.instagram_media_insights (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id),
  client_id uuid not null references public.clients(id) on delete cascade,
  ig_media_id text not null,
  publication_id uuid references public.calendar_publications(id) on delete set null,
  content_type text,
  posted_at timestamptz,
  permalink text,
  reach integer,
  likes integer,
  comments integer,
  saves integer,
  shares integer,
  total_interactions integer,
  captured_at timestamptz not null default now(),
  unique (client_id, ig_media_id)
);
create index instagram_media_insights_agency_id_idx on public.instagram_media_insights (agency_id);
create index instagram_media_insights_client_id_idx on public.instagram_media_insights (client_id);

alter table public.instagram_metric_snapshots enable row level security;
alter table public.instagram_media_insights enable row level security;

-- Leitura só pra quem está no beta e na mesma agência; escrita só via service role (edge function).
create policy "instagram_metric_snapshots_select_beta" on public.instagram_metric_snapshots
  for select to authenticated
  using (public.has_beta_access('resultados') and agency_id = (select public.current_agency_id()));
create policy "instagram_media_insights_select_beta" on public.instagram_media_insights
  for select to authenticated
  using (public.has_beta_access('resultados') and agency_id = (select public.current_agency_id()));
