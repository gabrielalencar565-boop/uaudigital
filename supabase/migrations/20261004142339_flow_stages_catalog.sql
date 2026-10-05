-- Per-agency catalog of workflow stages: label, color, order and visibility are editable; the stage KEY is what
-- tasks store in pm_tasks.stage_current. "kind" says what the stage means (reserved for behavior; today the
-- built-in stages keep their original behavior and custom ones are generic "work" stages).
create table public.flow_stages (
  agency_id uuid not null default public.current_agency_id() references public.agencies(id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  label text not null check (length(btrim(label)) between 1 and 40),
  color text check (color is null or color in ('red','orange','amber','lime','emerald','teal','sky','blue','indigo','violet','fuchsia','pink','rose','zinc')),
  kind text not null default 'work' check (kind in ('work','review','client_approval','scheduling','done','alteration','recurring')),
  is_system boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (agency_id, key)
);
alter table public.flow_stages enable row level security;
create policy "flow_stages_select" on public.flow_stages
  for select to authenticated using (agency_id = (select public.current_agency_id()));
create policy "flow_stages_admin_write" on public.flow_stages
  for all to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role) and agency_id = (select public.current_agency_id()))
  with check (public.has_role((select auth.uid()), 'admin'::public.app_role) and agency_id = (select public.current_agency_id()));

-- The original Uau/social-media pipeline: seeded for every agency (existing and future).
create function public.seed_default_flow_stages(p_agency uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.flow_stages (agency_id, key, label, kind, is_system, sort_order) values
    (p_agency, 'captacao',      'Captação',      'work',            true, 0),
    (p_agency, 'planejamento',  'Planejamento',  'work',            true, 1),
    (p_agency, 'design',        'Design',        'work',            true, 2),
    (p_agency, 'edicao_videos', 'Vídeo',         'work',            true, 3),
    (p_agency, 'revisao',       'Revisão',       'review',          true, 4),
    (p_agency, 'pdf',           'PDF',           'client_approval', true, 5),
    (p_agency, 'agendamento',   'Agendamento',   'scheduling',      true, 6),
    (p_agency, 'entrega',       'Entregue',      'done',            true, 7),
    (p_agency, 'alteracoes',    'Alterações',    'alteration',      true, 8)
  on conflict (agency_id, key) do nothing;
$$;
revoke all on function public.seed_default_flow_stages(uuid) from public, anon, authenticated;

select public.seed_default_flow_stages(id) from public.agencies;

create function public.agencies_seed_flow_stages() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.seed_default_flow_stages(new.id);
  return new;
end $$;
create trigger agencies_seed_flow_stages after insert on public.agencies
  for each row execute function public.agencies_seed_flow_stages();
