-- Perfil do mês (Estúdio do feed): como o perfil do cliente fica naquele mês (foto, nome, destaques e posts fixados).
-- É só uma prévia para a equipe montar o mês; não altera o Instagram. Um registro por cliente e mês.
-- Permissões iguais às do Cronograma (calendar_publications): a agência vê, altera e apaga; criar pede action_manage_publications.

create table public.client_profile_months (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.current_agency_id() references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  month date not null,
  photo_url text,
  display_name text,
  highlights jsonb not null default '[]'::jsonb, -- [{ "id", "title", "cover_url" }] na ordem em que aparecem
  pinned_publication_ids uuid[] not null default '{}',
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint client_profile_months_first_day check (extract(day from month) = 1),
  constraint client_profile_months_pinned_max check (cardinality(pinned_publication_ids) <= 3),
  constraint client_profile_months_highlights_list check (jsonb_typeof(highlights) = 'array'),
  constraint client_profile_months_client_month unique (client_id, month)
);

create index client_profile_months_agency_idx on public.client_profile_months (agency_id);

create function public.client_profile_months_touch() returns trigger
language plpgsql set search_path to '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
revoke execute on function public.client_profile_months_touch() from public, anon, authenticated;

create trigger trg_client_profile_months_touch before insert or update on public.client_profile_months
for each row execute function public.client_profile_months_touch();

alter table public.client_profile_months enable row level security;
revoke all on public.client_profile_months from anon;

create policy client_profile_months_select on public.client_profile_months for select to authenticated
  using (agency_id = (select public.current_agency_id()));

create policy client_profile_months_insert on public.client_profile_months for insert to authenticated
  with check (
    agency_id = (select public.current_agency_id())
    and (public.has_role((select auth.uid()), 'admin'::public.app_role) or public.has_feature_permission((select auth.uid()), 'action_manage_publications'))
    and exists (select 1 from public.clients c where c.id = client_id and c.agency_id = client_profile_months.agency_id)
  );

create policy client_profile_months_update on public.client_profile_months for update to authenticated
  using (agency_id = (select public.current_agency_id()))
  with check (
    agency_id = (select public.current_agency_id())
    and exists (select 1 from public.clients c where c.id = client_id and c.agency_id = client_profile_months.agency_id)
  );

create policy client_profile_months_delete on public.client_profile_months for delete to authenticated
  using (agency_id = (select public.current_agency_id()));
