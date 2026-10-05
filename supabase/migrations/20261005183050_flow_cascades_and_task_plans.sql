-- "Cascata": a template of step durations ("Planejamento Mensal") plus the plan (dates per step) computed from it
-- for one piece of work. Steps form a small graph: due(step) = max(due(after...)) + days. The plan lives with the
-- lineage root task (the first task; later stage tasks point to it through origin_task_id).

create table public.flow_cascades (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.current_agency_id() references public.agencies(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  steps jsonb not null check (jsonb_typeof(steps) = 'array'),
  business_days boolean not null default true,
  push_on_delay boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index flow_cascades_agency_idx on public.flow_cascades (agency_id);
alter table public.flow_cascades enable row level security;
create policy "flow_cascades_select" on public.flow_cascades
  for select to authenticated using (agency_id = (select public.current_agency_id()));
create policy "flow_cascades_admin_write" on public.flow_cascades
  for all to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role) and agency_id = (select public.current_agency_id()))
  with check (public.has_role((select auth.uid()), 'admin'::public.app_role) and agency_id = (select public.current_agency_id()));

create table public.pm_task_plans (
  root_task_id uuid primary key references public.pm_tasks(id) on delete cascade,
  agency_id uuid not null default public.current_agency_id() references public.agencies(id) on delete cascade,
  cascade_id uuid references public.flow_cascades(id) on delete set null,
  -- snapshot of the template's steps, so editing the template never rewrites plans already running
  steps jsonb not null,
  -- { "<step key>": "YYYY-MM-DD" } — the current planned due date of each step (pushed forward on delays)
  plan jsonb not null,
  -- { "<step key>": "YYYY-MM-DD" } — the dates originally planned, kept to show how much each step slipped
  original_plan jsonb not null,
  business_days boolean not null default true,
  push_on_delay boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pm_task_plans_agency_idx on public.pm_task_plans (agency_id);
alter table public.pm_task_plans enable row level security;
create policy "pm_task_plans_agency_all" on public.pm_task_plans
  for all to authenticated
  using (agency_id = (select public.current_agency_id()))
  with check (agency_id = (select public.current_agency_id()));

-- Default template mirroring the monthly planning pipeline (editable by the owner).
create function public.seed_default_flow_cascades(p_agency uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.flow_cascades (agency_id, name, steps, is_default)
  select p_agency, 'Planejamento Mensal', '[
    {"key":"planejamento","label":"Planejamento","after":[],"days":0},
    {"key":"revisao_plan","label":"Revisão do planejamento","after":["planejamento"],"days":2},
    {"key":"design","label":"Design","after":["revisao_plan"],"days":7},
    {"key":"edicao_videos","label":"Vídeo","after":["revisao_plan"],"days":7},
    {"key":"revisao_design","label":"Revisão do design","after":["design"],"days":1},
    {"key":"revisao_video","label":"Revisão do vídeo","after":["edicao_videos"],"days":1},
    {"key":"pdf","label":"PDF","after":["revisao_design","revisao_video"],"days":1},
    {"key":"agendamento","label":"Agendamento","after":["pdf"],"days":2}
  ]'::jsonb, true
  where not exists (select 1 from public.flow_cascades c where c.agency_id = p_agency);
$$;
revoke all on function public.seed_default_flow_cascades(uuid) from public, anon, authenticated;
select public.seed_default_flow_cascades(id) from public.agencies;

create or replace function public.agencies_seed_flow_stages() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.seed_default_flow_stages(new.id);
  perform public.seed_default_flow_cascades(new.id);
  return new;
end $$;
