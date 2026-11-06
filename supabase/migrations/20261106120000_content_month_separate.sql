-- Mês do conteúdo separado do mês do Magic Number.
-- Até aqui pm_tasks.reference_month fazia dois trabalhos: dizia de que mês é o conteúdo (planejar em novembro o conteúdo de dezembro)
-- e em que mês o Magic Number e a pontuação contam. Agora:
--   pm_tasks.content_month   → mês do conteúdo (só nome e organização; a antecedência da agência preenche por padrão)
--   pm_tasks.reference_month → mês em que o Magic Number e a pontuação contam; vazio = mês do prazo (só vira exceção quando alguém marca)

alter table public.pm_tasks add column if not exists content_month date;
alter table public.pm_tasks add constraint pm_tasks_content_month_first_day check (content_month is null or extract(day from content_month) = 1);

-- Tarefa nova herda o mês do conteúdo (e o do Magic Number) de quem a originou. A antecedência da agência passa a preencher o mês do
-- conteúdo; o mês do Magic Number só é gravado quando alguém escolhe, senão vale o mês do prazo.
create or replace function public.pm_tasks_inherit_reference_month()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_offset int;
  v_ref date;
  v_content date;
begin
  if (new.reference_month is null or new.content_month is null) and coalesce(new.parent_task_id, new.origin_task_id) is not null then
    select p.reference_month, p.content_month into v_ref, v_content
    from public.pm_tasks p
    where p.id = coalesce(new.parent_task_id, new.origin_task_id);
    new.reference_month := coalesce(new.reference_month, v_ref);
    new.content_month := coalesce(new.content_month, v_content);
  end if;
  if new.content_month is null and new.parent_task_id is null and new.origin_task_id is null
     and not coalesce(new.is_extra_demand, false) and new.periodic_stage_key is null then
    select s.content_month_offset into v_offset from public.app_settings s where s.agency_id = new.agency_id;
    if coalesce(v_offset, 0) > 0 then
      new.content_month := (date_trunc('month', coalesce(new.due_date, (now() at time zone 'America/Sao_Paulo')::date)) + make_interval(months => v_offset))::date;
    end if;
  end if;
  return new;
end;
$fn$;
revoke execute on function public.pm_tasks_inherit_reference_month() from public, anon, authenticated;

-- quem troca o mês do conteúdo numa tarefa troca também nas subtarefas e nas outras etapas da mesma origem
create or replace function public.pm_tasks_propagate_content_month()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_root uuid := coalesce(new.origin_task_id, new.id);
begin
  update public.pm_tasks
  set content_month = new.content_month
  where content_month is distinct from new.content_month
    and id <> new.id
    and (parent_task_id = new.id or id = v_root or origin_task_id = v_root);
  return null;
end;
$fn$;
revoke execute on function public.pm_tasks_propagate_content_month() from public, anon, authenticated;
create trigger pm_tasks_propagate_content_month after update of content_month on public.pm_tasks
for each row when (old.content_month is distinct from new.content_month)
execute function public.pm_tasks_propagate_content_month();

-- Tarefas que já tinham mês: o que era "mês referente" passa a ser também o mês do conteúdo (mesmo significado de antes)
update public.pm_tasks set content_month = reference_month where reference_month is not null and content_month is null;

-- As tarefas de planejamento/design/vídeo criadas de 5 a 20/11/2026 e passadas para novembro no Magic Number (conteúdo de dezembro)
update public.pm_tasks
set content_month = date '2026-12-01'
where parent_task_id is null and origin_task_id is null and deleted_at is null
  and reference_month = date '2026-11-01'
  and (created_at at time zone 'America/Sao_Paulo')::date between date '2026-11-05' and date '2026-11-20'
  and date_trunc('month', due_date)::date = date '2026-11-01';
