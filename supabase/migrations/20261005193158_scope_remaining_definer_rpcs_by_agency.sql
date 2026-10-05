-- Cross-agency audit of SECURITY DEFINER RPCs (they bypass RLS, so every one must scope itself to the caller's agency).
--
-- Conventions used below
--   * "backend caller" = auth.uid() IS NULL (pg_cron as postgres, edge functions as service_role, definer triggers fired by them).
--     anon can no longer reach any of these functions, so a NULL auth.uid() really means a trusted backend context.
--   * a signed-in user may only touch rows of his own agency (current_agency_id() / same_agency()).
--   * background jobs (cron) iterate over every agency that has its own settings and write agency_id explicitly,
--     because the column default current_agency_id() is NULL outside a user session (that is why the rows created by the
--     01/10 monthly cron got agency_id NULL and were invisible to RLS).

-- ---------------------------------------------------------------------------------------------------------------------
-- 0. internal helpers (not callable through the API)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public._caller_in_agency(_agency uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select auth.uid() is null or (_agency is not null and _agency = public.current_agency_id())
$$;

create or replace function public._caller_can_access_user(_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select auth.uid() is null or _user = auth.uid() or public.same_agency(_user)
$$;

create or replace function public._caller_can_access_pm_task(_pm_task uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select auth.uid() is null
      or not exists (select 1 from public.pm_tasks t where t.id = _pm_task and t.agency_id is distinct from public.current_agency_id())
$$;

revoke all on function public._caller_in_agency(uuid), public._caller_can_access_user(uuid), public._caller_can_access_pm_task(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. read-only RPCs that returned other agencies' data
-- ---------------------------------------------------------------------------------------------------------------------
-- admin role is global (user_roles has no agency), so "admin" alone returned the scores of every agency.
create or replace function public.get_performance_month_totals(_year integer)
returns table(user_id uuid, month integer, total numeric)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'forbidden';
  end if;

  return query
  select ps.user_id, ps.month,
         (ps.aprendizado_continuo + ps.padrao_qualidade_uau + ps.metas_prazos + ps.ambiente_organizado + ps.comprometimento) as total
  from public.performance_scores ps
  where ps.year = _year
    and ps.agency_id = public.current_agency_id()
  order by ps.month asc;
end;
$$;

create or replace function public.get_performance_year_summary(_year integer)
returns table(user_id uuid, total_year numeric, avg_month numeric, high_months integer)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'forbidden';
  end if;

  return query
  with month_totals as (
    select ps.user_id, ps.month,
           (ps.aprendizado_continuo + ps.padrao_qualidade_uau + ps.metas_prazos + ps.ambiente_organizado + ps.comprometimento) as total
    from public.performance_scores ps
    where ps.year = _year
      and ps.agency_id = public.current_agency_id()
  )
  select mt.user_id,
         coalesce(sum(mt.total), 0) as total_year,
         coalesce(avg(mt.total), 0) as avg_month,
         coalesce(sum(case when mt.total >= 7 then 1 else 0 end), 0)::int as high_months
  from month_totals mt
  group by mt.user_id
  order by total_year desc;
end;
$$;

-- an admin could read the XP of any user of any agency; the level table is per agency too.
create or replace function public.get_user_xp_summary(_user_id uuid)
returns table(total_earned integer, total_spent integer, available integer, current_level integer, current_level_name text,
              next_level integer, next_level_name text, next_level_xp integer)
language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_earned int := 0;
  v_spent int := 0;
  v_avail int := 0;
  v_lvl_num int := 0;
  v_lvl_name text;
  v_next_num int;
  v_next_name text;
  v_next_xp int;
  v_agency uuid;
begin
  if auth.uid() is null
     or (auth.uid() <> _user_id
         and not (public.has_role(auth.uid(), 'admin'::public.app_role) and public.same_agency(_user_id))) then
    raise exception 'forbidden';
  end if;

  select p.agency_id into v_agency from public.profiles p where p.user_id = _user_id;

  select coalesce(sum(amount), 0) into v_earned from public.user_xp_events where user_id = _user_id;
  select coalesce(sum(xp_spent), 0) into v_spent from public.reward_redemptions
    where user_id = _user_id and status in ('pendente','aprovado','entregue');
  v_avail := v_earned - v_spent;

  select level_number, name into v_lvl_num, v_lvl_name
  from public.reward_levels where xp_required <= v_earned and agency_id = v_agency
  order by xp_required desc limit 1;

  select level_number, name, xp_required into v_next_num, v_next_name, v_next_xp
  from public.reward_levels where xp_required > v_earned and agency_id = v_agency
  order by xp_required asc limit 1;

  total_earned := v_earned;
  total_spent := v_spent;
  available := v_avail;
  current_level := coalesce(v_lvl_num, 0);
  current_level_name := v_lvl_name;
  next_level := v_next_num;
  next_level_name := v_next_name;
  next_level_xp := v_next_xp;
  return next;
end;
$$;

-- client names / contract dates of other agencies (and callable by anon!)
create or replace function public.check_client_exists(_name text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.clients
    where lower(trim(name)) = lower(trim(_name))
      and agency_id = public.current_agency_id()
  )
$$;

create or replace function public.client_status_at(p_client uuid, p_year integer, p_month integer)
returns text language sql stable security definer set search_path to 'public' as $$
  select case
    when c.id is null then 'desconhecido'
    when c.contract_start is not null
         and make_date(p_year, p_month, 1) < date_trunc('month', c.contract_start::timestamp)::date
      then 'fora_periodo'
    when c.ended_at is not null
         and date_trunc('month', c.ended_at::timestamp)::date <= make_date(p_year, p_month, 1)
      then 'encerrado'
    when c.paused_from is not null
         and date_trunc('month', c.paused_from::timestamp)::date <= make_date(p_year, p_month, 1)
         and (c.resumed_from is null
              or date_trunc('month', c.resumed_from::timestamp)::date > make_date(p_year, p_month, 1))
      then 'pausado'
    else 'ativo'
  end
  from public.clients c
  where c.id = p_client
    and public._caller_in_agency(c.agency_id);
$$;

revoke execute on function public.check_client_exists(text), public.client_status_at(uuid, integer, integer) from public, anon;
grant execute on function public.check_client_exists(text), public.client_status_at(uuid, integer, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. write RPCs that accepted another agency's ids
-- ---------------------------------------------------------------------------------------------------------------------
-- Scoring engine: keep the original bodies as internal *_impl functions and put the agency check in a thin wrapper.
alter function public.recompute_all_scores(uuid, integer, integer) rename to _recompute_all_scores_impl;
alter function public.pm_recalc_tag_points(uuid) rename to _pm_recalc_tag_points_impl;
alter function public.pm_resync_correction(uuid, text) rename to _pm_resync_correction_impl;
alter function public.pm_sync_stage_completion(uuid, text, uuid, uuid[]) rename to _pm_sync_stage_completion_impl;

revoke all on function public._recompute_all_scores_impl(uuid, integer, integer),
                       public._pm_recalc_tag_points_impl(uuid),
                       public._pm_resync_correction_impl(uuid, text),
                       public._pm_sync_stage_completion_impl(uuid, text, uuid, uuid[])
  from public, anon, authenticated;

-- any signed-in user could recompute (and create a performance_scores row for) any user id of any agency.
-- recompute_metas_prazos only delegates here, so it is covered too.
create function public.recompute_all_scores(_user_id uuid, _year integer, _month integer)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if _user_id is null or not public._caller_can_access_user(_user_id) then
    raise exception 'forbidden';
  end if;
  perform public._recompute_all_scores_impl(_user_id, _year, _month);
end;
$$;

-- recalculates points of (and rescored users for) any pm task id
create function public.pm_recalc_tag_points(_pm_task_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public._caller_can_access_pm_task(_pm_task_id) then
    raise exception 'forbidden';
  end if;
  perform public._pm_recalc_tag_points_impl(_pm_task_id);
end;
$$;

-- deletes + recreates the score snapshot tasks of any pm task id
create function public.pm_resync_correction(_pm_task_id uuid, _completed_stage text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public._caller_can_access_pm_task(_pm_task_id) then
    raise exception 'forbidden';
  end if;
  perform public._pm_resync_correction_impl(_pm_task_id, _completed_stage);
end;
$$;

-- creates completed tasks (points) for arbitrary user ids, on any pm task id
create function public.pm_sync_stage_completion(_pm_task_id uuid, _completed_stage text, _user_id uuid default null, _scoring_user_ids uuid[] default null)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public._caller_can_access_pm_task(_pm_task_id) then
    raise exception 'forbidden';
  end if;
  if _user_id is not null and not public._caller_can_access_user(_user_id) then
    raise exception 'forbidden';
  end if;
  if _scoring_user_ids is not null and exists (
       select 1 from unnest(_scoring_user_ids) u where u is not null and not public._caller_can_access_user(u)) then
    raise exception 'forbidden';
  end if;
  perform public._pm_sync_stage_completion_impl(_pm_task_id, _completed_stage, _user_id, _scoring_user_ids);
end;
$$;

revoke all on function public.recompute_all_scores(uuid, integer, integer), public.pm_recalc_tag_points(uuid),
                       public.pm_resync_correction(uuid, text), public.pm_sync_stage_completion(uuid, text, uuid, uuid[])
  from public, anon;
grant execute on function public.recompute_all_scores(uuid, integer, integer), public.pm_recalc_tag_points(uuid),
                          public.pm_resync_correction(uuid, text), public.pm_sync_stage_completion(uuid, text, uuid, uuid[])
  to authenticated, service_role;

-- updated every task of every agency that lacked a point_value, by any signed-in user
create or replace function public.snapshot_unscored_tasks()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  v_count integer;
begin
  if auth.uid() is not null and not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'forbidden';
  end if;

  update public.tasks t
  set point_value = (
    coalesce(sc.base_points, 1)
    * case when coalesce(sc.uses_quantity, false) then coalesce(t.quantity, 1) else 1 end
    * case when t.is_extra_demand and coalesce(sc.uses_quantity, false)
           then coalesce(sc.extra_demand_multiplier, 1.5) else 1 end
  )
  from public.scoring_config sc
  where sc.stage = t.stage::text
    and t.status = 'concluido'
    and t.deleted_at is null
    and t.point_value is null
    and t.completed_at is not null
    and public._caller_in_agency(t.agency_id);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- toggled the stage of any client id, creating its cycle row under the caller's agency
create or replace function public.toggle_stage_tasks_checklist(_client_id uuid, _stage stage_type, _year integer, _month integer)
returns table(affected_tasks integer, new_status task_status, stage_completed boolean)
language plpgsql security definer set search_path to 'public' as $$
declare
  v_cycle_id uuid;
  v_agency uuid;
  current_stage_completed boolean;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select c.agency_id into v_agency from public.clients c where c.id = _client_id;
  if v_agency is null or v_agency is distinct from public.current_agency_id() then
    raise exception 'Unauthorized';
  end if;

  if _month < 1 or _month > 12 then
    raise exception 'Invalid month';
  end if;

  -- Garante ciclo
  select id into v_cycle_id
  from public.client_cycles
  where client_id = _client_id and year = _year and month = _month
  limit 1;

  if v_cycle_id is null then
    insert into public.client_cycles (client_id, year, month, due_date, agency_id)
    values (_client_id, _year, _month, make_date(_year, _month, 27), v_agency)
    returning id into v_cycle_id;
  end if;

  -- Toggle APENAS da etapa do ciclo (não mexe em tasks)
  select coalesce(completed, false)
  into current_stage_completed
  from public.client_cycle_stages
  where cycle_id = v_cycle_id and stage = _stage
  limit 1;

  stage_completed := not coalesce(current_stage_completed, false);
  new_status := case when stage_completed then 'concluido' else 'pendente' end;
  affected_tasks := 0;

  -- Legado (client_stages)
  update public.client_stages
  set
    completed = stage_completed,
    completed_at = case when stage_completed then now() else null end,
    completed_by = case when stage_completed then auth.uid() else null end,
    updated_at = now()
  where client_id = _client_id and stage = _stage;

  -- Upsert etapa do ciclo
  update public.client_cycle_stages
  set
    completed = stage_completed,
    completed_at = case when stage_completed then now() else null end,
    completed_by = case when stage_completed then auth.uid() else null end,
    updated_at = now()
  where public.client_cycle_stages.cycle_id = v_cycle_id
    and public.client_cycle_stages.stage = _stage;

  if not found then
    insert into public.client_cycle_stages (cycle_id, stage, completed, completed_at, completed_by, agency_id)
    values (
      v_cycle_id,
      _stage,
      stage_completed,
      case when stage_completed then now() else null end,
      case when stage_completed then auth.uid() else null end,
      v_agency
    );
  end if;

  return next;
end;
$$;

-- returned the calendar id of any client, and created calendars for clients of other agencies
create or replace function public.ensure_publication_calendar(p_client_id uuid, p_date date)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_bounds record;
  v_calendar_id uuid;
  v_agency uuid;
begin
  select c.agency_id into v_agency from public.clients c where c.id = p_client_id;
  if v_agency is null or not public._caller_in_agency(v_agency) then
    raise exception 'forbidden';
  end if;

  select * into v_bounds from public.calendar_cycle_bounds(p_date);

  insert into public.publication_calendars (client_id, cycle_start, cycle_end, agency_id)
  values (p_client_id, v_bounds.cycle_start, v_bounds.cycle_end, v_agency)
  on conflict (client_id, cycle_start) do update set client_id = excluded.client_id
  returning id into v_calendar_id;

  return v_calendar_id;
end;
$$;

-- seeded the magic2 cycles of EVERY agency's clients (under the caller's agency_id)
create or replace function public.magic2_seed_year(_year integer)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  r record;
  v_magic2_client_id uuid;
  v_cycle_id uuid;
  v_agency uuid := public.current_agency_id();
  m int;
  v_day int;
begin
  if auth.uid() is null or v_agency is null or not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Unauthorized';
  end if;

  if _year < 2000 or _year > 2100 then
    raise exception 'Invalid year';
  end if;

  v_day := public.current_magic_number_day();

  -- Exclui o cliente sentinela Freelancer; só clientes da agência de quem chama
  for r in select id from public.clients where is_freelancer_sentinel = false and agency_id = v_agency loop
    v_magic2_client_id := public.magic2_ensure_client_link(r.id);

    for m in 1..12 loop
      select id into v_cycle_id
      from public.magic2_cycles
      where client_id = v_magic2_client_id and year = _year and month = m
      limit 1;

      if v_cycle_id is null then
        insert into public.magic2_cycles (client_id, year, month, due_date, is_active, agency_id)
        values (v_magic2_client_id, _year, m, make_date(_year, m, v_day), true, v_agency)
        returning id into v_cycle_id;

        insert into public.magic2_cycle_stages (cycle_id, stage, completed, agency_id)
        select v_cycle_id, unnest(enum_range(null::public.magic2_stage_type)), false, v_agency;
      end if;
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. chat
-- ---------------------------------------------------------------------------------------------------------------------
-- joined the user to *some* agency's general room (the first one found)
create or replace function public.chat_ensure_general_member()
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_agency uuid := public.current_agency_id();
  v_general uuid;
begin
  if v_uid is null or v_agency is null then return null; end if;
  select id into v_general from public.chat_conversations where type = 'general' and agency_id = v_agency limit 1;
  if v_general is null then
    insert into public.chat_conversations (type, agency_id) values ('general', v_agency) returning id into v_general;
  end if;
  insert into public.chat_participants (conversation_id, user_id, agency_id)
  values (v_general, v_uid, v_agency)
  on conflict do nothing;
  return v_general;
end;
$$;

-- opened a DM with (and added to a conversation) a user of another agency
create or replace function public.chat_get_or_create_direct(_other_user uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_agency uuid := public.current_agency_id();
  v_conv uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if _other_user is null or _other_user = v_uid or not public.same_agency(_other_user) then
    raise exception 'Invalid target user';
  end if;

  select c.id into v_conv
  from public.chat_conversations c
  join public.chat_participants p1 on p1.conversation_id = c.id and p1.user_id = v_uid
  join public.chat_participants p2 on p2.conversation_id = c.id and p2.user_id = _other_user
  where c.type = 'direct' and c.agency_id = v_agency
  limit 1;

  if v_conv is not null then return v_conv; end if;

  insert into public.chat_conversations (type, agency_id) values ('direct', v_agency) returning id into v_conv;
  insert into public.chat_participants (conversation_id, user_id, agency_id) values (v_conv, v_uid, v_agency), (v_conv, _other_user, v_agency);
  return v_conv;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. XP automation: per-agency engine, cron iterates agencies, users only run their own agency
-- ---------------------------------------------------------------------------------------------------------------------
-- the monthly-processing / video-destaque guards must be per agency (the old unique keys were global)
alter table public.xp_monthly_processing drop constraint xp_monthly_processing_year_month_criterion_key;
alter table public.xp_monthly_processing add constraint xp_monthly_processing_agency_year_month_criterion_key
  unique (agency_id, year, month, criterion);
alter table public.xp_video_destaque drop constraint xp_video_destaque_year_month_key;
alter table public.xp_video_destaque add constraint xp_video_destaque_agency_year_month_key
  unique (agency_id, year, month);

-- rows created by the 01/10 cron (no user session => agency_id default NULL) are invisible to RLS; attach them to their agency
update public.user_xp_events e
set agency_id = p.agency_id
from public.profiles p
where p.user_id = e.user_id and e.agency_id is null and p.agency_id is not null;

update public.xp_monthly_processing
set agency_id = (select x.agency_id from public.xp_settings x limit 1)
where agency_id is null and (select count(*) from public.xp_settings) = 1;

create or replace function public._xp_apply_monthly_rankings_for_agency(_agency uuid, _year integer, _month integer)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_settings record;
  v_first_user uuid;
  v_second_user uuid;
begin
  select * into v_settings from public.xp_settings where agency_id = _agency;
  if not found then return; end if;

  with base as (
    select
      ps.user_id,
      (ps.aprendizado_continuo + ps.padrao_qualidade_uau + ps.metas_prazos + ps.ambiente_organizado + ps.comprometimento + ps.video_destaque + ps.squad_destaque) as total,
      coalesce((select count(*) from public.pm_tasks pt
        where pt.assignee_id = ps.user_id and pt.status_global = 'concluido'
          and pt.deleted_at is null
          and date_trunc('month', pt.due_date::timestamp) = make_date(_year,_month,1)::timestamp
      ), 0) as completed,
      coalesce((select count(*) from public.pm_tasks pt
        where pt.assignee_id = ps.user_id and pt.deleted_at is null
          and date_trunc('month', pt.due_date::timestamp) = make_date(_year,_month,1)::timestamp
          and ((pt.status_global = 'concluido' and pt.updated_at::date > pt.due_date)
               or (pt.status_global <> 'concluido' and pt.due_date < current_date))
      ), 0) as lates
    from public.performance_scores ps
    where ps.year = _year and ps.month = _month and ps.agency_id = _agency
  ),
  ranked as (
    select user_id, row_number() over (order by total desc, completed desc, lates asc) as rk
    from base
  )
  select
    (select user_id from ranked where rk = 1),
    (select user_id from ranked where rk = 2)
  into v_first_user, v_second_user;

  if v_first_user is not null and not exists (
    select 1 from public.xp_monthly_processing
    where year = _year and month = _month and criterion = 'rank_1' and agency_id = _agency
  ) then
    insert into public.user_xp_events (user_id, amount, reason, source_type, agency_id)
    values (v_first_user, v_settings.rank_1_xp, '1º Lugar no Ranking Mensal', 'auto_rank_1', _agency);
    insert into public.xp_monthly_processing (year, month, criterion, agency_id) values (_year, _month, 'rank_1', _agency);
  end if;

  if v_second_user is not null and not exists (
    select 1 from public.xp_monthly_processing
    where year = _year and month = _month and criterion = 'rank_2' and agency_id = _agency
  ) then
    insert into public.user_xp_events (user_id, amount, reason, source_type, agency_id)
    values (v_second_user, v_settings.rank_2_xp, '2º Lugar no Ranking Mensal', 'auto_rank_2', _agency);
    insert into public.xp_monthly_processing (year, month, criterion, agency_id) values (_year, _month, 'rank_2', _agency);
  end if;
end;
$$;

create or replace function public._xp_apply_squad_destaque_for_agency(_agency uuid, _year integer, _month integer)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_settings record;
  v_winner_squad uuid;
  v_member uuid;
begin
  select * into v_settings from public.xp_settings where agency_id = _agency;
  if not found then return; end if;

  if exists (
    select 1 from public.xp_monthly_processing
    where year = _year and month = _month and criterion = 'squad_destaque' and agency_id = _agency
  ) then
    return;
  end if;

  with squad_totals as (
    select
      sm.squad_id,
      avg(coalesce(ps.aprendizado_continuo + ps.padrao_qualidade_uau + ps.metas_prazos + ps.ambiente_organizado + ps.comprometimento + ps.video_destaque + ps.squad_destaque, 0)) as avg_score
    from public.squad_members sm
    left join public.performance_scores ps
      on ps.user_id = sm.user_id and ps.year = _year and ps.month = _month
    where sm.agency_id = _agency
    group by sm.squad_id
  )
  select squad_id into v_winner_squad
  from squad_totals
  order by avg_score desc nulls last
  limit 1;

  if v_winner_squad is null then return; end if;

  for v_member in select user_id from public.squad_members where squad_id = v_winner_squad loop
    insert into public.user_xp_events (user_id, amount, reason, source_type, source_id, agency_id)
    values (v_member, v_settings.squad_destaque_xp, 'Squad Destaque do Mês', 'auto_squad', v_winner_squad, _agency);
  end loop;

  insert into public.xp_monthly_processing (year, month, criterion, agency_id) values (_year, _month, 'squad_destaque', _agency);
end;
$$;

create or replace function public._xp_apply_task_late_penalties_for_agency(_agency uuid)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  v_settings record;
  v_task record;
  v_count integer := 0;
  v_user uuid;
  v_w uuid;
  v_targets uuid[];
begin
  select * into v_settings from public.xp_settings where agency_id = _agency;
  if not found then return 0; end if;

  for v_task in
    select pt.id, pt.title, pt.assignee_id, pt.watchers
    from public.pm_tasks pt
    where pt.agency_id = _agency
      and pt.deleted_at is null
      and pt.due_date is not null
      and pt.due_date < current_date
      and pt.status_global <> 'concluido'
      and pt.assignee_id is not null
      and not exists (select 1 from public.xp_task_penalties p where p.pm_task_id = pt.id)
  loop
    v_targets := array[v_task.assignee_id];
    if v_settings.late_penalize_all_assignees and v_task.watchers is not null then
      foreach v_w in array v_task.watchers loop
        if v_w is not null and not (v_w = any(v_targets)) then
          v_targets := v_targets || v_w;
        end if;
      end loop;
    end if;

    foreach v_user in array v_targets loop
      insert into public.xp_task_penalties (pm_task_id, user_id, xp_deducted, agency_id)
      values (v_task.id, v_user, v_settings.task_late_penalty, _agency)
      on conflict (pm_task_id, user_id) do nothing;

      if found then
        insert into public.user_xp_events (user_id, amount, reason, source_type, source_id, agency_id)
        values (v_user, v_settings.task_late_penalty, 'Atraso em Tarefa: ' || coalesce(v_task.title,''), 'auto_task_late', v_task.id, _agency);
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;

  return v_count;
end;
$$;

revoke all on function public._xp_apply_monthly_rankings_for_agency(uuid, integer, integer),
                       public._xp_apply_squad_destaque_for_agency(uuid, integer, integer),
                       public._xp_apply_task_late_penalties_for_agency(uuid)
  from public, anon, authenticated;

-- public entry points: a signed-in admin runs the caller's agency only; the cron (no session) runs every agency
create or replace function public.xp_apply_monthly_rankings(_year integer, _month integer)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_agency uuid;
begin
  if auth.uid() is not null then
    if not public.has_role(auth.uid(), 'admin'::public.app_role) then raise exception 'forbidden'; end if;
    perform public._xp_apply_monthly_rankings_for_agency(public.current_agency_id(), _year, _month);
  else
    for v_agency in select agency_id from public.xp_settings loop
      perform public._xp_apply_monthly_rankings_for_agency(v_agency, _year, _month);
    end loop;
  end if;
end;
$$;

create or replace function public.xp_apply_squad_destaque(_year integer, _month integer)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_agency uuid;
begin
  if auth.uid() is not null then
    if not public.has_role(auth.uid(), 'admin'::public.app_role) then raise exception 'forbidden'; end if;
    perform public._xp_apply_squad_destaque_for_agency(public.current_agency_id(), _year, _month);
  else
    for v_agency in select agency_id from public.xp_settings loop
      perform public._xp_apply_squad_destaque_for_agency(v_agency, _year, _month);
    end loop;
  end if;
end;
$$;

create or replace function public.xp_apply_task_late_penalties()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_agency uuid; v_count integer := 0;
begin
  if auth.uid() is not null then
    if not public.has_role(auth.uid(), 'admin'::public.app_role) then raise exception 'forbidden'; end if;
    return public._xp_apply_task_late_penalties_for_agency(public.current_agency_id());
  end if;
  for v_agency in select agency_id from public.xp_settings loop
    v_count := v_count + public._xp_apply_task_late_penalties_for_agency(v_agency);
  end loop;
  return v_count;
end;
$$;

create or replace function public.xp_process_previous_month()
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_prev date := (date_trunc('month', current_date) - interval '1 day')::date;
  v_year integer := extract(year from v_prev)::integer;
  v_month integer := extract(month from v_prev)::integer;
  v_agency uuid;
begin
  if auth.uid() is not null then
    if not public.has_role(auth.uid(), 'admin'::public.app_role) then raise exception 'forbidden'; end if;
    perform public._xp_apply_monthly_rankings_for_agency(public.current_agency_id(), v_year, v_month);
    perform public._xp_apply_squad_destaque_for_agency(public.current_agency_id(), v_year, v_month);
  else
    for v_agency in select agency_id from public.xp_settings loop
      perform public._xp_apply_monthly_rankings_for_agency(v_agency, v_year, v_month);
      perform public._xp_apply_squad_destaque_for_agency(v_agency, v_year, v_month);
    end loop;
  end if;
end;
$$;

-- an admin could crown any pm task (of any agency) as video-of-the-month and wipe another agency's selection
create or replace function public.xp_apply_video_destaque(_pm_task_id uuid, _year integer, _month integer)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_agency uuid := public.current_agency_id();
  v_settings record;
  v_assignee uuid;
  v_watchers uuid[];
  v_w uuid;
  v_recipients uuid[] := array[]::uuid[];
  v_user uuid;
  v_user_roles text[];
begin
  if auth.uid() is null or v_agency is null or not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Apenas administradores';
  end if;

  select * into v_settings from public.xp_settings where agency_id = v_agency;
  if not found then raise exception 'XP settings not configured'; end if;

  select assignee_id, watchers into v_assignee, v_watchers
  from public.pm_tasks where id = _pm_task_id and agency_id = v_agency;
  if not found then raise exception 'Tarefa não encontrada'; end if;

  -- Replace existing selection for this month (revoke prior XP)
  if exists (select 1 from public.xp_video_destaque where year = _year and month = _month and agency_id = v_agency) then
    delete from public.user_xp_events
    where source_type = 'auto_video_destaque'
      and agency_id = v_agency
      and source_id = (select pm_task_id from public.xp_video_destaque where year = _year and month = _month and agency_id = v_agency);
    delete from public.xp_video_destaque where year = _year and month = _month and agency_id = v_agency;
  end if;

  if v_assignee is not null then v_recipients := v_recipients || v_assignee; end if;
  if v_watchers is not null then
    foreach v_w in array v_watchers loop
      if v_w is not null and not (v_w = any(v_recipients)) then
        v_recipients := v_recipients || v_w;
      end if;
    end loop;
  end if;

  -- elegível se QUALQUER cargo da pessoa bater com a lista configurada; sem cargo cadastrado = elegível
  foreach v_user in array v_recipients loop
    select role_titles into v_user_roles from public.team_members where user_id = v_user;
    if v_user_roles is null or array_length(v_user_roles, 1) is null or v_user_roles && v_settings.video_destaque_roles then
      insert into public.user_xp_events (user_id, amount, reason, source_type, source_id, created_by, agency_id)
      values (v_user, v_settings.video_destaque_xp, 'Vídeo Destaque do Mês', 'auto_video_destaque', _pm_task_id, auth.uid(), v_agency);
    end if;
  end loop;

  insert into public.xp_video_destaque (year, month, pm_task_id, selected_by, agency_id)
  values (_year, _month, _pm_task_id, auth.uid(), v_agency);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. WhatsApp: events/ranking/enqueue were global (any agency's automations, settings and ranking fired for everyone)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.whatsapp_enqueue(_user_id uuid, _type text, _message text, _source_ref text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_id uuid;
  v_pref record;
  v_settings record;
  v_agency uuid;
  v_allowed boolean := true;
begin
  if _user_id is null or _type is null or _message is null then
    return null;
  end if;

  select p.agency_id into v_agency from public.profiles p where p.user_id = _user_id;
  -- a signed-in user can never queue a message for someone of another agency (soft-fail: this runs inside triggers)
  if v_agency is null or not public._caller_in_agency(v_agency) then
    return null;
  end if;

  select * into v_settings from public.whatsapp_settings where agency_id = v_agency;
  if v_settings is null or v_settings.enabled = false then
    return null;
  end if;

  select * into v_pref from public.user_whatsapp_preferences where user_id = _user_id;
  if v_pref is null or v_pref.enabled = false or v_pref.phone_e164 is null then
    return null;
  end if;

  v_allowed := case _type
    when 'new_task' then v_pref.notify_new_task
    when 'deadline' then v_pref.notify_deadline
    when 'company'  then v_pref.notify_company
    when 'xp_rank'  then v_pref.notify_xp_rank
    else true
  end;
  if not v_allowed then return null; end if;

  insert into public.whatsapp_outbox (user_id, notification_type, message, source_ref, agency_id)
  values (_user_id, _type, _message, _source_ref, v_agency)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.whatsapp_enqueue_phone(_phone text, _type text, _message text, _source_ref text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_id uuid;
  v_settings record;
  v_agency uuid;
begin
  if _phone is null or length(trim(_phone)) = 0 or _message is null then return null; end if;

  -- user session: its own agency; backend: the agency whose automation owns this group phone
  v_agency := coalesce(
    public.current_agency_id(),
    (select a.agency_id from public.whatsapp_automations a where a.group_phone = _phone limit 1)
  );
  if v_agency is null then return null; end if;

  select * into v_settings from public.whatsapp_settings where agency_id = v_agency;
  if v_settings is null or v_settings.enabled = false then return null; end if;

  insert into public.whatsapp_outbox (user_id, target_phone, notification_type, message, source_ref, status, agency_id)
  values (null, _phone, _type, _message, _source_ref, 'queued', v_agency)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.whatsapp_dispatch_event(_key text, _vars jsonb, _user_id uuid, _source_ref text default null)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  v_auto record;
  v_msg text;
  v_count int := 0;
  v_agency uuid;
begin
  select p.agency_id into v_agency from public.profiles p where p.user_id = _user_id;
  v_agency := coalesce(v_agency, public.current_agency_id());
  if v_agency is null or not public._caller_in_agency(v_agency) then
    return 0;
  end if;

  for v_auto in
    select id, message_template, audience, group_phone
    from public.whatsapp_automations
    where enabled = true and trigger_type = 'event' and trigger_key = _key
      and agency_id = v_agency
  loop
    v_msg := public.apply_msg_template(v_auto.message_template, _vars);
    if v_msg is null or length(trim(v_msg)) = 0 then continue; end if;
    if v_auto.audience = 'group' then
      if v_auto.group_phone is not null and length(trim(v_auto.group_phone)) > 0 then
        perform public.whatsapp_enqueue_phone(v_auto.group_phone, _key, v_msg, _source_ref);
        v_count := v_count + 1;
      end if;
    else
      if _user_id is not null then
        perform public.whatsapp_enqueue(_user_id, _key, v_msg, _source_ref);
        v_count := v_count + 1;
      end if;
    end if;
    update public.whatsapp_automations set last_run_at = now() where id = v_auto.id;
  end loop;
  return v_count;
end;
$$;

-- ranked every agency's scores together and kept one global state row per month
create or replace function public.whatsapp_check_ranking_changes(_year integer, _month integer)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_agency uuid := public.current_agency_id();
  v_top3 record;
  v_state record;
  v_new_first uuid;
  v_new_top3 uuid[];
  v_totals jsonb := '{}'::jsonb;
  v_full text;
  v_first text;
  v_vars jsonb;
  v_user uuid;
  v_total numeric;
begin
  -- only agencies that configured WhatsApp take part (ranking state is one row per month)
  if v_agency is null or not exists (select 1 from public.whatsapp_settings where agency_id = v_agency) then
    return;
  end if;

  with ranked as (
    select user_id,
           (coalesce(aprendizado_continuo,0)+coalesce(padrao_qualidade_uau,0)+
            coalesce(metas_prazos,0)+coalesce(ambiente_organizado,0)+
            coalesce(comprometimento,0))::numeric as total
    from public.performance_scores
    where year = _year and month = _month and agency_id = v_agency
  ),
  ordered as (
    select user_id, total, row_number() over (order by total desc, user_id) as rn
    from ranked where total > 0
  )
  select
    (select user_id from ordered where rn = 1) as first_user,
    coalesce((select array_agg(user_id order by rn) from ordered where rn <= 3), '{}'::uuid[]) as top3,
    coalesce((select jsonb_object_agg(user_id::text, total) from ordered where rn <= 3), '{}'::jsonb) as totals
  into v_top3;

  v_new_first := v_top3.first_user;
  v_new_top3 := v_top3.top3;
  v_totals := v_top3.totals;

  select * into v_state from public.whatsapp_ranking_state where year = _year and month = _month and agency_id = v_agency;

  if v_state is null then
    insert into public.whatsapp_ranking_state (year, month, first_user_id, top3_user_ids, agency_id)
    values (_year, _month, v_new_first, v_new_top3, v_agency);
    return;
  end if;

  if v_new_first is not null and v_new_first is distinct from v_state.first_user_id then
    select full_name into v_full from public.profiles where user_id = v_new_first;
    v_first := split_part(coalesce(v_full, ''), ' ', 1);
    v_total := coalesce((v_totals ->> v_new_first::text)::numeric, 0);
    v_vars := jsonb_build_object('nome', coalesce(v_full, ''), 'primeiro_nome', v_first, 'xp', v_total::text, 'ranking', '1º Lugar');
    perform public.whatsapp_dispatch_event('xp_first', v_vars, v_new_first, format('rt_first:%s-%s:%s', _year, _month, v_new_first));
  end if;

  foreach v_user in array v_new_top3 loop
    if not (v_user = any (coalesce(v_state.top3_user_ids, '{}'::uuid[]))) then
      select full_name into v_full from public.profiles where user_id = v_user;
      v_first := split_part(coalesce(v_full, ''), ' ', 1);
      v_total := coalesce((v_totals ->> v_user::text)::numeric, 0);
      v_vars := jsonb_build_object('nome', coalesce(v_full, ''), 'primeiro_nome', v_first, 'xp', v_total::text, 'ranking', 'Top 3');
      perform public.whatsapp_dispatch_event('xp_top3', v_vars, v_user, format('rt_top3:%s-%s:%s', _year, _month, v_user));
    end if;
  end loop;

  update public.whatsapp_ranking_state
  set first_user_id = v_new_first, top3_user_ids = v_new_top3, updated_at = now()
  where year = _year and month = _month and agency_id = v_agency;
end;
$$;

-- admin of agency A could (un)link any WhatsApp contact (any agency) to any user id
create or replace function public.whatsapp_link_contact_to_user(_phone text, _user_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_phone text := regexp_replace(coalesce(_phone,''),'\D','','g');
  v_key text := public.whatsapp_phone_key(_phone);
  v_agency uuid := public.current_agency_id();
begin
  if v_agency is null or not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Apenas administradores';
  end if;
  if v_key is null then raise exception 'Telefone inválido'; end if;
  if _user_id is not null and not public.same_agency(_user_id) then
    raise exception 'Usuário inválido';
  end if;

  update public.whatsapp_contacts
  set user_id = _user_id,
      origin = case when _user_id is null then 'lead' else 'colaborador' end,
      phone_key = v_key,
      updated_at = now()
  where agency_id = v_agency
    and (phone_key = v_key or phone_e164 = v_phone);
end;
$$;

-- reads/decides on any lead id and used the first agency's automation config + every agency's contacts/log
create or replace function public.crm_should_send_welcome(_lead_id uuid)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  v_lead public.crm_leads%rowtype;
  v_phone_key text;
  v_origem text;
  v_contact_origin text;
  v_contact_user uuid;
  v_last_in_body text;
  v_last_in_at timestamptz;
  v_manual_recent boolean;
  v_cfg_fora public.crm_lead_automations%rowtype;
  v_now_local timestamptz := now() at time zone 'America/Sao_Paulo';
  v_dow int;
  v_time time;
  v_scenario text;
  v_enabled boolean;
  v_cooldown_days int;
  v_recent boolean;
begin
  select * into v_lead from public.crm_leads where id = _lead_id;
  if v_lead.id is null then return null; end if;
  if v_lead.agency_id is null or not public._caller_in_agency(v_lead.agency_id) then return null; end if;
  if v_lead.welcome_sent_at is not null then return null; end if;
  if v_lead.stage in ('perdido','fechado') then return null; end if;

  v_phone_key := v_lead.phone_key;
  if v_phone_key is null then return null; end if;

  -- skip equipe / cliente / fornecedor
  select origin, user_id into v_contact_origin, v_contact_user
  from public.whatsapp_contacts where phone_key = v_phone_key and agency_id = v_lead.agency_id limit 1;
  if v_contact_user is not null then return null; end if;
  if v_contact_origin in ('colaborador','cliente','fornecedor','grupo') then return null; end if;

  -- atendimento manual recente (humano enviou mensagem fora de notificação)
  select exists (
    select 1 from public.whatsapp_messages
    where contact_phone_key = v_phone_key
      and direction = 'out'
      and source_type in ('manual')
      and created_at > now() - interval '60 minutes'
      and agency_id = v_lead.agency_id
  ) into v_manual_recent;
  if v_manual_recent then return null; end if;

  -- última mensagem recebida (para detecção de cenário)
  select body, created_at into v_last_in_body, v_last_in_at
  from public.whatsapp_messages
  where contact_phone_key = v_phone_key and direction = 'in' and agency_id = v_lead.agency_id
  order by created_at desc limit 1;

  v_origem := lower(coalesce(v_lead.origem, ''));

  -- cenário: fora_horario > orcamento > instagram > padrao
  select * into v_cfg_fora from public.crm_lead_automations where scenario = 'fora_horario' and agency_id = v_lead.agency_id;
  v_dow := extract(isodow from v_now_local)::int; -- 1..7
  v_time := v_now_local::time;

  if v_cfg_fora.enabled and (
    not (v_dow = any(v_cfg_fora.business_days))
    or v_time < v_cfg_fora.business_hours_start
    or v_time >= v_cfg_fora.business_hours_end
  ) then
    v_scenario := 'fora_horario';
  elsif v_last_in_body is not null and v_last_in_body ~* '(orç|orcamento|preç|valor|quanto custa|investimento)' then
    v_scenario := 'orcamento';
  elsif v_origem = 'instagram'
        or (v_last_in_body is not null and v_last_in_body ~* '(instagram|insta|\big\b|direct)') then
    v_scenario := 'instagram';
  else
    v_scenario := 'padrao';
  end if;

  select enabled, cooldown_days into v_enabled, v_cooldown_days
  from public.crm_lead_automations where scenario = v_scenario and agency_id = v_lead.agency_id;
  if not coalesce(v_enabled, false) then return null; end if;

  -- cooldown por contato
  select exists (
    select 1 from public.crm_lead_welcome_log
    where phone_key = v_phone_key
      and agency_id = v_lead.agency_id
      and sent_at > now() - make_interval(days => greatest(coalesce(v_cooldown_days,30),0))
  ) into v_recent;
  if v_recent then return null; end if;

  return v_scenario;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. ops snapshot: reads pg_stat_statements (SQL text of every tenant) -> platform/backend only
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.ops_capture_snapshot(_note text default null)
returns void language plpgsql security definer set search_path to 'public', 'extensions', 'pg_catalog' as $$
declare
  v_conns int;
  v_max int;
  v_db_size bigint;
  v_wal_size bigint;
  v_rollbacks bigint;
  v_commits bigint;
  v_deadlocks bigint;
begin
  if auth.uid() is not null and not public.is_platform_admin() then
    raise exception 'forbidden';
  end if;

  select count(*) into v_conns from pg_stat_activity;
  select setting::int into v_max from pg_settings where name = 'max_connections';
  select pg_database_size(current_database()) into v_db_size;
  begin
    select coalesce(sum(size), 0) into v_wal_size from pg_ls_waldir();
  exception when others then v_wal_size := null;
  end;
  select coalesce(sum(xact_rollback),0), coalesce(sum(xact_commit),0), coalesce(sum(deadlocks),0)
    into v_rollbacks, v_commits, v_deadlocks
  from pg_stat_database where datname = current_database();

  insert into public.ops_db_health_snapshots(connections, max_connections, db_size_bytes, wal_size_bytes, rollbacks, commits, deadlocks, note)
  values (v_conns, v_max, v_db_size, v_wal_size, v_rollbacks, v_commits, v_deadlocks, _note);

  insert into public.ops_top_queries_snapshots(rank, queryid, calls, total_ms, mean_ms, rows, query)
  select
    row_number() over (order by s.total_exec_time desc)::int as rank,
    s.queryid,
    s.calls,
    round(s.total_exec_time::numeric, 2),
    round(s.mean_exec_time::numeric, 3),
    s.rows,
    left(s.query, 800)
  from extensions.pg_stat_statements s
  join pg_database d on d.oid = s.dbid and d.datname = current_database()
  where s.query not ilike '%pg_stat_statements%'
    and s.query not ilike '%ops_capture_snapshot%'
  order by s.total_exec_time desc
  limit 15;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. grants
-- ---------------------------------------------------------------------------------------------------------------------
-- never meant to be called from the browser: only definer triggers (run as owner), cron (postgres) and edge functions (service_role)
revoke execute on function public.ops_capture_snapshot(text), public.whatsapp_enqueue(uuid, text, text, text),
  public.whatsapp_enqueue_phone(text, text, text, text), public.whatsapp_dispatch_event(text, jsonb, uuid, text),
  public.whatsapp_check_ranking_changes(integer, integer), public.crm_should_send_welcome(uuid)
  from public, anon, authenticated;
grant execute on function public.ops_capture_snapshot(text), public.whatsapp_enqueue(uuid, text, text, text),
  public.whatsapp_enqueue_phone(text, text, text, text), public.whatsapp_dispatch_event(text, jsonb, uuid, text),
  public.whatsapp_check_ranking_changes(integer, integer), public.crm_should_send_welcome(uuid)
  to service_role;

-- recreated/changed functions keep the locked-down grants (create or replace keeps ACLs, but be explicit for anything new)
revoke execute on function public.get_performance_month_totals(integer), public.get_performance_year_summary(integer),
  public.get_user_xp_summary(uuid), public.magic2_seed_year(integer), public.ensure_publication_calendar(uuid, date),
  public.toggle_stage_tasks_checklist(uuid, stage_type, integer, integer), public.snapshot_unscored_tasks(),
  public.chat_ensure_general_member(), public.chat_get_or_create_direct(uuid), public.whatsapp_link_contact_to_user(text, uuid),
  public.xp_apply_monthly_rankings(integer, integer), public.xp_apply_squad_destaque(integer, integer),
  public.xp_apply_task_late_penalties(), public.xp_apply_video_destaque(uuid, integer, integer), public.xp_process_previous_month()
  from public, anon;
