-- Funis do Comercial: "Serviços UAU" (clientes da agência) e "Produtos digitais"
-- (leads do Raio-X, do Planejamento do Mês e do curso). Cada etapa pertence a um funil;
-- o funil do lead é o da etapa em que ele está.
--
-- Seguro para o que já existe: todas as etapas atuais vão para "Serviços UAU" sem mudar
-- nome, ordem ou leads. As etapas de "Produtos digitais" ficam nas posições 1000+, então
-- as rotinas que escolhem "a primeira etapa aberta" sozinhas (WhatsApp, formulário sem
-- etapa definida) continuam caindo em Serviços UAU.

-- ───────────── funis ─────────────
create table if not exists public.comercial_pipelines (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.current_agency_id() references public.agencies(id) on delete cascade,
  key text not null check (key in ('servicos', 'produtos')),
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (agency_id, key)
);

alter table public.comercial_pipelines enable row level security;
drop policy if exists comercial_pipelines_admin on public.comercial_pipelines;
create policy comercial_pipelines_admin on public.comercial_pipelines for all to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role) and agency_id = (select public.current_agency_id()))
  with check (public.has_role((select auth.uid()), 'admin'::public.app_role) and agency_id = (select public.current_agency_id()));

-- Devolve o funil da agência (cria se ainda não existir).
create or replace function public.comercial_pipeline_id(p_agency uuid, p_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  insert into public.comercial_pipelines (agency_id, key, name, position)
  values (p_agency, p_key, case p_key when 'produtos' then 'Produtos digitais' else 'Serviços UAU' end, case p_key when 'produtos' then 1 else 0 end)
  on conflict (agency_id, key) do nothing;
  select id into v_id from public.comercial_pipelines where agency_id = p_agency and key = p_key;
  return v_id;
end;
$$;
revoke execute on function public.comercial_pipeline_id(uuid, text) from public, anon, authenticated;

-- ───────────── etapa pertence a um funil ─────────────
alter table public.comercial_stages add column if not exists pipeline_id uuid references public.comercial_pipelines(id) on delete cascade;

-- Etapa criada sem funil (código antigo, rotinas do banco) vai para Serviços UAU;
-- e o funil precisa ser da mesma agência da etapa.
create or replace function public.comercial_stages_before_save()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pipeline_id is null then
    new.pipeline_id := public.comercial_pipeline_id(new.agency_id, 'servicos');
  end if;
  if not exists (select 1 from public.comercial_pipelines where id = new.pipeline_id and agency_id = new.agency_id) then
    raise exception 'Funil inválido para esta etapa';
  end if;
  return new;
end;
$$;
drop trigger if exists comercial_stages_before_save on public.comercial_stages;
create trigger comercial_stages_before_save before insert or update on public.comercial_stages
  for each row execute function public.comercial_stages_before_save();

update public.comercial_stages set pipeline_id = public.comercial_pipeline_id(agency_id, 'servicos') where pipeline_id is null;
alter table public.comercial_stages alter column pipeline_id set not null;
create index if not exists comercial_stages_pipeline on public.comercial_stages (pipeline_id, position);

-- ───────────── etapas padrão ─────────────
create or replace function public.comercial_seed_stages(p_agency uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pipe uuid := public.comercial_pipeline_id(p_agency, 'servicos');
begin
  if exists (select 1 from public.comercial_stages where pipeline_id = v_pipe) then return; end if;
  insert into public.comercial_stages (agency_id, pipeline_id, name, type, probability, position) values
    (p_agency, v_pipe, 'Entrar em contato', 'open', 5, 0),
    (p_agency, v_pipe, 'Novo contato', 'open', 10, 1),
    (p_agency, v_pipe, 'Em conversa', 'open', 20, 2),
    (p_agency, v_pipe, 'Reunião agendada', 'open', 35, 3),
    (p_agency, v_pipe, 'Reunião feita', 'open', 50, 4),
    (p_agency, v_pipe, 'Follow-up', 'open', 60, 5),
    (p_agency, v_pipe, 'Fechado', 'won', 100, 6),
    (p_agency, v_pipe, 'Perdido', 'lost', 0, 7);
end;
$$;
revoke execute on function public.comercial_seed_stages(uuid) from public, anon, authenticated;

create or replace function public.comercial_seed_produtos(p_agency uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pipe uuid := public.comercial_pipeline_id(p_agency, 'produtos');
begin
  if exists (select 1 from public.comercial_stages where pipeline_id = v_pipe) then return; end if;
  insert into public.comercial_stages (agency_id, pipeline_id, name, type, probability, position) values
    (p_agency, v_pipe, 'Novo lead', 'open', 10, 1000),
    (p_agency, v_pipe, 'Concluiu o teste', 'open', 25, 1001),
    (p_agency, v_pipe, 'Em conversa', 'open', 40, 1002),
    (p_agency, v_pipe, 'Lista do curso', 'open', 60, 1003),
    (p_agency, v_pipe, 'Comprou', 'won', 100, 1004),
    (p_agency, v_pipe, 'Perdido', 'lost', 0, 1005);
end;
$$;
revoke execute on function public.comercial_seed_produtos(uuid) from public, anon, authenticated;

create or replace function public.comercial_seed_defaults()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then raise exception 'sem permissão'; end if;
  perform public.comercial_seed_stages(public.current_agency_id());
  perform public.comercial_seed_produtos(public.current_agency_id());
end;
$$;
revoke execute on function public.comercial_seed_defaults() from public, anon;
grant execute on function public.comercial_seed_defaults() to authenticated;

-- Agências que já usam o Comercial ganham o funil de Produtos digitais agora.
select public.comercial_seed_produtos(a.agency_id)
from (select distinct agency_id from public.comercial_pipelines where key = 'servicos') a;

-- ───────────── excluir etapa: regras por funil ─────────────
create or replace function public.comercial_delete_stage(p_stage uuid, p_move_to uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agency uuid := public.current_agency_id();
  v_stage public.comercial_stages%rowtype;
  v_open int;
  v_leads int;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then raise exception 'sem permissão'; end if;
  select * into v_stage from public.comercial_stages where id = p_stage and agency_id = v_agency;
  if v_stage.id is null then raise exception 'etapa não encontrada'; end if;
  if v_stage.type <> 'open' then raise exception 'Ganho e Perdido são etapas fixas'; end if;
  select count(*) into v_open from public.comercial_stages where pipeline_id = v_stage.pipeline_id and type = 'open';
  if v_open <= 1 then raise exception 'O funil precisa de pelo menos uma etapa aberta'; end if;
  select count(*) into v_leads from public.comercial_leads where stage_id = p_stage;
  if v_leads > 0 then
    if p_move_to is null or p_move_to = p_stage
       or not exists (select 1 from public.comercial_stages where id = p_move_to and pipeline_id = v_stage.pipeline_id and type = 'open') then
      raise exception 'Escolha outra etapa aberta deste funil para mover os leads';
    end if;
    update public.comercial_leads set stage_id = p_move_to where stage_id = p_stage;
  end if;
  delete from public.comercial_stages where id = p_stage;
end;
$$;
revoke execute on function public.comercial_delete_stage(uuid, uuid) from public, anon;
grant execute on function public.comercial_delete_stage(uuid, uuid) to authenticated;
