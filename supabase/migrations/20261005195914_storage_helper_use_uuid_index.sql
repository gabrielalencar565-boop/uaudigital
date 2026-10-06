-- Compare uuids directly (index-friendly) instead of casting the column to text; the regex guard keeps the cast safe.
create or replace function public.storage_pm_path_in_my_agency(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when split_part(p_name, '/', 1) = 'thumbnails' then
      case when split_part(p_name, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then exists (select 1 from public.pm_tasks t
                     where t.id = split_part(p_name, '/', 2)::uuid and t.agency_id = (select public.current_agency_id()))
        else false end
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      exists (select 1 from public.profiles p
              where p.user_id = split_part(p_name, '/', 1)::uuid and p.agency_id = (select public.current_agency_id()))
    else false
  end
$$;
