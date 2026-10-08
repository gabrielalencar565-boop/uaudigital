-- Margem por cliente com pesos por etapa: as consultas passam a devolver a contagem por tipo de etapa
-- (o peso é aplicado na tela, então mudá-lo não exige nova consulta ao banco).
drop function if exists public.fin_client_workload(int, int);
drop function if exists public.fin_client_workload_year(int);

create function public.fin_client_workload(p_year int, p_month int)
returns table (client_id uuid, stage text, stages bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select t.client_id, t.stage::text, count(*)::bigint
  from public.tasks t
  where t.deleted_at is null
    and t.status = 'concluido'
    and t.client_id is not null
    and coalesce(t.completed_at, t.due_date::timestamptz) >= make_date(p_year, p_month, 1)
    and coalesce(t.completed_at, t.due_date::timestamptz) < (make_date(p_year, p_month, 1) + interval '1 month')
  group by t.client_id, t.stage
$$;

create function public.fin_client_workload_year(p_year int)
returns table (client_id uuid, month int, stage text, stages bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select t.client_id,
         extract(month from coalesce(t.completed_at, t.due_date::timestamptz))::int,
         t.stage::text,
         count(*)::bigint
  from public.tasks t
  where t.deleted_at is null
    and t.status = 'concluido'
    and t.client_id is not null
    and coalesce(t.completed_at, t.due_date::timestamptz) >= make_date(p_year, 1, 1)
    and coalesce(t.completed_at, t.due_date::timestamptz) < make_date(p_year + 1, 1, 1)
  group by 1, 2, 3
$$;

revoke all on function public.fin_client_workload(int, int) from public, anon;
revoke all on function public.fin_client_workload_year(int) from public, anon;
grant execute on function public.fin_client_workload(int, int) to authenticated;
grant execute on function public.fin_client_workload_year(int) to authenticated;

-- Configuração do cálculo, uma linha por agência: peso de cada etapa e categorias de despesa que ficam fora do rateio.
create table public.fin_margin_settings (
  agency_id uuid primary key references public.agencies(id) on delete cascade default public.current_agency_id(),
  stage_weights jsonb not null default '{}'::jsonb,
  excluded_categories text[] not null default array['investimento', 'financeira'],
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

alter table public.fin_margin_settings enable row level security;

create policy fin_margin_settings_select on public.fin_margin_settings
  for select to authenticated
  using (agency_id = (select public.current_agency_id()));

create policy fin_margin_settings_admin_write on public.fin_margin_settings
  for all to authenticated
  using (public.has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (public.has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));
