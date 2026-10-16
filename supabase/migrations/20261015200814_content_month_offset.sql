-- Antecedência do conteúdo, por agência: "o trabalho feito em um mês conta no mês +N" (agência que produz sempre um mês adiantada = 1).
-- Vale para tarefa nova de etapa (não extra, não periódica) que não veio de outra tarefa e não recebeu mês do conteúdo:
-- ela nasce com reference_month = mês do prazo + N, e as etapas seguintes herdam esse mês. N = 0 não muda nada.
alter table public.app_settings add column if not exists content_month_offset integer not null default 0 check (content_month_offset between 0 and 6);

create or replace function public.pm_tasks_inherit_reference_month()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_offset int;
begin
  if new.reference_month is null then
    select p.reference_month into new.reference_month
    from public.pm_tasks p
    where p.id = coalesce(new.parent_task_id, new.origin_task_id) and p.reference_month is not null;
  end if;
  if new.reference_month is null and new.parent_task_id is null and new.origin_task_id is null
     and not coalesce(new.is_extra_demand, false) and new.periodic_stage_key is null then
    select s.content_month_offset into v_offset from public.app_settings s where s.agency_id = new.agency_id;
    if coalesce(v_offset, 0) > 0 then
      new.reference_month := (date_trunc('month', coalesce(new.due_date, (now() at time zone 'America/Sao_Paulo')::date)) + make_interval(months => v_offset))::date;
    end if;
  end if;
  return new;
end;
$fn$;
revoke execute on function public.pm_tasks_inherit_reference_month() from public, anon, authenticated;

