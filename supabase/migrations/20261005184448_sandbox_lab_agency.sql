-- "Laboratório": a separate agency (tenant) for testing flows. Row-level security already isolates every agency, so
-- nothing created there is visible to the real team, syncs with the real Agenda, or touches its scoring/notifications.
alter table public.agencies add column if not exists is_sandbox boolean not null default false;

do $$
declare
  v_lab uuid;
  v_src uuid;
begin
  select id into v_lab from public.agencies where slug = 'laboratorio';
  if v_lab is null then
    insert into public.agencies (name, slug, status, is_sandbox)
    values ('Laboratório', 'laboratorio', 'trial', true)
    returning id into v_lab;   -- the agencies trigger seeds the stage catalog and the default cascade
  end if;

  -- own settings row (distinct look so it is never confused with the real agency)
  insert into public.app_settings (id, agency_id, workspace_name, brand_color)
  select coalesce((select max(id) from public.app_settings), 0) + 1, v_lab, 'Laboratório', '#0e7490'
  where not exists (select 1 from public.app_settings where agency_id = v_lab);

  -- same default flow as the real agency, to start from
  select agency_id into v_src from public.pm_stage_flows where is_default and agency_id <> v_lab order by created_at limit 1;
  if v_src is not null and not exists (select 1 from public.pm_stage_flows where agency_id = v_lab) then
    insert into public.pm_stage_flows (name, flow_config, transition_dates, stage_assignees, is_default, agency_id, created_by)
    select name, flow_config, transition_dates, '{}'::jsonb, true, v_lab, created_by
    from public.pm_stage_flows where agency_id = v_src and is_default limit 1;
  end if;

  -- a few test clients
  insert into public.clients (name, is_active, agency_id, magic_due_date)
  select n, true, v_lab, date '2026-10-27'
  from (values ('Cliente Teste 1'), ('Cliente Teste 2'), ('Cliente Teste 3')) v(n)
  where not exists (select 1 from public.clients c where c.agency_id = v_lab and c.name = v.n);
end $$;
