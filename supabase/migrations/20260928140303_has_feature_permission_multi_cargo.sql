create or replace function public.has_feature_permission(_user_id uuid, _key text)
returns boolean
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  _perm record;
  _role_titles text[];
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

  select p.role_titles into _role_titles from public.profiles p where p.user_id = _user_id;
  if _role_titles is null or array_length(_role_titles, 1) is null then
    select tm.role_titles into _role_titles from public.team_members tm where tm.user_id = _user_id;
  end if;

  if _role_titles is not null and exists (
    select 1 from unnest(_role_titles) mine
    where exists (select 1 from unnest(_perm.allowed_cargos) c where lower(trim(c)) = lower(trim(mine)))
  ) then
    return true;
  end if;

  return false;
end;
$function$;
