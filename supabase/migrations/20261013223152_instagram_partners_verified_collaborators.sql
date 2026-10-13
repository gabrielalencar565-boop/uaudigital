-- Collaborator @ confirmation. An Instagram collab invite goes to whoever owns the typed @ — a typo that happens to be a real
-- account invites the wrong person and nothing fails. So a collaborator @ only counts once someone confirmed it by looking at the
-- profile (agency-wide list below), or when it is the @ of one of the agency's own connected clients.

create table public.instagram_partners (
  agency_id uuid not null default public.current_agency_id() references public.agencies(id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9._]{1,30}$'),
  photo_url text,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (agency_id, username)
);
alter table public.instagram_partners enable row level security;
create policy instagram_partners_agency on public.instagram_partners for all to authenticated
  using (agency_id = public.current_agency_id())
  with check (agency_id = public.current_agency_id());

-- which of these @ are neither a confirmed partner nor one of the agency's own clients
create or replace function public.unverified_collaborators(p_agency uuid, p_names text[])
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(n order by n), '{}'::text[])
  from unnest(coalesce(p_names, '{}'::text[])) n
  where not exists (select 1 from public.instagram_partners p where p.agency_id = p_agency and p.username = n and p.verified_at is not null)
    and not exists (select 1 from public.instagram_connections ic where ic.agency_id = p_agency and lower(ic.instagram_username) = n);
$$;
revoke execute on function public.unverified_collaborators(uuid, text[]) from public, anon, authenticated;

-- a publication can't be scheduled with a collaborator nobody confirmed (covers the single and the whole-cycle "Agendar")
create or replace function public.calendar_publications_check_collaborators()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agency uuid;
  v_bad text[];
begin
  if new.instagram_scheduled is true and coalesce(array_length(new.collaborators, 1), 0) > 0
     and (tg_op = 'INSERT' or old.instagram_scheduled is distinct from true or old.collaborators is distinct from new.collaborators) then
    select c.agency_id into v_agency
    from public.publication_calendars pc join public.clients c on c.id = pc.client_id
    where pc.id = new.calendar_id;
    v_bad := public.unverified_collaborators(v_agency, new.collaborators);
    if coalesce(array_length(v_bad, 1), 0) > 0 then
      raise exception 'colaborador_nao_conferido: %', array_to_string(v_bad, ', ');
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.calendar_publications_check_collaborators() from public, anon, authenticated;

create trigger trg_calendar_publications_check_collaborators
before insert or update of instagram_scheduled, collaborators on public.calendar_publications
for each row execute function public.calendar_publications_check_collaborators();
