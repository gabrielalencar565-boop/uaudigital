-- "Mês do conteúdo": planejamento, design e vídeo de outubro às vezes são do conteúdo de novembro ou dezembro. A tarefa passa a ter um mês de
-- referência; o Magic Number e a pontuação usam esse mês (e, sem ele, o mês do prazo, como sempre foi). O prazo continua valendo para atraso.
--   pm_tasks.reference_month  → o que a pessoa escolhe na tarefa (primeiro dia do mês); as etapas seguintes herdam
--   tasks.reference_month     → cópia no registro de pontuação, para os recálculos mensais

alter table public.pm_tasks add column if not exists reference_month date;
alter table public.tasks add column if not exists reference_month date;
alter table public.pm_tasks add constraint pm_tasks_reference_month_first_day check (reference_month is null or extract(day from reference_month) = 1);
alter table public.tasks add constraint tasks_reference_month_first_day check (reference_month is null or extract(day from reference_month) = 1);

-- tarefa nova (cópia de etapa concluída, subtarefa, divisão em design/vídeo) herda o mês de quem a originou
create or replace function public.pm_tasks_inherit_reference_month()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if new.reference_month is null then
    select p.reference_month into new.reference_month
    from public.pm_tasks p
    where p.id = coalesce(new.parent_task_id, new.origin_task_id) and p.reference_month is not null;
  end if;
  return new;
end;
$fn$;
create trigger pm_tasks_inherit_reference_month before insert on public.pm_tasks
for each row execute function public.pm_tasks_inherit_reference_month();

-- quem troca o mês numa tarefa troca também nas subtarefas, nas outras etapas da mesma origem e nos registros de pontuação
create or replace function public.pm_tasks_propagate_reference_month()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_root uuid := coalesce(new.origin_task_id, new.id);
begin
  update public.pm_tasks
  set reference_month = new.reference_month
  where reference_month is distinct from new.reference_month
    and id <> new.id
    and (parent_task_id = new.id or id = v_root or origin_task_id = v_root);
  update public.tasks
  set reference_month = new.reference_month
  where description like 'pm:' || new.id::text || ':%' and reference_month is distinct from new.reference_month;
  return null;
end;
$fn$;
revoke execute on function public.pm_tasks_propagate_reference_month() from public, anon, authenticated;
create trigger pm_tasks_propagate_reference_month after update of reference_month on public.pm_tasks
for each row when (old.reference_month is distinct from new.reference_month)
execute function public.pm_tasks_propagate_reference_month();

-- o recálculo das metas também roda quando só o mês do conteúdo muda
drop trigger if exists tasks_sync_metas_prazos_trigger on public.tasks;
create trigger tasks_sync_metas_prazos_trigger after insert or update of status, due_date, assigned_user_id, reference_month on public.tasks
for each row execute function public.tasks_sync_metas_prazos();

-- as funções existentes passam a enxergar o mês do conteúdo no lugar do mês do prazo
create or replace function pg_temp.patch_fn(p_sig text, p_pairs jsonb)
returns void
language plpgsql
as $fn$
declare
  d text;
  pr jsonb;
  n int;
begin
  d := pg_get_functiondef(p_sig::regprocedure);
  for pr in select * from jsonb_array_elements(p_pairs) loop
    n := (select count(*) from regexp_matches(d, pr ->> 0, 'g'));
    if n = 0 then
      raise exception 'patch em %: trecho não encontrado: %', p_sig, pr ->> 0;
    end if;
    d := regexp_replace(d, pr ->> 0, pr ->> 1, 'g');
  end loop;
  execute d;
end;
$fn$;

do $patch$
declare
  new_due text := 'EXTRACT(\1 FROM COALESCE(NEW.reference_month, NEW.due_date))';
  old_due text := 'EXTRACT(\1 FROM COALESCE(OLD.reference_month, OLD.due_date))';
begin
  -- gatilhos de pontuação nas tarefas de desempenho
  perform pg_temp.patch_fn('public.tasks_sync_all_scores()', jsonb_build_array(
    jsonb_build_array('EXTRACT\((YEAR|MONTH) FROM NEW\.due_date\)', new_due),
    jsonb_build_array('EXTRACT\((YEAR|MONTH) FROM OLD\.due_date\)', old_due),
    jsonb_build_array('\(OLD\.due_date IS DISTINCT FROM NEW\.due_date\)', '(OLD.due_date IS DISTINCT FROM NEW.due_date) OR (OLD.reference_month IS DISTINCT FROM NEW.reference_month)')));
  perform pg_temp.patch_fn('public.tasks_sync_metas_prazos()', jsonb_build_array(
    jsonb_build_array('EXTRACT\((YEAR|MONTH) FROM NEW\.due_date\)', new_due),
    jsonb_build_array('EXTRACT\((YEAR|MONTH) FROM OLD\.due_date\)', old_due),
    jsonb_build_array('\(OLD\.due_date IS DISTINCT FROM NEW\.due_date\)', '(OLD.due_date IS DISTINCT FROM NEW.due_date) OR (OLD.reference_month IS DISTINCT FROM NEW.reference_month)')));
  perform pg_temp.patch_fn('public.task_assignees_sync_metas_prazos()', jsonb_build_array(
    jsonb_build_array('SELECT due_date INTO task_due_date', 'SELECT COALESCE(reference_month, due_date) INTO task_due_date')));
  perform pg_temp.patch_fn('public.task_deadline_overrides_sync_metas()', jsonb_build_array(
    jsonb_build_array('SELECT t\.assigned_user_id, t\.due_date', 'SELECT t.assigned_user_id, COALESCE(t.reference_month, t.due_date) AS due_date')));

  -- Magic Number (marcar, desmarcar e restaurar o check do ciclo)
  perform pg_temp.patch_fn('public.magic2_sync_from_task()', jsonb_build_array(
    jsonb_build_array('EXTRACT\((YEAR|MONTH) FROM NEW\.due_date\)', new_due)));
  perform pg_temp.patch_fn('public.task_restore_check_magic()', jsonb_build_array(
    jsonb_build_array('EXTRACT\((YEAR|MONTH) FROM NEW\.due_date\)', new_due)));
  perform pg_temp.patch_fn('public.task_soft_delete_uncheck_magic()', jsonb_build_array(
    jsonb_build_array('EXTRACT\((YEAR|MONTH) FROM OLD\.due_date\)', old_due),
    jsonb_build_array('EXTRACT\((YEAR|MONTH) FROM t\.due_date\)', 'EXTRACT(\1 FROM COALESCE(t.reference_month, t.due_date))')));
  perform pg_temp.patch_fn('public.uncomplete_agendamento_on_publication_unscheduled()', jsonb_build_array(
    jsonb_build_array('select id, client_id, due_date, is_extra_demand, periodic_stage_key', 'select id, client_id, coalesce(reference_month, due_date), is_extra_demand, periodic_stage_key')));

  -- pontuação mensal
  perform pg_temp.patch_fn('public._recompute_all_scores_impl(uuid,integer,integer)', jsonb_build_array(
    jsonb_build_array('date_trunc\(''month'', t\.due_date::timestamp\)', 'date_trunc(''month'', COALESCE(t.reference_month, t.due_date)::timestamp)')));
  perform pg_temp.patch_fn('public._pm_recalc_tag_points_impl(uuid)', jsonb_build_array(
    jsonb_build_array('SELECT tags, is_extra_demand, due_date, assignee_id', 'SELECT tags, is_extra_demand, COALESCE(reference_month, due_date), assignee_id')));
  perform pg_temp.patch_fn('public._pm_resync_correction_impl(uuid,text)', jsonb_build_array(
    jsonb_build_array('SELECT due_date, assignee_id, periodic_stage_key, stage_current', 'SELECT COALESCE(reference_month, due_date), assignee_id, periodic_stage_key, stage_current')));

  -- conclusão de etapa: ciclo do Magic Number, pontuação e o registro de desempenho (que guarda o mês)
  perform pg_temp.patch_fn('public._pm_sync_stage_completion_impl(uuid,text,uuid,uuid[])', jsonb_build_array(
    jsonb_build_array('v_primary_user uuid;', E'v_primary_user uuid;\n  v_reference_month date;'),
    jsonb_build_array('watchers, is_extra_demand, periodic_stage_key\s+INTO', E'watchers, is_extra_demand, periodic_stage_key, reference_month\n  INTO'),
    jsonb_build_array('v_is_extra, v_periodic_key\s+FROM public\.pm_tasks', E'v_is_extra, v_periodic_key, v_reference_month\n  FROM public.pm_tasks'),
    jsonb_build_array('EXTRACT\((YEAR|MONTH) FROM v_due_date\)::int', 'EXTRACT(\1 FROM COALESCE(v_reference_month, v_due_date))::int'),
    jsonb_build_array('late_penalty_value\s*\)\s*VALUES', 'late_penalty_value, reference_month) VALUES'),
    jsonb_build_array('v_periodic_base, v_periodic_penalty\s*\);', 'v_periodic_base, v_periodic_penalty, v_reference_month);'),
    jsonb_build_array('late_penalty_value = COALESCE\(v_periodic_penalty, late_penalty_value\)', E'late_penalty_value = COALESCE(v_periodic_penalty, late_penalty_value),\n            reference_month = v_reference_month')));
end;
$patch$;
