-- Motor das automações do Comercial: o que o fluxo "Qualificação UAU" precisa.
--  · condição "horário comercial" (seg a sex, 8h às 18h, America/Sao_Paulo)
--  · pergunta com tempo de espera configurável, opções numeradas, resposta validada (fora das opções: repete uma vez e, se errar de novo, passa para uma pessoa)
--  · lembrete e desistência por falta de resposta (avisa depois de X min; depois de Y min marca e cria follow-up)
--  · respostas guardadas na automação e usadas como {segmento}, {momento}, {objetivo}, {origem}, {resposta} em mensagens, etiquetas e notas
--  · blocos novos: "Nota interna" e "Encerrar"; "Transferir para humano" passa a trocar o responsável quando uma pessoa é escolhida
--  · lead que chega por anúncio entra com origem "Meta Ads"; a primeira mensagem do contato vira nota do lead

create or replace function pg_temp.patch_fn(p_sig text, p_old text, p_new text)
returns void
language plpgsql
as $fn$
declare d text;
begin
  d := pg_get_functiondef(p_sig::regprocedure);
  if position(p_old in d) = 0 then raise exception 'patch em %: trecho não encontrado: %', p_sig, p_old; end if;
  execute replace(d, p_old, p_new);
end;
$fn$;

-- ───────────── apoio ─────────────

create or replace function public.comercial_is_business_hours(p_at timestamptz default now())
returns boolean
language sql
stable
set search_path = ''
as $fn$
  select extract(isodow from (p_at at time zone 'America/Sao_Paulo')) between 1 and 5
     and extract(hour from (p_at at time zone 'America/Sao_Paulo')) >= 8
     and extract(hour from (p_at at time zone 'America/Sao_Paulo')) < 18;
$fn$;

-- como o comercial_fill, e também as respostas guardadas: {segmento} {momento} {objetivo} {origem} {resposta} (e qualquer chave de "Salvar resposta em")
create or replace function public.comercial_fill2(p_text text, p_lead public.comercial_leads, p_vars jsonb)
returns text
language plpgsql
stable
set search_path = ''
as $fn$
declare
  v text := coalesce(p_text, '');
  k text;
  x text;
  v_src text := case when coalesce(p_lead.source, '') ilike '%meta%' then 'Meta Ads'
                     when coalesce(p_lead.source, '') in ('', 'WhatsApp') then 'WhatsApp orgânico'
                     else p_lead.source end;
begin
  for k, x in select key, value from jsonb_each_text(coalesce(p_vars -> 'answers', '{}'::jsonb)) loop
    v := replace(v, '{' || k || '}', coalesce(nullif(btrim(x), ''), '—'));
  end loop;
  v := replace(v, '{resposta}', coalesce(nullif(btrim(p_vars ->> 'answer'), ''), '—'));
  v := replace(v, '{origem}', v_src);
  v := regexp_replace(v, '\{(segmento|momento|objetivo)\}', '—', 'g');
  return public.comercial_fill(v, p_lead);
end;
$fn$;

-- qual das opções a pessoa escolheu: o número ("2"), o texto da opção ou um pedaço dele; null se não bateu (ou se bateu em mais de uma)
create or replace function public.comercial_match_option(p_answer text, p_options jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $fn$
declare
  a text := lower(btrim(regexp_replace(coalesce(p_answer, ''), '[[:punct:][:space:]]+$', '')));
  a2 text;
  o text;
  ox text;
  v_idx int;
  hits text[] := '{}';
begin
  if a = '' or p_options is null or jsonb_array_length(p_options) = 0 then return null; end if;
  if a ~ '^[0-9]{1,2}$' then
    v_idx := a::int;
    if v_idx between 1 and jsonb_array_length(p_options) then return p_options ->> (v_idx - 1); end if;
    return null;
  end if;
  a2 := translate(a, 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  for o in select jsonb_array_elements_text(p_options) loop
    ox := translate(lower(btrim(o)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
    if ox = a2 or (length(a2) >= 3 and position(a2 in ox) > 0) or (length(ox) >= 4 and position(ox in a2) > 0) then
      hits := hits || o;
    end if;
  end loop;
  if cardinality(hits) = 1 then return hits[1]; end if;
  return null;
end;
$fn$;

-- ───────────── interpretador ─────────────

select pg_temp.patch_fn('public.comercial_run_advance(uuid)',
$old$  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin$old$,
$new$  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_timeout timestamptz;
  v_remind timestamptz;
  v_giveup timestamptz;
begin$new$);

-- variáveis das respostas em todas as mensagens e perguntas
select pg_temp.patch_fn('public.comercial_run_advance(uuid)',
$old$public.comercial_fill(v_ins ->> 'text', l)$old$,
$new$public.comercial_fill2(v_ins ->> 'text', l, v_vars)$new$);

-- opções numeradas ("1. …") quando o bloco pede
select pg_temp.patch_fn('public.comercial_run_advance(uuid)',
$old$select string_agg('• ' || x, E'\n') into v_opts from jsonb_array_elements_text(coalesce(v_ins -> 'options', '[]'::jsonb)) x;$old$,
$new$select string_agg(case when coalesce((v_ins ->> 'numbered')::boolean, false) then q.ord::text || '. ' || q.x else '• ' || q.x end, E'\n' order by q.ord)
      into v_opts from jsonb_array_elements_text(coalesce(v_ins -> 'options', '[]'::jsonb)) with ordinality as q(x, ord);$new$);

-- espera da pergunta: tempo configurável, lembrete e desistência
select pg_temp.patch_fn('public.comercial_run_advance(uuid)',
$old$      v_vars := v_vars || jsonb_build_object('pending', jsonb_build_object('type', t, 'save_to', coalesce(v_ins ->> 'saveTo', '')));
      update public.comercial_automation_runs
      set status = 'waiting', wait_kind = 'answer', resume_at = now() + interval '3 days', pc = r.pc, vars = v_vars, updated_at = now()
      where id = p_run;$old$,
$new$      v_timeout := now() + make_interval(mins => greatest(coalesce((v_ins ->> 'timeoutMinutes')::int, 4320), 1));
      v_remind := case when coalesce((v_ins ->> 'remindAfterMin')::int, 0) > 0 then now() + make_interval(mins => (v_ins ->> 'remindAfterMin')::int) end;
      v_giveup := case when coalesce((v_ins ->> 'giveUpAfterMin')::int, 0) > 0 then now() + make_interval(mins => (v_ins ->> 'giveUpAfterMin')::int) end;
      v_vars := v_vars || jsonb_build_object('pending', jsonb_strip_nulls(jsonb_build_object(
        'type', t, 'save_to', coalesce(v_ins ->> 'saveTo', ''),
        'strict', coalesce((v_ins ->> 'strict')::boolean, false), 'strikes', 0,
        'options', coalesce(v_ins -> 'options', '[]'::jsonb), 'numbered', coalesce((v_ins ->> 'numbered')::boolean, false), 'question', v_text,
        'timeout_at', v_timeout, 'remind_text', v_ins ->> 'remindText', 'remind_at', v_remind, 'give_up_at', v_giveup, 'give_up_tag', v_ins ->> 'giveUpTag')));
      update public.comercial_automation_runs
      set status = 'waiting', wait_kind = 'answer', resume_at = least(v_timeout, coalesce(v_remind, v_timeout), coalesce(v_giveup, v_timeout)), pc = r.pc, vars = v_vars, updated_at = now()
      where id = p_run;$new$);

-- etiqueta com variáveis ({resposta}, {segmento}…)
select pg_temp.patch_fn('public.comercial_run_advance(uuid)',
$old$btrim(v_ins ->> 'tag')$old$,
$new$btrim(public.comercial_fill2(v_ins ->> 'tag', l, v_vars))$new$);

-- condição "horário comercial"
select pg_temp.patch_fn('public.comercial_run_advance(uuid)',
$old$when 'source' then coalesce(l.source, '')$old$,
$new$when 'source' then coalesce(l.source, '')
          when 'business_hours' then case when public.comercial_is_business_hours() then 'sim' else 'nao' end$new$);

-- transferir para humano: se uma pessoa foi escolhida, ela vira a responsável
select pg_temp.patch_fn('public.comercial_run_advance(uuid)',
$old$    elsif t = 'human' then$old$,
$new$    elsif t = 'end' then
      update public.comercial_automation_runs set status = 'done', pc = r.pc, vars = v_vars, updated_at = now() where id = p_run;
      return;

    elsif t = 'note' then
      insert into public.comercial_lead_notes (agency_id, lead_id, kind, text)
      values (l.agency_id, l.id, 'Resumo da automação', left(public.comercial_fill2(v_ins ->> 'text', l, v_vars), 1000));

    elsif t = 'human' then
      begin
        v_target := case when coalesce(v_ins ->> 'owner', '') in ('', 'lead') then null else (v_ins ->> 'owner')::uuid end;
      exception when others then v_target := null;
      end;
      if v_target is not null and l.owner_id is distinct from v_target then
        perform set_config('comercial.silent_fire', 'on', true);
        update public.comercial_leads set owner_id = v_target where id = l.id;
        perform set_config('comercial.silent_fire', 'off', true);
        select * into l from public.comercial_leads where id = l.id;
      end if;$new$);

-- ───────────── retomada com a resposta ─────────────

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
  v_answer text := p_answer;
  v_opts jsonb;
  v_match text;
  v_list text;
  v_strikes int;
begin
  select * into r from public.comercial_automation_runs where id = p_run for update;
  if r.id is null or r.status <> 'waiting' then return; end if;
  v := r.vars;
  if p_replied is not null then v := v || jsonb_build_object('replied', p_replied); end if;
  if p_answer is not null then
    v_type := v #>> '{pending,type}';
    v_save := coalesce(v #>> '{pending,save_to}', '');
    v_opts := coalesce(v #> '{pending,options}', '[]'::jsonb);
    select * into l from public.comercial_leads where id = r.lead_id;

    -- pergunta com opções: a resposta precisa ser uma delas
    if l.id is not null and v_type = 'ask' and coalesce((v #>> '{pending,strict}')::boolean, false) and jsonb_array_length(v_opts) > 0 then
      v_match := public.comercial_match_option(p_answer, v_opts);
      if v_match is null then
        v_strikes := coalesce((v #>> '{pending,strikes}')::int, 0);
        insert into public.comercial_lead_notes (agency_id, lead_id, kind, text)
        values (l.agency_id, l.id, 'Automação', 'Resposta fora das opções: "' || left(p_answer, 200) || '"');
        if v_strikes = 0 then
          select string_agg(case when coalesce((v #>> '{pending,numbered}')::boolean, false) then q.ord::text || '. ' || q.x else '• ' || q.x end, E'\n' order by q.ord)
          into v_list from jsonb_array_elements_text(v_opts) with ordinality as q(x, ord);
          perform public.comercial_send_wa(l, 'Não consegui entender essa resposta 😅 Escolha uma das opções:' || E'\n' || coalesce(v #>> '{pending,question}', '') || E'\n' || coalesce(v_list, ''), 'crm_auto:' || p_run::text);
          v := jsonb_set(v, '{pending,strikes}', '1'::jsonb);
          update public.comercial_automation_runs set vars = v, updated_at = now() where id = p_run;
        else
          insert into public.comercial_lead_notes (agency_id, lead_id, kind, text)
          values (l.agency_id, l.id, 'Automação', 'Respondeu fora das opções de novo. Atendimento passado para uma pessoa. Automação pausada para esse lead.');
          update public.comercial_automation_runs set status = 'stopped', vars = v, updated_at = now() where id = p_run;
        end if;
        return;
      end if;
      v_answer := v_match;
    end if;

    v := v || jsonb_build_object('answer', left(v_answer, 500));
    if l.id is not null and v_type is not null then
      if v_type = 'meet' then
        insert into public.comercial_activities (agency_id, lead_id, owner_id, type, title, due_date)
        values (l.agency_id, l.id, l.owner_id, 'Reunião', 'Reunião: ' || left(v_answer, 120), (now() at time zone 'America/Sao_Paulo')::date + 1);
        insert into public.comercial_lead_notes (agency_id, lead_id, kind, text) values (l.agency_id, l.id, 'Automação', 'Reunião registrada: ' || left(v_answer, 160));
      else
        if v_save = 'segment' then
          update public.comercial_leads set segment = left(v_answer, 80) where id = l.id;
        elsif v_save = 'services' then
          v_svc := array(select s from unnest(array['Posicionamento', 'Conteúdo', 'Tráfego pago']) s
                         where v_answer ilike '%' || s || '%' or (s = 'Conteúdo' and v_answer ilike '%redes%') or (s = 'Tráfego pago' and v_answer ilike '%tráfego%'));
          if coalesce(array_length(v_svc, 1), 0) > 0 then
            update public.comercial_leads set services = array(select distinct x from unnest(services || v_svc) x) where id = l.id;
          end if;
        end if;
        -- a resposta fica guardada na automação para as variáveis ({segmento}, {momento}, {objetivo}…)
        if v_save <> '' then
          v := jsonb_set(v, '{answers}', coalesce(v -> 'answers', '{}'::jsonb) || jsonb_build_object(case when v_save = 'segment' then 'segmento' else v_save end, left(v_answer, 300)));
        end if;
        insert into public.comercial_lead_notes (agency_id, lead_id, kind, text)
        values (l.agency_id, l.id, 'Automação', 'Resposta do lead: ' || left(v_answer, 200) || case when v_save <> '' then ' (guardada em ' || v_save || ')' else '' end);
      end if;
    end if;
  end if;
  v := v - 'pending';
  update public.comercial_automation_runs set vars = v, updated_at = now() where id = p_run;
  perform public.comercial_run_advance(p_run);
end;
$fn$;

-- ───────────── tempo esgotado (lembrete, desistência ou segue sem resposta) ─────────────

create or replace function public.comercial_run_timeout(p_run uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  r public.comercial_automation_runs%rowtype;
  l public.comercial_leads%rowtype;
  v jsonb;
  pend jsonb;
  v_remind timestamptz;
  v_giveup timestamptz;
  v_timeout timestamptz;
  v_tag text;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select * into r from public.comercial_automation_runs where id = p_run for update;
  if r.id is null or r.status <> 'waiting' then return; end if;
  v := r.vars;
  pend := v -> 'pending';
  if r.wait_kind = 'answer' and pend is not null then
    v_remind := (pend ->> 'remind_at')::timestamptz;
    v_giveup := (pend ->> 'give_up_at')::timestamptz;
    v_timeout := coalesce((pend ->> 'timeout_at')::timestamptz, now() + interval '3 days');
    select * into l from public.comercial_leads where id = r.lead_id;

    if l.id is not null and v_remind is not null and not coalesce((pend ->> 'reminded')::boolean, false) and now() >= v_remind
       and coalesce(btrim(pend ->> 'remind_text'), '') <> '' then
      if public.comercial_send_wa(l, public.comercial_fill2(pend ->> 'remind_text', l, v), 'crm_auto:' || p_run::text) then
        insert into public.comercial_lead_notes (agency_id, lead_id, kind, text) values (l.agency_id, l.id, 'Automação', 'Lembrete enviado: o lead não respondeu à pergunta');
      end if;
      v := jsonb_set(v, '{pending,reminded}', 'true'::jsonb);
      update public.comercial_automation_runs
      set vars = v, resume_at = least(v_timeout, coalesce(v_giveup, v_timeout)), updated_at = now()
      where id = p_run;
      return;
    end if;

    if l.id is not null and v_giveup is not null and now() >= v_giveup then
      v_tag := btrim(coalesce(pend ->> 'give_up_tag', ''));
      if v_tag <> '' and not (v_tag = any (l.tags)) then
        update public.comercial_leads set tags = tags || v_tag where id = l.id;
        insert into public.comercial_lead_notes (agency_id, lead_id, kind, text) values (l.agency_id, l.id, 'Automação', 'Etiqueta "' || v_tag || '" aplicada');
      end if;
      insert into public.comercial_activities (agency_id, lead_id, owner_id, type, title, due_date)
      values (l.agency_id, l.id, l.owner_id, 'Follow-up', 'Lead não concluiu o fluxo de qualificação: fazer follow-up manual', v_today);
      insert into public.comercial_lead_notes (agency_id, lead_id, kind, text)
      values (l.agency_id, l.id, 'Automação', 'O lead parou de responder. Passado para o comercial fazer follow-up. Automação pausada para esse lead.');
      update public.comercial_automation_runs set status = 'stopped', vars = v, updated_at = now() where id = p_run;
      return;
    end if;
  end if;
  perform public.comercial_run_resume(p_run, case when r.wait_kind in ('reply', 'answer') then false else null end, null);
end;
$fn$;

select pg_temp.patch_fn('public.comercial_automations_tick()',
$old$perform public.comercial_run_resume(r.id, case when r.wait_kind in ('reply', 'answer') then false else null end, null);$old$,
$new$perform public.comercial_run_timeout(r.id);$new$);

-- ───────────── entrada do WhatsApp: origem por anúncio e primeira mensagem ─────────────

select pg_temp.patch_fn('public.comercial_wa_inbound()',
$old$new.contact_phone, 'WhatsApp', v_owner$old$,
$new$new.contact_phone, case when coalesce(new.raw ->> 'has_ad', '') = 'true' then 'Meta Ads' else 'WhatsApp' end, v_owner$new$);

select pg_temp.patch_fn('public.comercial_wa_inbound()',
$old$'Responder o lead e puxar reunião', (now() at time zone 'America/Sao_Paulo')::date, null);$old$,
$new$'Responder o lead e puxar reunião', (now() at time zone 'America/Sao_Paulo')::date, null);
      insert into public.comercial_lead_notes (agency_id, lead_id, kind, text)
      values (new.agency_id, v_lead, 'Primeira mensagem',
        left(coalesce(new.body, '[sem texto]'), 500) || case when coalesce(new.raw ->> 'has_ad', '') = 'true' then E'\n(veio de um anúncio' || coalesce(' — ' || nullif(new.raw ->> 'ad_title', ''), '') || ')' else '' end);$new$);

grant execute on function public.comercial_run_timeout(uuid) to service_role;
revoke execute on function public.comercial_run_timeout(uuid) from public, anon, authenticated;
