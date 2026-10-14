-- CRM comercial, fases 4 e 6: formulários (com página pública), automações (editor + motor de execução) e biblioteca de modelos.
-- Tudo por agência, só administradores da agência leem/escrevem pelo app; o formulário público entra pela função comercial_submit_form
-- (chamada só pela edge function public-formulario, com a chave de serviço).

create table public.comercial_forms (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.current_agency_id() references public.agencies(id) on delete cascade,
  key text not null default 'blank',
  name text not null,
  description text not null default '',
  fields jsonb not null default '[]'::jsonb,
  active boolean not null default false,
  dest jsonb not null default '{"create": true, "stage_id": null, "owner_id": null, "tag": ""}'::jsonb,
  thanks text not null default 'Recebemos suas respostas! Nossa equipe vai te chamar no WhatsApp em breve.',
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.comercial_form_responses (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.current_agency_id() references public.agencies(id) on delete cascade,
  form_id uuid not null references public.comercial_forms(id) on delete cascade,
  lead_id uuid references public.comercial_leads(id) on delete set null,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);
create index comercial_form_responses_form on public.comercial_form_responses (form_id, submitted_at desc);

create table public.comercial_automations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.current_agency_id() references public.agencies(id) on delete cascade,
  name text not null,
  active boolean not null default false,
  trigger jsonb not null default '{"type": "new"}'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  runs int not null default 0,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.comercial_automation_runs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.current_agency_id() references public.agencies(id) on delete cascade,
  automation_id uuid not null references public.comercial_automations(id) on delete cascade,
  lead_id uuid not null references public.comercial_leads(id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'waiting', 'stopped', 'done')),
  pc int not null default 0,
  vars jsonb not null default '{}'::jsonb,
  wait_kind text check (wait_kind in ('time', 'reply', 'answer')),
  resume_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comercial_runs_waiting on public.comercial_automation_runs (status, resume_at);
create index comercial_runs_lead on public.comercial_automation_runs (lead_id, status);

create table public.comercial_templates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.current_agency_id() references public.agencies(id) on delete cascade,
  kind text not null check (kind in ('auto', 'form')),
  name text not null,
  description text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['comercial_forms', 'comercial_form_responses', 'comercial_automations', 'comercial_automation_runs', 'comercial_templates'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.has_role((select auth.uid()), ''admin''::public.app_role) and agency_id = (select public.current_agency_id())) with check (public.has_role((select auth.uid()), ''admin''::public.app_role) and agency_id = (select public.current_agency_id()))',
      t || '_admin_agency', t);
  end loop;
end $$;

create trigger trg_comercial_forms_updated before update on public.comercial_forms for each row execute function public.update_updated_at_column();
create trigger trg_comercial_automations_updated before update on public.comercial_automations for each row execute function public.update_updated_at_column();

-- ───────────── apoio do motor ─────────────

create or replace function public.comercial_flatten(p_steps jsonb, p_base int default 0)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $fn$
declare
  v_out jsonb := '[]'::jsonb;
  s jsonb;
  v_yes jsonb;
  v_no jsonb;
  v_idx int;
  v_ly int;
  v_ln int;
begin
  for s in select * from jsonb_array_elements(coalesce(p_steps, '[]'::jsonb)) loop
    if s ->> 'type' = 'cond' then
      v_idx := p_base + jsonb_array_length(v_out);
      v_yes := public.comercial_flatten(s -> 'yes', v_idx + 1);
      v_ly := jsonb_array_length(v_yes);
      v_no := public.comercial_flatten(s -> 'no', v_idx + 2 + v_ly);
      v_ln := jsonb_array_length(v_no);
      v_out := v_out || jsonb_build_array(s || jsonb_build_object('else_to', v_idx + 2 + v_ly));
      v_out := v_out || v_yes;
      v_out := v_out || jsonb_build_array(jsonb_build_object('type', 'jump', 'to', v_idx + 2 + v_ly + v_ln));
      v_out := v_out || v_no;
    else
      v_out := v_out || jsonb_build_array(s);
    end if;
  end loop;
  return v_out;
end;
$fn$;

-- {nome} (primeiro nome, sem "Dr./Dra.") e {empresa}; sem nome, a variável e a pontuação em volta somem
create or replace function public.comercial_fill(p_text text, p_lead public.comercial_leads)
returns text
language plpgsql
stable
set search_path = ''
as $fn$
declare
  v text := coalesce(p_text, '');
  v_first text := split_part(btrim(regexp_replace(coalesce(p_lead.name, ''), '^(dra?\.?)\s+', '', 'i')), ' ', 1);
begin
  if v_first = '' or lower(coalesce(p_lead.name, '')) = 'novo lead' or public.crm_is_phoneish(p_lead.name) then
    v := regexp_replace(v, '[\s,;:]*\{nome\}[\s,;:]*', ' ', 'g');
    v := regexp_replace(v, '\s+([,.!?;:])', '\1', 'g');
    v := regexp_replace(v, '\s{2,}', ' ', 'g');
    v := btrim(v);
  else
    v := replace(v, '{nome}', v_first);
  end if;
  return replace(v, '{empresa}', coalesce(nullif(btrim(p_lead.company), ''), 'sua empresa'));
end;
$fn$;

create or replace function public.comercial_send_wa(p_lead public.comercial_leads, p_text text, p_ref text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_phone text := regexp_replace(coalesce(p_lead.phone, ''), '\D', '', 'g');
begin
  if v_phone = '' or btrim(coalesce(p_text, '')) = '' then return false; end if;
  insert into public.whatsapp_outbox (notification_type, message, target_phone, source_ref, status, agency_id)
  values ('crm_automation', p_text, v_phone, p_ref, 'queued', p_lead.agency_id);
  begin
    perform net.http_post(
      url := 'https://bzzubzjbsjwuvchuhklr.supabase.co/functions/v1/whatsapp-dispatch',
      headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6enViempic2p3dXZjaHVoa2xyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5ODE5NDcsImV4cCI6MjEwMDU1Nzk0N30.KlznJ82oOa7DSXDNDZBdzoPhwYTSdP6X6cOzLWM2Q24"}'::jsonb,
      body := '{"action":"process_outbox","limit":5}'::jsonb
    );
  exception when others then null;
  end;
  return true;
end;
$fn$;

-- ───────────── interpretador ─────────────
-- A árvore de passos vira uma lista (a condição ganha "else_to" e o fim do caminho "sim" ganha um "jump"); o andamento fica em runs.pc.

create or replace function public.comercial_run_advance(p_run uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  r public.comercial_automation_runs%rowtype;
  a public.comercial_automations%rowtype;
  l public.comercial_leads%rowtype;
  v_prog jsonb;
  v_n int;
  v_ins jsonb;
  t text;
  v_vars jsonb;
  v_guard int := 0;
  v_text text;
  v_opts text;
  v_ok boolean;
  v_val text;
  v_target uuid;
  v_stage record;
  v_form record;
  v_amount int;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select * into r from public.comercial_automation_runs where id = p_run for update;
  if r.id is null or r.status not in ('running', 'waiting') then return; end if;
  select * into a from public.comercial_automations where id = r.automation_id;
  select * into l from public.comercial_leads where id = r.lead_id;
  if a.id is null or l.id is null then
    update public.comercial_automation_runs set status = 'stopped', updated_at = now() where id = p_run;
    return;
  end if;
  v_prog := public.comercial_flatten(a.steps);
  v_n := jsonb_array_length(v_prog);
  v_vars := r.vars;
  update public.comercial_automation_runs set status = 'running', wait_kind = null, resume_at = null, updated_at = now() where id = p_run;

  while r.pc < v_n and v_guard < 100 loop
    v_guard := v_guard + 1;
    v_ins := v_prog -> r.pc;
    t := v_ins ->> 'type';
    r.pc := r.pc + 1;

    if t = 'msg' then
      v_text := public.comercial_fill(v_ins ->> 'text', l);
      if public.comercial_send_wa(l, v_text, 'crm_auto:' || p_run::text) then
        insert into public.comercial_lead_notes (agency_id, lead_id, kind, text) values (l.agency_id, l.id, 'Automação', 'Mensagem enviada: ' || left(v_text, 200));
      else
        insert into public.comercial_lead_notes (agency_id, lead_id, kind, text) values (l.agency_id, l.id, 'Automação', 'Mensagem não enviada: lead sem WhatsApp');
      end if;

    elsif t in ('ask', 'meet') then
      v_text := public.comercial_fill(v_ins ->> 'text', l);
      select string_agg('• ' || x, E'\n') into v_opts from jsonb_array_elements_text(coalesce(v_ins -> 'options', '[]'::jsonb)) x;
      if public.comercial_send_wa(l, v_text || coalesce(E'\n' || v_opts, ''), 'crm_auto:' || p_run::text) then
        insert into public.comercial_lead_notes (agency_id, lead_id, kind, text) values (l.agency_id, l.id, 'Automação', 'Pergunta enviada: "' || left(v_text, 160) || '" (aguardando resposta)');
      else
        insert into public.comercial_lead_notes (agency_id, lead_id, kind, text) values (l.agency_id, l.id, 'Automação', 'Pergunta não enviada: lead sem WhatsApp');
      end if;
      v_vars := v_vars || jsonb_build_object('pending', jsonb_build_object('type', t, 'save_to', coalesce(v_ins ->> 'saveTo', '')));
      update public.comercial_automation_runs
      set status = 'waiting', wait_kind = 'answer', resume_at = now() + interval '3 days', pc = r.pc, vars = v_vars, updated_at = now()
      where id = p_run;
      return;

    elsif t = 'form' then
      select slug, name into v_form from public.comercial_forms
      where agency_id = l.agency_id
        and ((coalesce(v_ins ->> 'formId', '') <> '' and id::text = v_ins ->> 'formId') or (coalesce(v_ins ->> 'formId', '') = '' and key = v_ins ->> 'formKey'))
      limit 1;
      if v_form.slug is not null then
        v_text := 'Preencha aqui: https://appfluxo.app.br/f/' || v_form.slug;
        if public.comercial_send_wa(l, v_text, 'crm_auto:' || p_run::text) then
          insert into public.comercial_lead_notes (agency_id, lead_id, kind, text) values (l.agency_id, l.id, 'Automação', 'Formulário enviado: ' || v_form.name);
        end if;
      else
        insert into public.comercial_lead_notes (agency_id, lead_id, kind, text) values (l.agency_id, l.id, 'Automação', 'Formulário não enviado: nenhum formulário escolhido');
      end if;

    elsif t = 'tag' then
      if coalesce(btrim(v_ins ->> 'tag'), '') <> '' and not (btrim(v_ins ->> 'tag') = any (l.tags)) then
        update public.comercial_leads set tags = tags || btrim(v_ins ->> 'tag') where id = l.id;
        select * into l from public.comercial_leads where id = l.id;
        insert into public.comercial_lead_notes (agency_id, lead_id, kind, text) values (l.agency_id, l.id, 'Automação', 'Etiqueta "' || btrim(v_ins ->> 'tag') || '" aplicada');
      end if;

    elsif t = 'deal' then
      perform set_config('comercial.silent_fire', 'on', true);
      begin
        v_target := nullif(v_ins ->> 'stage', '')::uuid;
      exception when others then v_target := null;
      end;
      if v_target is not null then
        select id, name, type into v_stage from public.comercial_stages where id = v_target and agency_id = l.agency_id;
        if v_stage.id is not null and v_stage.type = 'open' and l.stage_id <> v_stage.id then
          update public.comercial_leads set stage_id = v_stage.id where id = l.id;
          insert into public.comercial_lead_notes (agency_id, lead_id, kind, text) values (l.agency_id, l.id, 'Automação', 'Movido para ' || v_stage.name);
        end if;
      end if;
      begin
        v_target := case when coalesce(v_ins ->> 'owner', '') in ('', 'lead') then null else (v_ins ->> 'owner')::uuid end;
      exception when others then v_target := null;
      end;
      if v_target is not null and l.owner_id is distinct from v_target then
        update public.comercial_leads set owner_id = v_target where id = l.id;
      end if;
      perform set_config('comercial.silent_fire', 'off', true);
      select * into l from public.comercial_leads where id = l.id;

    elsif t = 'task' then
      begin
        v_target := case when coalesce(v_ins ->> 'owner', 'lead') = 'lead' then l.owner_id else (v_ins ->> 'owner')::uuid end;
      exception when others then v_target := l.owner_id;
      end;
      insert into public.comercial_activities (agency_id, lead_id, owner_id, type, title, due_date)
      values (l.agency_id, l.id, v_target, coalesce(nullif(v_ins ->> 'ttype', ''), 'Tarefa'), coalesce(nullif(v_ins ->> 'title', ''), 'Tarefa da automação'),
              v_today + greatest(coalesce((v_ins ->> 'days')::int, 0), 0));
      insert into public.comercial_lead_notes (agency_id, lead_id, kind, text) values (l.agency_id, l.id, 'Automação', 'Tarefa criada: ' || coalesce(v_ins ->> 'title', ''));

    elsif t = 'human' then
      insert into public.comercial_lead_notes (agency_id, lead_id, kind, text)
      values (l.agency_id, l.id, 'Automação', 'Atendimento passado para uma pessoa. Automação pausada para esse lead.');
      update public.comercial_automation_runs set status = 'stopped', pc = r.pc, vars = v_vars, updated_at = now() where id = p_run;
      return;

    elsif t = 'wait' then
      v_amount := greatest(coalesce((v_ins ->> 'amount')::int, 1), 1);
      update public.comercial_automation_runs
      set status = 'waiting', pc = r.pc, vars = v_vars,
          wait_kind = case when v_ins ->> 'until' = 'resposta' then 'reply' else 'time' end,
          resume_at = now() + (v_amount::text || case when v_ins ->> 'unit' = 'horas' then ' hours' else ' days' end)::interval,
          updated_at = now()
      where id = p_run;
      insert into public.comercial_lead_notes (agency_id, lead_id, kind, text)
      values (l.agency_id, l.id, 'Automação', 'Aguardando ' || case when v_ins ->> 'until' = 'resposta' then 'resposta por até ' else '' end || v_amount::text || ' ' || coalesce(v_ins ->> 'unit', 'dias') || '. Próximos passos programados.');
      return;

    elsif t = 'cond' then
      if v_ins ->> 'field' = 'replied' then
        v_ok := coalesce((v_vars ->> 'replied')::boolean, false);
      else
        v_val := case v_ins ->> 'field'
          when 'answer' then coalesce(v_vars ->> 'answer', '')
          when 'services' then array_to_string(l.services, ', ')
          when 'tags' then array_to_string(l.tags, ', ')
          when 'segment' then coalesce(l.segment, '')
          when 'source' then coalesce(l.source, '')
          else '' end;
        v_ok := position(lower(coalesce(v_ins ->> 'value', '')) in lower(v_val)) > 0;
      end if;
      if not v_ok then r.pc := (v_ins ->> 'else_to')::int; end if;

    elsif t = 'jump' then
      r.pc := (v_ins ->> 'to')::int;
    end if;
  end loop;

  update public.comercial_automation_runs set status = 'done', pc = r.pc, vars = v_vars, updated_at = now() where id = p_run;
end;
$fn$;

-- retoma uma automação parada em "aguardar" ou "pergunta": p_replied null = só passou o tempo
create or replace function public.comercial_run_resume(p_run uuid, p_replied boolean, p_answer text)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  r public.comercial_automation_runs%rowtype;
  l public.comercial_leads%rowtype;
  v jsonb;
  v_type text;
  v_save text;
  v_svc text[];
begin
  select * into r from public.comercial_automation_runs where id = p_run for update;
  if r.id is null or r.status <> 'waiting' then return; end if;
  v := r.vars;
  if p_replied is not null then v := v || jsonb_build_object('replied', p_replied); end if;
  if p_answer is not null then
    v := v || jsonb_build_object('answer', left(p_answer, 500));
    v_type := v #>> '{pending,type}';
    v_save := coalesce(v #>> '{pending,save_to}', '');
    select * into l from public.comercial_leads where id = r.lead_id;
    if l.id is not null and v_type is not null then
      if v_type = 'meet' then
        insert into public.comercial_activities (agency_id, lead_id, owner_id, type, title, due_date)
        values (l.agency_id, l.id, l.owner_id, 'Reunião', 'Reunião: ' || left(p_answer, 120), (now() at time zone 'America/Sao_Paulo')::date + 1);
        insert into public.comercial_lead_notes (agency_id, lead_id, kind, text) values (l.agency_id, l.id, 'Automação', 'Reunião registrada: ' || left(p_answer, 160));
      else
        if v_save = 'segment' then
          update public.comercial_leads set segment = left(p_answer, 80) where id = l.id;
        elsif v_save = 'services' then
          v_svc := array(select s from unnest(array['Posicionamento', 'Conteúdo', 'Tráfego pago']) s
                         where p_answer ilike '%' || s || '%' or (s = 'Conteúdo' and p_answer ilike '%redes%') or (s = 'Tráfego pago' and p_answer ilike '%tráfego%'));
          if coalesce(array_length(v_svc, 1), 0) > 0 then
            update public.comercial_leads set services = array(select distinct x from unnest(services || v_svc) x) where id = l.id;
          end if;
        end if;
        insert into public.comercial_lead_notes (agency_id, lead_id, kind, text)
        values (l.agency_id, l.id, 'Automação', 'Resposta do lead: ' || left(p_answer, 200) || case when v_save <> '' then ' (guardada em ' || v_save || ')' else '' end);
      end if;
    end if;
  end if;
  v := v - 'pending';
  update public.comercial_automation_runs set vars = v, updated_at = now() where id = p_run;
  perform public.comercial_run_advance(p_run);
end;
$fn$;

create or replace function public.comercial_fire(p_type text, p_lead uuid, p_param jsonb default '{}'::jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  a record;
  l public.comercial_leads%rowtype;
  v_run uuid;
  n int := 0;
begin
  select * into l from public.comercial_leads where id = p_lead;
  if l.id is null then return 0; end if;
  for a in
    select * from public.comercial_automations
    where agency_id = l.agency_id and active and trigger ->> 'type' = p_type
      and (p_type <> 'form' or coalesce(trigger ->> 'formId', '') = '' or trigger ->> 'formId' = p_param ->> 'formId')
      and (p_type <> 'stage' or trigger ->> 'stage' = p_param ->> 'stage')
  loop
    insert into public.comercial_automation_runs (agency_id, automation_id, lead_id) values (l.agency_id, a.id, l.id) returning id into v_run;
    update public.comercial_automations set runs = runs + 1, last_run_at = now() where id = a.id;
    insert into public.comercial_lead_notes (agency_id, lead_id, kind, text) values (l.agency_id, l.id, 'Automação', '"' || a.name || '" iniciada');
    begin
      perform public.comercial_run_advance(v_run);
    exception when others then
      update public.comercial_automation_runs set status = 'stopped', updated_at = now() where id = v_run;
      insert into public.comercial_lead_notes (agency_id, lead_id, kind, text) values (l.agency_id, l.id, 'Automação', '"' || a.name || '" parou por um erro');
    end;
    n := n + 1;
  end loop;
  return n;
end;
$fn$;

-- ───────────── gatilhos no banco ─────────────

create or replace function public.comercial_leads_fire_new()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if coalesce(current_setting('comercial.silent_fire', true), '') <> 'on' then
    begin
      perform public.comercial_fire('new', new.id);
      if new.legacy_lead_id is not null then perform public.comercial_fire('msg_in', new.id); end if;
    exception when others then null;
    end;
  end if;
  return new;
end;
$fn$;
create trigger trg_comercial_leads_fire_new after insert on public.comercial_leads for each row execute function public.comercial_leads_fire_new();

create or replace function public.comercial_leads_fire_stage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_type text;
begin
  if old.stage_id is distinct from new.stage_id and coalesce(current_setting('comercial.silent_fire', true), '') <> 'on' then
    select type into v_type from public.comercial_stages where id = new.stage_id;
    if v_type = 'open' then
      begin
        perform public.comercial_fire('stage', new.id, jsonb_build_object('stage', new.stage_id::text));
      exception when others then null;
      end;
    end if;
  end if;
  return new;
end;
$fn$;
create trigger trg_comercial_leads_fire_stage after update of stage_id on public.comercial_leads for each row execute function public.comercial_leads_fire_stage();

-- o lead respondeu no WhatsApp: libera as automações que estavam esperando resposta
create or replace function public.comercial_wa_inbound()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_run uuid;
begin
  if new.contact_phone_key is null then return new; end if;
  begin
    for v_run in
      select r.id from public.comercial_automation_runs r join public.comercial_leads l on l.id = r.lead_id
      where r.status = 'waiting' and r.wait_kind in ('reply', 'answer') and l.phone_key = new.contact_phone_key and l.agency_id = new.agency_id
    loop
      perform public.comercial_run_resume(v_run, true, new.body);
    end loop;
  exception when others then null;
  end;
  return new;
end;
$fn$;
create trigger trg_comercial_wa_inbound after insert on public.whatsapp_messages for each row when (new.direction = 'in') execute function public.comercial_wa_inbound();

-- a cada minuto: retoma o que já esperou o tempo; todo dia às 9h (Brasília): negócios parados
create or replace function public.comercial_automations_tick()
returns int
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  r record;
  n int := 0;
begin
  for r in select id, wait_kind from public.comercial_automation_runs where status = 'waiting' and resume_at is not null and resume_at <= now() order by resume_at limit 100 loop
    begin
      perform public.comercial_run_resume(r.id, case when r.wait_kind in ('reply', 'answer') then false else null end, null);
      n := n + 1;
    exception when others then
      update public.comercial_automation_runs set status = 'stopped', updated_at = now() where id = r.id;
    end;
  end loop;
  return n;
end;
$fn$;

create or replace function public.comercial_automations_idle()
returns int
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  a record;
  l record;
  v_days int;
  v_run uuid;
  n int := 0;
begin
  for a in select * from public.comercial_automations where active and trigger ->> 'type' = 'idle' loop
    v_days := greatest(coalesce((a.trigger ->> 'days')::int, 7), 1);
    for l in
      select ld.id, ld.agency_id from public.comercial_leads ld join public.comercial_stages s on s.id = ld.stage_id
      where ld.agency_id = a.agency_id and s.type = 'open' and ld.stage_changed_at <= now() - make_interval(days => v_days)
        and not exists (select 1 from public.comercial_automation_runs r where r.automation_id = a.id and r.lead_id = ld.id and r.created_at > now() - make_interval(days => v_days))
      limit 200
    loop
      insert into public.comercial_automation_runs (agency_id, automation_id, lead_id) values (l.agency_id, a.id, l.id) returning id into v_run;
      update public.comercial_automations set runs = runs + 1, last_run_at = now() where id = a.id;
      insert into public.comercial_lead_notes (agency_id, lead_id, kind, text) values (l.agency_id, l.id, 'Automação', '"' || a.name || '" iniciada');
      begin
        perform public.comercial_run_advance(v_run);
      exception when others then
        update public.comercial_automation_runs set status = 'stopped', updated_at = now() where id = v_run;
      end;
      n := n + 1;
    end loop;
  end loop;
  return n;
end;
$fn$;

select cron.schedule('comercial-automations-tick', '* * * * *', $cron$select public.comercial_automations_tick();$cron$);
select cron.schedule('comercial-automations-idle', '0 12 * * *', $cron$select public.comercial_automations_idle();$cron$);

-- ───────────── ganhar também dispara as automações "negócio ganho" ─────────────
create or replace function public.comercial_win_lead(
  p_lead uuid, p_stage uuid, p_value numeric, p_setup numeric, p_months int, p_start date,
  p_videos int, p_artes int, p_approver text, p_services text[], p_squad jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $fn$
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
    begin
      perform public.comercial_fire('won', p_lead);
    exception when others then null;
    end;
  else
    select id into v_client from public.comercial_clients where lead_id = p_lead;
  end if;
  return v_client;
end;
$fn$;

-- ───────────── formulário público ─────────────

create or replace function public.comercial_submit_form(p_slug text, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  f public.comercial_forms%rowtype;
  fld jsonb;
  v_label text;
  v_val text;
  v_ans jsonb := '{}'::jsonb;
  v_map jsonb := '{}'::jsonb;
  l public.comercial_leads%rowtype;
  v_digits text;
  v_key text;
  v_stage uuid;
  v_owner uuid;
  v_svc text[];
  v_tag text;
  v_summary text;
  v_stage_type text;
begin
  select * into f from public.comercial_forms where slug = p_slug and active;
  if f.id is null then raise exception 'form_not_found'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or length(p_answers::text) > 30000 then raise exception 'invalid_payload'; end if;

  for fld in select * from jsonb_array_elements(f.fields) loop
    v_label := fld ->> 'label';
    v_val := left(btrim(coalesce(p_answers ->> v_label, '')), 3000);
    if coalesce((fld ->> 'required')::boolean, false) and v_val = '' and fld ->> 'type' <> 'file' then
      raise exception 'required:%', v_label;
    end if;
    if v_val <> '' then
      v_ans := v_ans || jsonb_build_object(v_label, v_val);
      if coalesce(fld ->> 'map', '') <> '' then v_map := v_map || jsonb_build_object(fld ->> 'map', v_val); end if;
    end if;
  end loop;

  v_digits := regexp_replace(coalesce(v_map ->> 'phone', ''), '\D', '', 'g');
  v_key := case when v_digits <> '' then public.whatsapp_phone_key(v_digits) end;

  if (select count(*) from public.comercial_form_responses where form_id = f.id and submitted_at > now() - interval '1 minute') >= 30 then raise exception 'too_many'; end if;
  if v_key is not null and (
       select count(*) from public.comercial_form_responses r join public.comercial_leads x on x.id = r.lead_id
       where r.form_id = f.id and x.phone_key = v_key and r.submitted_at > now() - interval '1 hour') >= 5 then
    raise exception 'too_many';
  end if;

  if coalesce((f.dest ->> 'create')::boolean, false) and (v_map ? 'name' or v_map ? 'phone' or v_map ? 'email') then
    select * into l from public.comercial_leads
    where agency_id = f.agency_id
      and ((v_key is not null and phone_key = v_key) or (coalesce(v_map ->> 'email', '') <> '' and lower(email) = lower(v_map ->> 'email')))
    limit 1;

    if l.id is null then
      begin
        v_stage := nullif(f.dest ->> 'stage_id', '')::uuid;
      exception when others then v_stage := null;
      end;
      select s.id, s.type into v_stage, v_stage_type from public.comercial_stages s where s.id = v_stage and s.agency_id = f.agency_id;
      if v_stage is null or v_stage_type <> 'open' then
        select id into v_stage from public.comercial_stages where agency_id = f.agency_id and type = 'open' order by position offset 1 limit 1;
        if v_stage is null then select id into v_stage from public.comercial_stages where agency_id = f.agency_id and type = 'open' order by position limit 1; end if;
      end if;
      begin
        v_owner := nullif(f.dest ->> 'owner_id', '')::uuid;
      exception when others then v_owner := null;
      end;
      v_svc := array(select s from unnest(array['Posicionamento', 'Conteúdo', 'Tráfego pago']) s where coalesce(v_map ->> 'services', '') ilike '%' || s || '%');
      v_tag := btrim(coalesce(f.dest ->> 'tag', ''));
      perform set_config('comercial.silent_fire', 'on', true);
      insert into public.comercial_leads (agency_id, name, company, phone, email, instagram, segment, city, source, services, tags, owner_id, stage_id, created_by)
      values (f.agency_id, coalesce(nullif(v_map ->> 'name', ''), 'Sem nome'), nullif(v_map ->> 'company', ''), nullif(v_map ->> 'phone', ''), nullif(v_map ->> 'email', ''),
              nullif(v_map ->> 'ig', ''), nullif(v_map ->> 'segment', ''), nullif(v_map ->> 'city', ''), 'Formulário', v_svc,
              case when v_tag <> '' then array[v_tag] else '{}'::text[] end, v_owner, v_stage, null)
      returning * into l;
      perform set_config('comercial.silent_fire', 'off', true);
      insert into public.comercial_lead_notes (agency_id, lead_id, kind, text, created_by) values (f.agency_id, l.id, 'Sistema', 'Lead criado pelo formulário ' || f.name, null);
    end if;

    select string_agg(k || ': ' || v, ' · ') into v_summary from jsonb_each_text(v_ans) as e(k, v);
    insert into public.comercial_lead_notes (agency_id, lead_id, kind, text, created_by) values (f.agency_id, l.id, 'Formulário', f.name || ': ' || coalesce(v_summary, ''), null);
  end if;

  insert into public.comercial_form_responses (agency_id, form_id, lead_id, answers) values (f.agency_id, f.id, l.id, v_ans);

  if l.id is not null then
    select type into v_stage_type from public.comercial_stages where id = l.stage_id;
    if v_stage_type = 'open' and not exists (select 1 from public.comercial_activities where lead_id = l.id and not done) then
      insert into public.comercial_activities (agency_id, lead_id, owner_id, type, title, due_date, created_by)
      values (f.agency_id, l.id, l.owner_id, 'Follow-up', 'Analisar respostas e fazer contato', (now() at time zone 'America/Sao_Paulo')::date, null);
    end if;
    begin
      perform public.comercial_fire('form', l.id, jsonb_build_object('formId', f.id::text));
    exception when others then null;
    end;
  end if;

  return jsonb_build_object('ok', true, 'thanks', f.thanks);
end;
$fn$;

-- só o motor e o formulário público chamam essas funções
do $$
declare fn text;
begin
  foreach fn in array array[
    'comercial_flatten(jsonb,int)', 'comercial_fill(text,public.comercial_leads)', 'comercial_send_wa(public.comercial_leads,text,text)',
    'comercial_run_advance(uuid)', 'comercial_run_resume(uuid,boolean,text)', 'comercial_fire(text,uuid,jsonb)', 'comercial_leads_fire_new()',
    'comercial_leads_fire_stage()', 'comercial_wa_inbound()', 'comercial_automations_tick()', 'comercial_automations_idle()', 'comercial_submit_form(text,jsonb)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
  end loop;
end $$;
grant execute on function public.comercial_submit_form(text, jsonb) to service_role;
