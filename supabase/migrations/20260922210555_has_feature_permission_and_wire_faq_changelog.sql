-- Reusable check mirroring src/hooks/use-permission.ts's usePermission(): admin always passes;
-- otherwise it's whatever role/cargo an admin configured for this key at Configurações →
-- Permissões (feature_permissions). No matching row = false (nobody but admin), same default
-- the frontend hook uses. SECURITY DEFINER so a regular caller's own RLS on user_roles/profiles
-- doesn't need to independently allow reading rows this check needs to look at.
create or replace function public.has_feature_permission(_user_id uuid, _key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _perm record;
  _role_title text;
begin
  if public.has_role(_user_id, 'admin'::app_role) then
    return true;
  end if;

  select allowed_roles, allowed_cargos into _perm
  from public.feature_permissions
  where key = _key;

  if not found then
    return false;
  end if;

  if exists (
    select 1 from public.user_roles ur
    where ur.user_id = _user_id and ur.role = any(_perm.allowed_roles)
  ) then
    return true;
  end if;

  select p.role_title into _role_title from public.profiles p where p.user_id = _user_id;
  if _role_title is null then
    select tm.role_title into _role_title from public.team_members tm where tm.user_id = _user_id;
  end if;

  if _role_title is not null and exists (
    select 1 from unnest(_perm.allowed_cargos) c where lower(trim(c)) = lower(trim(_role_title))
  ) then
    return true;
  end if;

  return false;
end;
$$;

revoke execute on function public.has_feature_permission(uuid, text) from anon;

drop policy "Developers manage changelog entries" on public.help_changelog_entries;
create policy "Permission-gated manage changelog entries"
  on public.help_changelog_entries for all
  using (public.has_feature_permission(auth.uid(), 'action_manage_changelog'))
  with check (public.has_feature_permission(auth.uid(), 'action_manage_changelog'));

drop policy "Developers manage faq items" on public.help_faq_items;
create policy "Permission-gated manage faq items"
  on public.help_faq_items for all
  using (public.has_feature_permission(auth.uid(), 'action_manage_faq'))
  with check (public.has_feature_permission(auth.uid(), 'action_manage_faq'));
