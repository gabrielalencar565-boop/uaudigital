-- An agency can never be left without an administrator by removing or demoting the last one.
-- (Cascaded deletes, like deleting the whole user or agency, are not blocked: trigger depth > 1.)
create or replace function public.keep_one_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agency uuid;
begin
  if old.role <> 'admin' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'UPDATE' and new.role = 'admin' and new.user_id = old.user_id then
    return new;
  end if;
  if pg_trigger_depth() > 1 then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select p.agency_id into v_agency from public.profiles p where p.user_id = old.user_id;
  if v_agency is not null and not exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.user_id = ur.user_id
    where ur.role = 'admin' and p.agency_id = v_agency and ur.user_id <> old.user_id
  ) then
    raise exception 'last_admin' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger trg_keep_one_admin_delete
before delete on public.user_roles
for each row execute function public.keep_one_admin();

create trigger trg_keep_one_admin_update
before update of role, user_id on public.user_roles
for each row execute function public.keep_one_admin();

revoke execute on function public.keep_one_admin() from public, anon, authenticated;
