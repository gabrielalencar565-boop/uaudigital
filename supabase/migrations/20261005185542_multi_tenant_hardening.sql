-- Before a second real agency exists: roles, profiles and platform ops data must be scoped to the agency.
-- Until now an "admin" of ANY agency could manage ANY user's roles, every user could read every profile, and a
-- user could point their own profile at another agency.

-- Platform owner (distinct from an agency admin): sees platform-level data across agencies.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on table public.platform_admins from anon, authenticated;
create policy "platform_admins_self_select" on public.platform_admins
  for select to authenticated using (user_id = (select auth.uid()));
grant select on public.platform_admins to authenticated;

insert into public.platform_admins (user_id) values ('e674c34f-b268-4dfd-82c5-9aea9cba853e') on conflict do nothing;

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()))
$$;
grant execute on function public.is_platform_admin() to authenticated;

-- Is the given user in the caller's agency?
create or replace function public.same_agency(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = p_user and p.agency_id is not null and p.agency_id = public.current_agency_id()
  )
$$;
grant execute on function public.same_agency(uuid) to authenticated;

-- Infra health data: platform owner only.
drop policy "ops health admin read" on public.ops_db_health_snapshots;
create policy "ops health platform admin read" on public.ops_db_health_snapshots
  for select to authenticated using (public.is_platform_admin());
drop policy "ops top queries admin read" on public.ops_top_queries_snapshots;
create policy "ops top queries platform admin read" on public.ops_top_queries_snapshots
  for select to authenticated using (public.is_platform_admin());

-- Roles: an agency admin manages roles only of people in their own agency.
drop policy "Admins can manage roles_delete" on public.user_roles;
drop policy "Admins can manage roles_insert" on public.user_roles;
drop policy "Admins can manage roles_update" on public.user_roles;
drop policy "user_roles_select_combined" on public.user_roles;
create policy "user_roles_select_agency" on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or (public.has_role((select auth.uid()), 'admin'::public.app_role) and public.same_agency(user_id)));
create policy "user_roles_admin_insert" on public.user_roles
  for insert to authenticated
  with check (public.has_role((select auth.uid()), 'admin'::public.app_role) and public.same_agency(user_id));
create policy "user_roles_admin_update" on public.user_roles
  for update to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role) and public.same_agency(user_id))
  with check (public.has_role((select auth.uid()), 'admin'::public.app_role) and public.same_agency(user_id));
create policy "user_roles_admin_delete" on public.user_roles
  for delete to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role) and public.same_agency(user_id));

-- Profiles: readable inside the agency (plus your own); admins edit only their agency's; nobody can move a profile to
-- another agency from the client.
drop policy "profiles_select_combined" on public.profiles;
drop policy "Users can update their own profile" on public.profiles;
drop policy "Users can insert their own profile" on public.profiles;
create policy "profiles_select_agency" on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or agency_id = (select public.current_agency_id()));
create policy "profiles_update_own_or_admin" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()) or (public.has_role((select auth.uid()), 'admin'::public.app_role) and agency_id = (select public.current_agency_id())))
  with check (agency_id = (select public.current_agency_id()));
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (agency_id is null or agency_id = (select public.current_agency_id())));
