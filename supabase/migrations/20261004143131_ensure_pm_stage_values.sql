-- pm_tasks.stage_current / pm_subtasks.stage are a Postgres enum (pm_stage). Custom stages created by an agency owner
-- need their key registered in that enum before a task can sit in them. Admin-only; values can't be removed later
-- (harmless: an unused label), and the same key can be shared by several agencies.
create function public.ensure_pm_stage_values(p_keys text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'not allowed';
  end if;
  foreach k in array coalesce(p_keys, '{}'::text[]) loop
    if k !~ '^[a-z][a-z0-9_]{1,40}$' then
      raise exception 'invalid stage key: %', k;
    end if;
    if not exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'pm_stage' and e.enumlabel = k
    ) then
      execute format('alter type public.pm_stage add value %L', k);
    end if;
  end loop;
end $$;
revoke all on function public.ensure_pm_stage_values(text[]) from public, anon;
grant execute on function public.ensure_pm_stage_values(text[]) to authenticated;
