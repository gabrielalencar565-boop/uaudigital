-- Etapas concluídas por cliente num mês: a base para ratear as despesas do mês entre os clientes (margem por cliente).
-- security invoker: as políticas de linha (RLS) de public.tasks já isolam cada agência.
create or replace function public.fin_client_workload(p_year int, p_month int)
returns table (client_id uuid, stages bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select t.client_id, count(*)::bigint
  from public.tasks t
  where t.deleted_at is null
    and t.status = 'concluido'
    and t.client_id is not null
    and coalesce(t.completed_at, t.due_date::timestamptz) >= make_date(p_year, p_month, 1)
    and coalesce(t.completed_at, t.due_date::timestamptz) < (make_date(p_year, p_month, 1) + interval '1 month')
  group by t.client_id
$$;

revoke all on function public.fin_client_workload(int, int) from public, anon;
grant execute on function public.fin_client_workload(int, int) to authenticated;
