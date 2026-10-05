-- SaaS onboarding: an agency owner signs up on their own (trial), becomes the admin of a brand-new agency, and invites
-- the team through single-use links. Strangers no longer land in the Uau Digital approval queue.

alter table public.agencies
  add column if not exists trial_ends_at timestamptz,
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists max_seats integer,
  add column if not exists onboarded_at timestamptz;

-- Existing agencies (Uau Digital, Laboratório) are already set up.
update public.agencies set onboarded_at = now() where onboarded_at is null;

-- Owner / invite signups must not create a "pending approval" request.
create or replace function public.handle_new_user_access_request() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(new.raw_user_meta_data->>'signup_type', '') in ('owner', 'invite') then
    return new;
  end if;
  insert into public.access_requests (user_id, note, status)
  values (new.id, new.email, 'pending')
  on conflict do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Shared helper: make `p_user` a member of `p_agency` (profile + public team row + role + approved access request).
-- Internal only (called by the RPCs below).
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.attach_user_to_agency(
  p_user uuid, p_agency uuid, p_full_name text, p_role public.app_role, p_role_titles text[]
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_titles text[];
begin
  select coalesce(array_agg(c.label order by c.order_index), '{}') into v_titles
  from public.cargos c
  where c.agency_id = p_agency and c.is_active and c.label = any (coalesce(p_role_titles, '{}'));

  if exists (select 1 from public.profiles where user_id = p_user) then
    update public.profiles set agency_id = p_agency, full_name = p_full_name, role_titles = v_titles where user_id = p_user;
  else
    insert into public.profiles (user_id, full_name, role_title, role_titles, agency_id)
    values (p_user, p_full_name, '', v_titles, p_agency);
  end if;

  if exists (select 1 from public.team_members where user_id = p_user) then
    update public.team_members
       set agency_id = p_agency, display_name = p_full_name, role_titles = v_titles, is_active = true
     where user_id = p_user;
  else
    insert into public.team_members (user_id, display_name, role_title, role_titles, is_active, agency_id)
    values (p_user, p_full_name, '', v_titles, true, p_agency);
  end if;

  insert into public.user_roles (user_id, role) values (p_user, p_role) on conflict (user_id, role) do nothing;

  if exists (select 1 from public.access_requests where user_id = p_user) then
    update public.access_requests
       set status = 'approved', decided_at = now(), agency_id = p_agency
     where user_id = p_user;
  else
    insert into public.access_requests (user_id, status, decided_at, agency_id, note)
    values (p_user, 'approved', now(), p_agency, 'self-service');
  end if;
end;
$$;
revoke all on function public.attach_user_to_agency(uuid, uuid, text, public.app_role, text[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Owner signup: creates the agency (14-day trial) and makes the caller its admin. Idempotent.
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.create_my_agency(p_agency_name text, p_full_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_agency_name, ''));
  v_full text := btrim(coalesce(p_full_name, ''));
  v_agency uuid;
  v_base text;
  v_slug text;
  v_n int := 1;
  v_src uuid;
  v_cargo text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select agency_id into v_agency from public.profiles where user_id = v_uid;
  if v_agency is not null then return v_agency; end if;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then raise exception 'invalid_agency_name'; end if;
  if char_length(v_full) < 2 or char_length(v_full) > 80 then raise exception 'invalid_name'; end if;

  v_base := trim(both '-' from regexp_replace(lower(extensions.unaccent(v_name)), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then v_base := 'agencia'; end if;
  v_slug := v_base;
  while exists (select 1 from public.agencies where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  insert into public.agencies (name, slug, status, trial_ends_at, owner_id, max_seats)
  values (v_name, v_slug, 'trial', now() + interval '14 days', v_uid, 5)
  returning id into v_agency;   -- the agencies trigger seeds the stage catalog and the default cascade

  -- first role title for the owner
  v_cargo := 'gestao-' || substr(md5(v_agency::text), 1, 8);
  insert into public.cargos (key, label, order_index, is_active, agency_id)
  values (v_cargo, 'Gestão', 0, true, v_agency);

  perform public.attach_user_to_agency(v_uid, v_agency, v_full, 'admin', array['Gestão']);

  insert into public.app_settings (id, agency_id, workspace_name)
  select coalesce((select max(id) from public.app_settings), 0) + 1, v_agency, v_name;

  -- start from the platform's default flow (structure only — no assignees)
  select f.agency_id into v_src
  from public.pm_stage_flows f join public.agencies a on a.id = f.agency_id
  where f.is_default and a.slug = 'uau-digital' limit 1;
  if v_src is not null then
    insert into public.pm_stage_flows (name, flow_config, transition_dates, stage_assignees, is_default, agency_id, created_by)
    select name, flow_config, transition_dates, '{}'::jsonb, true, v_agency, v_uid
    from public.pm_stage_flows where agency_id = v_src and is_default limit 1;
  end if;

  return v_agency;
end;
$$;
revoke all on function public.create_my_agency(text, text) from public, anon;
grant execute on function public.create_my_agency(text, text) to authenticated;

create or replace function public.complete_onboarding() returns void
language sql security definer set search_path = '' as $$
  update public.agencies set onboarded_at = now()
  where id = (select public.current_agency_id()) and owner_id = (select auth.uid()) and onboarded_at is null
$$;
revoke all on function public.complete_onboarding() from public, anon;
grant execute on function public.complete_onboarding() to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Invites
-- ---------------------------------------------------------------------------------------------------------------
create table if not exists public.agency_invites (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'collaborator',
  role_titles text[] not null default '{}',
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz
);
create unique index if not exists agency_invites_open_email_idx
  on public.agency_invites (agency_id, lower(email)) where accepted_at is null and revoked_at is null;
create index if not exists agency_invites_agency_idx on public.agency_invites (agency_id);

alter table public.agency_invites enable row level security;
revoke all on table public.agency_invites from anon, authenticated;
grant select on public.agency_invites to authenticated;
create policy "agency_invites_admin_select" on public.agency_invites
  for select to authenticated
  using (agency_id = (select public.current_agency_id()) and public.has_role((select auth.uid()), 'admin'::public.app_role));

create or replace function public.create_agency_invite(
  p_email text, p_role public.app_role default 'collaborator', p_role_titles text[] default '{}'
) returns table (id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_agency uuid := (select public.current_agency_id());
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_max int;
  v_used int;
  v_titles text[];
begin
  if v_uid is null or v_agency is null then raise exception 'not_authenticated'; end if;
  if not public.has_role(v_uid, 'admin'::public.app_role) then raise exception 'forbidden'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 255 then raise exception 'invalid_email'; end if;

  if exists (
    select 1 from auth.users u join public.profiles p on p.user_id = u.id
    where lower(u.email) = v_email and p.agency_id is not null
  ) then
    raise exception 'email_unavailable';
  end if;

  select a.max_seats into v_max from public.agencies a where a.id = v_agency;
  if v_max is not null then
    select (select count(*) from public.team_members t where t.agency_id = v_agency and t.is_active)
         + (select count(*) from public.agency_invites i
             where i.agency_id = v_agency and i.accepted_at is null and i.revoked_at is null
               and i.expires_at > now() and lower(i.email) <> v_email)
      into v_used;
    if v_used >= v_max then raise exception 'seat_limit'; end if;
  end if;

  select coalesce(array_agg(c.label order by c.order_index), '{}') into v_titles
  from public.cargos c where c.agency_id = v_agency and c.is_active and c.label = any (coalesce(p_role_titles, '{}'));

  update public.agency_invites i set revoked_at = now()
   where i.agency_id = v_agency and lower(i.email) = v_email and i.accepted_at is null and i.revoked_at is null;

  return query
    insert into public.agency_invites as ai (agency_id, email, role, role_titles, invited_by)
    values (v_agency, v_email, p_role, v_titles, v_uid)
    returning ai.id, ai.token, ai.expires_at;
end;
$$;
revoke all on function public.create_agency_invite(text, public.app_role, text[]) from public, anon;
grant execute on function public.create_agency_invite(text, public.app_role, text[]) to authenticated;

create or replace function public.revoke_agency_invite(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role((select auth.uid()), 'admin'::public.app_role) then raise exception 'forbidden'; end if;
  update public.agency_invites set revoked_at = now()
   where id = p_id and agency_id = (select public.current_agency_id()) and accepted_at is null and revoked_at is null;
end;
$$;
revoke all on function public.revoke_agency_invite(uuid) from public, anon;
grant execute on function public.revoke_agency_invite(uuid) to authenticated;

-- Public: what the invite page shows before the person has an account.
create or replace function public.get_invite_preview(p_token text)
returns table (agency_name text, logo_url text, email text, role public.app_role, status text)
language sql stable security definer set search_path = '' as $$
  select a.name,
         (select coalesce(s.sidebar_logo_dark_url, s.sidebar_logo_url) from public.app_settings s where s.agency_id = a.id),
         i.email, i.role,
         case when i.revoked_at is not null then 'revoked'
              when i.accepted_at is not null then 'accepted'
              when i.expires_at <= now() then 'expired'
              else 'valid' end
  from public.agency_invites i join public.agencies a on a.id = i.agency_id
  where i.token = p_token
$$;
revoke all on function public.get_invite_preview(text) from public;
grant execute on function public.get_invite_preview(text) to anon, authenticated;

create or replace function public.accept_agency_invite(p_token text, p_full_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_full text := btrim(coalesce(p_full_name, ''));
  v_inv public.agency_invites%rowtype;
  v_current uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_uid;

  select * into v_inv from public.agency_invites where token = p_token for update;
  if not found then raise exception 'invite_not_found'; end if;
  if v_inv.accepted_at is not null then
    if v_inv.accepted_by = v_uid then return v_inv.agency_id; end if;
    raise exception 'invite_used';
  end if;
  if v_inv.revoked_at is not null then raise exception 'invite_revoked'; end if;
  if v_inv.expires_at <= now() then raise exception 'invite_expired'; end if;
  if lower(v_inv.email) <> v_email then raise exception 'email_mismatch'; end if;
  if char_length(v_full) < 2 or char_length(v_full) > 80 then raise exception 'invalid_name'; end if;

  select agency_id into v_current from public.profiles where user_id = v_uid;
  if v_current is not null and v_current <> v_inv.agency_id then raise exception 'already_in_other_agency'; end if;

  perform public.attach_user_to_agency(v_uid, v_inv.agency_id, v_full, v_inv.role, v_inv.role_titles);
  update public.agency_invites set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  return v_inv.agency_id;
end;
$$;
revoke all on function public.accept_agency_invite(text, text) from public, anon;
grant execute on function public.accept_agency_invite(text, text) to authenticated;
