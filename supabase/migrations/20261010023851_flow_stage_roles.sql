-- Qual cargo é responsável por cada etapa do fluxo (uma linha por agência e etapa).
-- stage_key inclui as chaves virtuais das revisões (revisao_pauta, revisao_design, revisao_video).
-- role_title nulo = a etapa fica sem cargo de propósito. Sem linha = vale o padrão do código.
create table public.flow_stage_roles (
  agency_id uuid not null default public.current_agency_id() references public.agencies(id) on delete cascade,
  stage_key text not null,
  role_title text,
  updated_at timestamptz not null default now(),
  primary key (agency_id, stage_key)
);

alter table public.flow_stage_roles enable row level security;

create policy flow_stage_roles_select on public.flow_stage_roles
  for select to authenticated
  using (agency_id = (select public.current_agency_id()));

create policy flow_stage_roles_admin_write on public.flow_stage_roles
  for all to authenticated
  using (public.has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (public.has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));
