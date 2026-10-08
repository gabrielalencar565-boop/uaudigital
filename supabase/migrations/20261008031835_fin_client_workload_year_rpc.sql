-- Etapas concluídas por cliente e por mês num ano (margem por cliente acumulada no Financeiro → Anual).
create or replace function public.fin_client_workload_year(p_year int)
returns table (client_id uuid, month int, stages bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select t.client_id,
         extract(month from coalesce(t.completed_at, t.due_date::timestamptz))::int,
         count(*)::bigint
  from public.tasks t
  where t.deleted_at is null
    and t.status = 'concluido'
    and t.client_id is not null
    and coalesce(t.completed_at, t.due_date::timestamptz) >= make_date(p_year, 1, 1)
    and coalesce(t.completed_at, t.due_date::timestamptz) < make_date(p_year + 1, 1, 1)
  group by 1, 2
$$;

revoke all on function public.fin_client_workload_year(int) from public, anon;
grant execute on function public.fin_client_workload_year(int) to authenticated;
