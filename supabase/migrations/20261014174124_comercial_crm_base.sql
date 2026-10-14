-- CRM comercial (fases 1 a 3 do CRM-HANDOFF): etapas do funil, leads, linha do tempo, atividades, clientes ganhos e onboarding.
-- Tabelas novas (prefixo comercial_): as antigas crm_* seguem no banco só para consulta e para o WhatsApp que cria lead sozinho
-- e manda as boas-vindas; cada lead criado por esse caminho é espelhado aqui (comercial_mirror_crm_lead).
-- Todas as tabelas são por agência e só administradores da agência leem e escrevem (mesma regra do Comercial anterior).

create table public.comercial_stages (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.current_agency_id() references public.agencies(id) on delete cascade,
  name text not null,
  type text not null check (type in ('open', 'won', 'lost')),
  probability int not null default 0 check (probability between 0 and 100),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index comercial_stages_agency_pos on public.comercial_stages (agency_id, position);

create table public.comercial_leads (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.current_agency_id() references public.agencies(id) on delete cascade,
  name text not null,
  role text,
  company text,
  segment text,
  city text,
  size text,
  site text,
  phone text,
  phone_key text,
  email text,
  instagram text,
  source text not null default 'WhatsApp',
  services text[] not null default '{}',
  tags text[] not null default '{}',
  owner_id uuid references auth.users(id) on delete set null,
  value numeric not null default 0,
  setup numeric not null default 0,
  close_by date,
  stage_id uuid not null references public.comercial_stages(id),
  stage_changed_at timestamptz not null default now(),
  closed_at timestamptz,
  loss_reason text,
  whatsapp_contact_id uuid,
  legacy_lead_id uuid unique,
  last_message_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comercial_leads_agency_stage on public.comercial_leads (agency_id, stage_id);
create index comercial_leads_agency_phone on public.comercial_leads (agency_id, phone_key);

create table public.comercial_lead_notes (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.current_agency_id() references public.agencies(id) on delete cascade,
  lead_id uuid not null references public.comercial_leads(id) on delete cascade,
  kind text not null default 'Anotação',
  text text not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index comercial_lead_notes_lead on public.comercial_lead_notes (lead_id, created_at desc);

create table public.comercial_activities (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.current_agency_id() references public.agencies(id) on delete cascade,
  lead_id uuid not null references public.comercial_leads(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  type text not null default 'Follow-up',
  title text not null,
  due_date date not null,
  done boolean not null default false,
  done_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index comercial_activities_agency_due on public.comercial_activities (agency_id, done, due_date);
create index comercial_activities_lead on public.comercial_activities (lead_id);

create table public.comercial_clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.current_agency_id() references public.agencies(id) on delete cascade,
  lead_id uuid not null unique references public.comercial_leads(id) on delete cascade,
  onboarding_stage text not null default 'briefing' check (onboarding_stage in ('briefing', 'plano', 'acessos', 'producao')),
  value numeric not null default 0,
  setup numeric not null default 0,
  months int not null default 6,
  start_date date not null default current_date,
  videos int not null default 0,
  artes int not null default 0,
  approver text,
  services text[] not null default '{}',
  squad jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.comercial_onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.current_agency_id() references public.agencies(id) on delete cascade,
  client_id uuid not null references public.comercial_clients(id) on delete cascade,
  title text not null,
  owner_id uuid references auth.users(id) on delete set null,
  done boolean not null default false,
  position int not null default 0
);
create index comercial_onboarding_tasks_client on public.comercial_onboarding_tasks (client_id, position);

-- RLS: administradores da agência
do $$
declare t text;
begin
  foreach t in array array['comercial_stages', 'comercial_leads', 'comercial_lead_notes', 'comercial_activities', 'comercial_clients', 'comercial_onboarding_tasks'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.has_role((select auth.uid()), ''admin''::public.app_role) and agency_id = (select public.current_agency_id())) with check (public.has_role((select auth.uid()), ''admin''::public.app_role) and agency_id = (select public.current_agency_id()))',
      t || '_admin_agency', t);
  end loop;
end $$;

-- ───────────── etapas padrão ─────────────
create or replace function public.comercial_seed_stages(p_agency uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.comercial_stages where agency_id = p_agency) then return; end if;
  insert into public.comercial_stages (agency_id, name, type, probability, position) values
    (p_agency, 'Entrar em contato', 'open', 5, 0),
    (p_agency, 'Novo contato', 'open', 10, 1),
    (p_agency, 'Em conversa', 'open', 20, 2),
    (p_agency, 'Reunião agendada', 'open', 35, 3),
    (p_agency, 'Reunião feita', 'open', 50, 4),
    (p_agency, 'Follow-up', 'open', 60, 5),
    (p_agency, 'Fechado', 'won', 100, 6),
    (p_agency, 'Perdido', 'lost', 0, 7);
end;
$$;
revoke execute on function public.comercial_seed_stages(uuid) from public, anon, authenticated;

create or replace function public.comercial_seed_defaults()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then raise exception 'sem permissão'; end if;
  perform public.comercial_seed_stages(public.current_agency_id());
end;
$$;
revoke execute on function public.comercial_seed_defaults() from public, anon;
grant execute on function public.comercial_seed_defaults() to authenticated;

-- ───────────── regras do lead ─────────────
create or replace function public.comercial_leads_before_save()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
begin
  if new.phone is not null and btrim(new.phone) <> '' then
    new.phone_key := public.whatsapp_phone_key(new.phone);
  end if;
  select type into v_type from public.comercial_stages where id = new.stage_id;
  if tg_op = 'UPDATE' and old.stage_id is distinct from new.stage_id then
    new.stage_changed_at := now();
  end if;
  if v_type = 'lost' and coalesce(btrim(new.loss_reason), '') = '' then
    raise exception 'Motivo de perda obrigatório quando a etapa é Perdido';
  end if;
  if v_type in ('won', 'lost') then
    if tg_op = 'INSERT' or old.stage_id is distinct from new.stage_id or new.closed_at is null then new.closed_at := now(); end if;
  else
    new.closed_at := null;
    new.loss_reason := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.comercial_leads_after_save()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new record;
  v_old record;
  v_name text;
begin
  if tg_op = 'INSERT' then
    insert into public.comercial_lead_notes (agency_id, lead_id, kind, text) values (new.agency_id, new.id, 'Sistema', 'Lead cadastrado');
    return new;
  end if;

  if old.stage_id is distinct from new.stage_id then
    select name, type into v_new from public.comercial_stages where id = new.stage_id;
    select name, type into v_old from public.comercial_stages where id = old.stage_id;
    if v_new.type = 'lost' then
      insert into public.comercial_lead_notes (agency_id, lead_id, kind, text) values (new.agency_id, new.id, 'Sistema', 'Marcado como perdido: ' || coalesce(new.loss_reason, ''));
    elsif v_new.type = 'open' and v_old.type <> 'open' then
      insert into public.comercial_lead_notes (agency_id, lead_id, kind, text) values (new.agency_id, new.id, 'Sistema', 'Negócio reaberto em ' || v_new.name);
    elsif v_new.type = 'open' then
      insert into public.comercial_lead_notes (agency_id, lead_id, kind, text) values (new.agency_id, new.id, 'Sistema', 'Movido de ' || v_old.name || ' para ' || v_new.name);
    end if;
    -- negócio fechado (ganho ou perdido): as ações que sobraram deixam de valer, sem encher a linha do tempo de avisos
    if v_new.type in ('won', 'lost') then
      perform set_config('comercial.silent', 'on', true);
      update public.comercial_activities set done = true, done_at = now() where lead_id = new.id and not done;
      perform set_config('comercial.silent', 'off', true);
    end if;
  end if;

  if old.owner_id is distinct from new.owner_id then
    select display_name into v_name from public.team_members where user_id = new.owner_id limit 1;
    insert into public.comercial_lead_notes (agency_id, lead_id, kind, text)
    values (new.agency_id, new.id, 'Sistema', 'Responsável alterado para ' || coalesce(v_name, 'ninguém'));
  end if;
  return new;
end;
$$;

create trigger trg_comercial_leads_before_save before insert or update on public.comercial_leads
for each row execute function public.comercial_leads_before_save();
create trigger trg_comercial_leads_after_save after insert or update on public.comercial_leads
for each row execute function public.comercial_leads_after_save();

create or replace function public.comercial_activities_after_done()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.done and not old.done then
    if new.done_at is null then update public.comercial_activities set done_at = now() where id = new.id; end if;
    if coalesce(current_setting('comercial.silent', true), '') <> 'on' then
      insert into public.comercial_lead_notes (agency_id, lead_id, kind, text) values (new.agency_id, new.lead_id, 'Atividade', new.type || ' concluído: ' || new.title);
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_comercial_activities_after_done after update of done on public.comercial_activities
for each row execute function public.comercial_activities_after_done();

-- ───────────── ganhar: cliente + checklist de implantação ─────────────
create or replace function public.comercial_win_lead(
  p_lead uuid, p_stage uuid, p_value numeric, p_setup numeric, p_months int, p_start date,
  p_videos int, p_artes int, p_approver text, p_services text[], p_squad jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agency uuid := public.current_agency_id();
  v_lead public.comercial_leads%rowtype;
  v_type text;
  v_client uuid;
  v_at uuid := nullif(p_squad ->> 'atendimento_id', '')::uuid;
  v_sm uuid := nullif(p_squad ->> 'social_media_id', '')::uuid;
  v_tr uuid := nullif(p_squad ->> 'trafego_id', '')::uuid;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then raise exception 'sem permissão'; end if;
  select * into v_lead from public.comercial_leads where id = p_lead and agency_id = v_agency;
  if v_lead.id is null then raise exception 'lead não encontrado'; end if;
  select type into v_type from public.comercial_stages where id = p_stage and agency_id = v_agency;
  if v_type is distinct from 'won' then raise exception 'etapa de ganho inválida'; end if;

  update public.comercial_leads
  set value = coalesce(p_value, 0), setup = coalesce(p_setup, 0), services = coalesce(p_services, '{}'), stage_id = p_stage
  where id = p_lead;

  insert into public.comercial_clients (agency_id, lead_id, value, setup, months, start_date, videos, artes, approver, services, squad)
  values (v_agency, p_lead, coalesce(p_value, 0), coalesce(p_setup, 0), greatest(coalesce(p_months, 6), 1), coalesce(p_start, current_date),
          greatest(coalesce(p_videos, 0), 0), greatest(coalesce(p_artes, 0), 0), nullif(btrim(p_approver), ''), coalesce(p_services, '{}'), coalesce(p_squad, '{}'::jsonb))
  on conflict (lead_id) do nothing
  returning id into v_client;

  if v_client is not null then
    insert into public.comercial_onboarding_tasks (agency_id, client_id, title, owner_id, position) values
      (v_agency, v_client, 'Agendar reunião de briefing online', v_at, 0),
      (v_agency, v_client, 'Fazer briefing com o cliente', v_at, 1),
      (v_agency, v_client, 'Montar plano de marketing', v_lead.owner_id, 2),
      (v_agency, v_client, 'Apresentar plano presencialmente', v_lead.owner_id, 3),
      (v_agency, v_client, 'Coletar acessos (Instagram, Meta Ads, Google)', v_tr, 4),
      (v_agency, v_client, 'Montar cronograma do primeiro mês', v_sm, 5);
    insert into public.comercial_lead_notes (agency_id, lead_id, kind, text)
    values (v_agency, p_lead, 'Sistema', 'Venda fechada (R$ ' || round(coalesce(p_value, 0))::text || '/mês, ' || greatest(coalesce(p_months, 6), 1)::text || ' meses). Onboarding iniciado com 6 tarefas.');
  else
    select id into v_client from public.comercial_clients where lead_id = p_lead;
  end if;
  return v_client;
end;
$$;
revoke execute on function public.comercial_win_lead(uuid, uuid, numeric, numeric, int, date, int, int, text, text[], jsonb) from public, anon;
grant execute on function public.comercial_win_lead(uuid, uuid, numeric, numeric, int, date, int, int, text, text[], jsonb) to authenticated;

-- ───────────── excluir etapa movendo os leads ─────────────
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
  select count(*) into v_open from public.comercial_stages where agency_id = v_agency and type = 'open';
  if v_open <= 1 then raise exception 'O funil precisa de pelo menos uma etapa aberta'; end if;
  select count(*) into v_leads from public.comercial_leads where stage_id = p_stage;
  if v_leads > 0 then
    if p_move_to is null or p_move_to = p_stage
       or not exists (select 1 from public.comercial_stages where id = p_move_to and agency_id = v_agency and type = 'open') then
      raise exception 'Escolha outra etapa aberta para mover os leads';
    end if;
    update public.comercial_leads set stage_id = p_move_to where stage_id = p_stage;
  end if;
  delete from public.comercial_stages where id = p_stage;
end;
$$;
revoke execute on function public.comercial_delete_stage(uuid, uuid) from public, anon;
grant execute on function public.comercial_delete_stage(uuid, uuid) to authenticated;

-- ───────────── lead que chega sozinho pelo WhatsApp aparece no novo CRM ─────────────
-- O WhatsApp continua criando o lead antigo (e mandando as boas-vindas, como sempre); aqui ele é espelhado e a primeira ação já nasce agendada.
create or replace function public.comercial_mirror_crm_lead()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead uuid;
  v_stage uuid;
  v_owner uuid;
  v_source text;
begin
  begin
    if tg_op = 'INSERT' then
      perform public.comercial_seed_stages(new.agency_id);
      if new.phone_key is not null then
        select id into v_lead from public.comercial_leads where agency_id = new.agency_id and phone_key = new.phone_key limit 1;
      end if;
      if v_lead is null then
        select id into v_stage from public.comercial_stages where agency_id = new.agency_id and type = 'open' order by position offset 1 limit 1;
        if v_stage is null then
          select id into v_stage from public.comercial_stages where agency_id = new.agency_id and type = 'open' order by position limit 1;
        end if;
        v_source := case lower(coalesce(new.origem, 'whatsapp'))
          when 'instagram' then 'Instagram' when 'indicacao' then 'Indicação' when 'indicação' then 'Indicação' else 'WhatsApp' end;
        v_owner := coalesce(new.responsavel_id, (select ur.user_id from public.user_roles ur join public.team_members tm on tm.user_id = ur.user_id
                                                  where ur.role = 'admin'::public.app_role and tm.agency_id = new.agency_id order by ur.user_id limit 1));
        insert into public.comercial_leads (agency_id, name, company, phone, source, owner_id, stage_id, whatsapp_contact_id, legacy_lead_id, last_message_at, created_by)
        values (new.agency_id, coalesce(nullif(btrim(new.nome), ''), 'Novo lead'), nullif(btrim(new.empresa), ''), new.telefone, v_source, v_owner, v_stage,
                new.whatsapp_contact_id, new.id, new.last_message_at, null)
        returning id into v_lead;
        insert into public.comercial_activities (agency_id, lead_id, owner_id, type, title, due_date, created_by)
        values (new.agency_id, v_lead, v_owner, 'Follow-up', 'Responder o lead e puxar reunião', (now() at time zone 'America/Sao_Paulo')::date, null);
      else
        update public.comercial_leads
        set legacy_lead_id = coalesce(legacy_lead_id, new.id),
            whatsapp_contact_id = coalesce(whatsapp_contact_id, new.whatsapp_contact_id),
            last_message_at = coalesce(new.last_message_at, last_message_at)
        where id = v_lead;
      end if;
    else
      update public.comercial_leads
      set last_message_at = coalesce(new.last_message_at, last_message_at),
          whatsapp_contact_id = coalesce(whatsapp_contact_id, new.whatsapp_contact_id),
          name = case when (name = 'Novo lead' or public.crm_is_phoneish(name)) and nullif(btrim(new.nome), '') is not null and not public.crm_is_phoneish(new.nome)
                      then new.nome else name end
      where legacy_lead_id = new.id;
    end if;
  exception when others then
    null; -- o WhatsApp e as boas-vindas nunca podem falhar por causa do espelho
  end;
  return new;
end;
$$;
revoke execute on function public.comercial_mirror_crm_lead() from public, anon, authenticated;

create trigger trg_crm_leads_zz_mirror_comercial after insert on public.crm_leads
for each row execute function public.comercial_mirror_crm_lead();
create trigger trg_crm_leads_zz_mirror_comercial_upd after update of last_message_at, nome, whatsapp_contact_id on public.crm_leads
for each row execute function public.comercial_mirror_crm_lead();

revoke execute on function public.comercial_leads_before_save() from public, anon, authenticated;
revoke execute on function public.comercial_leads_after_save() from public, anon, authenticated;
revoke execute on function public.comercial_activities_after_done() from public, anon, authenticated;
