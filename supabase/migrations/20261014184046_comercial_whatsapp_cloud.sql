-- WhatsApp Business Cloud API (Meta) como canal do novo CRM.
-- 1) conexão por agência (token e segredo ficam só no servidor: sem política de RLS, a API do app não lê a tabela);
-- 2) a mensagem recebida cria o lead direto no novo CRM (sem passar pelo CRM antigo) e libera automações que esperavam resposta;
-- 3) falha de envio de automação vira nota no lead.

create table public.whatsapp_cloud_connections (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  phone_number_id text not null unique,
  waba_id text,
  display_phone text,
  verified_name text,
  access_token text not null,
  app_secret text not null,
  verify_token text not null unique,
  last_error text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.whatsapp_cloud_connections enable row level security;
revoke all on public.whatsapp_cloud_connections from public, anon, authenticated;

-- o que a tela de conexão pode ver (nunca o token nem o segredo)
create or replace function public.whatsapp_cloud_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(
    (select jsonb_build_object(
        'connected', true, 'phone_number_id', c.phone_number_id, 'waba_id', c.waba_id, 'display_phone', c.display_phone,
        'verified_name', c.verified_name, 'verify_token', c.verify_token, 'connected_at', c.connected_at, 'last_error', c.last_error)
     from public.whatsapp_cloud_connections c
     where c.agency_id = public.current_agency_id() and public.has_role((select auth.uid()), 'admin'::public.app_role)),
    jsonb_build_object('connected', false));
$fn$;
revoke execute on function public.whatsapp_cloud_status() from public, anon;
grant execute on function public.whatsapp_cloud_status() to authenticated;

-- mensagem recebida: cria ou atualiza o lead no novo CRM e libera automações que esperavam resposta
create or replace function public.comercial_wa_inbound()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_run uuid;
  v_lead uuid;
  v_stage uuid;
  v_owner uuid;
  v_name text;
begin
  if new.contact_phone_key is null or new.agency_id is null then return new; end if;
  if position('-' in new.contact_phone_key) > 0 then return new; end if;  -- grupos e ids internos do WhatsApp
  -- número de gente da equipe não vira lead
  if exists (select 1 from public.user_whatsapp_preferences p where p.phone_e164 is not null and public.whatsapp_phone_key(p.phone_e164) = new.contact_phone_key) then
    return new;
  end if;
  begin
    select id into v_lead from public.comercial_leads where agency_id = new.agency_id and phone_key = new.contact_phone_key limit 1;
    if v_lead is null then
      perform public.comercial_seed_stages(new.agency_id);
      select id into v_stage from public.comercial_stages where agency_id = new.agency_id and type = 'open' order by position offset 1 limit 1;
      if v_stage is null then
        select id into v_stage from public.comercial_stages where agency_id = new.agency_id and type = 'open' order by position limit 1;
      end if;
      select ur.user_id into v_owner from public.user_roles ur join public.team_members tm on tm.user_id = ur.user_id
      where ur.role = 'admin'::public.app_role and tm.agency_id = new.agency_id order by ur.user_id limit 1;
      v_name := coalesce(nullif(btrim(new.raw ->> 'profile_name'), ''), 'Novo lead');
      perform set_config('comercial.wa_new', 'on', true);
      insert into public.comercial_leads (agency_id, name, phone, source, owner_id, stage_id, last_message_at, created_by)
      values (new.agency_id, v_name, new.contact_phone, 'WhatsApp', v_owner, v_stage, new.created_at, null)
      returning id into v_lead;
      perform set_config('comercial.wa_new', 'off', true);
      insert into public.comercial_activities (agency_id, lead_id, owner_id, type, title, due_date, created_by)
      values (new.agency_id, v_lead, v_owner, 'Follow-up', 'Responder o lead e puxar reunião', (now() at time zone 'America/Sao_Paulo')::date, null);
    else
      update public.comercial_leads
      set last_message_at = new.created_at,
          name = case when (name = 'Novo lead') and nullif(btrim(new.raw ->> 'profile_name'), '') is not null then btrim(new.raw ->> 'profile_name') else name end
      where id = v_lead;
      -- o lead respondeu: libera as automações que estavam esperando
      for v_run in
        select r.id from public.comercial_automation_runs r
        where r.lead_id = v_lead and r.status = 'waiting' and r.wait_kind in ('reply', 'answer')
      loop
        perform public.comercial_run_resume(v_run, true, new.body);
      end loop;
    end if;
  exception when others then
    perform set_config('comercial.wa_new', 'off', true);
  end;
  return new;
end;
$fn$;
revoke execute on function public.comercial_wa_inbound() from public, anon, authenticated;

-- lead que chegou pelo WhatsApp dispara também "mensagem de contato novo"
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
      if new.legacy_lead_id is not null or coalesce(current_setting('comercial.wa_new', true), '') = 'on' then
        perform public.comercial_fire('msg_in', new.id);
      end if;
    exception when others then null;
    end;
  end if;
  return new;
end;
$fn$;
revoke execute on function public.comercial_leads_fire_new() from public, anon, authenticated;

-- o CRM antigo deixa de criar lead a partir de mensagem: quem faz isso agora é o trigger acima
alter table public.whatsapp_messages disable trigger trg_crm_auto_create_lead;

-- o envio de uma automação falhou (fora das 24h, número sem WhatsApp, token vencido…): fica registrado no lead
create or replace function public.comercial_wa_failed(p_ref text, p_error text)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_run uuid;
  v_lead uuid;
  v_agency uuid;
begin
  if p_ref is null or p_ref not like 'crm_auto:%' then return; end if;
  begin
    v_run := substring(p_ref from 10)::uuid;
  exception when others then return;
  end;
  select lead_id, agency_id into v_lead, v_agency from public.comercial_automation_runs where id = v_run;
  if v_lead is null then return; end if;
  insert into public.comercial_lead_notes (agency_id, lead_id, kind, text)
  values (v_agency, v_lead, 'Automação', 'Mensagem não entregue: ' || left(coalesce(p_error, 'erro desconhecido'), 300));
end;
$fn$;
revoke execute on function public.comercial_wa_failed(text, text) from public, anon, authenticated;
grant execute on function public.comercial_wa_failed(text, text) to service_role;
