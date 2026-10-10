-- Editable messages per notification type (admins) and each person's own on/off per type.

alter table public.notification_settings
  add column title text check (title is null or char_length(title) <= 60),
  add column body text check (body is null or char_length(body) <= 120);

create table public.user_notification_prefs (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null check (key in ('unscheduled_posts', 'task_assigned', 'mention', 'client_reply', 'capture_request')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.user_notification_prefs enable row level security;
create policy user_notification_prefs_own on public.user_notification_prefs for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- The default message of each type ({variables} are filled in when it is sent). Mirrored in NOTIFICATION_TYPES (front end).
create or replace function public.notification_default(p_key text)
returns table (title text, body text)
language sql
immutable
set search_path = ''
as $$
  select v.t, v.b
  from (values
    ('unscheduled_posts', 'Posts sem agendar ⏰', '{resumo}'),
    ('client_reply', 'Cliente {acao}', '{texto}'),
    ('capture_request', 'Novo pedido de gravação 🎬', '{empresa} — {data} ({periodo})'),
    ('mention', 'Te chamaram numa conversa 👋', '{texto}'),
    ('task_assigned', 'Tarefa nova caiu pra você 🎯', '{tarefa}')
  ) as v(k, t, b)
  where v.k = p_key;
$$;

-- The message to send: the agency's own text when it has one, the default otherwise, with {variables} replaced
create or replace function public.notification_text(p_agency uuid, p_key text, p_vars jsonb)
returns table (title text, body text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d record;
  s record;
  kv record;
  t text;
  b text;
begin
  select * into d from public.notification_default(p_key);
  select st.title as ct, st.body as cb into s from public.notification_settings st where st.agency_id = p_agency and st.key = p_key;
  t := coalesce(nullif(btrim(s.ct), ''), d.title);
  b := coalesce(nullif(btrim(s.cb), ''), d.body);
  for kv in select e.key as k, e.value as v from jsonb_each_text(coalesce(p_vars, '{}'::jsonb)) e loop
    t := replace(t, '{' || kv.k || '}', left(coalesce(kv.v, ''), 40));
    b := replace(b, '{' || kv.k || '}', left(coalesce(kv.v, ''), 40));
  end loop;
  return query select t, b;
end;
$$;

drop function if exists public.internal_push(uuid, text, text, uuid);
create or replace function public.internal_push(p_user uuid, p_title text, p_body text, p_task uuid default null, p_key text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_body text := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
begin
  if p_user is null then return; end if;
  -- the person turned this type off for themselves
  if p_key is not null and exists (select 1 from public.user_notification_prefs u where u.user_id = p_user and u.key = p_key and not u.enabled) then
    return;
  end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_cron_secret';
  if v_secret is null then return; end if;
  if char_length(v_body) > 120 then v_body := rtrim(left(v_body, 119)) || '…'; end if;
  begin
    perform net.http_post(
      url := 'https://bzzubzjbsjwuvchuhklr.supabase.co/functions/v1/push-send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6enViempic2p3dXZjaHVoa2xyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5ODE5NDcsImV4cCI6MjEwMDU1Nzk0N30.KlznJ82oOa7DSXDNDZBdzoPhwYTSdP6X6cOzLWM2Q24',
        'X-Cron-Secret', v_secret
      ),
      body := jsonb_build_object('action', 'dispatch', 'user_id', p_user, 'title', p_title, 'body', v_body, 'task_id', p_task)
    );
  exception when others then null;
  end;
end;
$$;

create or replace function public.unscheduled_post_digest(p_check_schedule boolean default false)
returns table (user_id uuid, title text, body text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r record;
  txt record;
begin
  for r in
    select x.user_id as uid, (array_agg(x.agency_id))[1] as agency, sum(x.total)::int as total, sum(x.overdue)::int as overdue
    from public.unscheduled_post_recipients() x
    where not p_check_schedule
       or (
         extract(hour from (now() at time zone 'America/Sao_Paulo'))::int in (9, 16)
         and extract(dow from (now() at time zone 'America/Sao_Paulo'))::int between 1 and 6
       )
    group by x.user_id
  loop
    select * into txt from public.notification_text(
      r.agency, 'unscheduled_posts',
      jsonb_build_object(
        'total', r.total,
        'atrasados', r.overdue,
        'resumo', r.total || ' sem agendar' || (case when r.overdue > 0 then ' · ' || r.overdue || (case when r.overdue > 1 then ' atrasados' else ' atrasado' end) else '' end)
      )
    );
    user_id := r.uid;
    title := txt.title;
    body := txt.body;
    return next;
  end loop;
end;
$$;

create or replace function public.notify_unscheduled_posts()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_sent int := 0;
begin
  for r in select * from public.unscheduled_post_digest(true) loop
    perform public.internal_push(r.user_id, r.title, r.body, null, 'unscheduled_posts');
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end;
$$;

create or replace function public.my_unscheduled_post_alerts()
returns table (client_id uuid, client_name text, total int, overdue int, due_today int, awaiting_approval int, first_date date)
language sql
stable
security definer
set search_path = ''
as $$
  select r.client_id, r.client_name, r.total, r.overdue, r.due_today, r.awaiting_approval, r.first_date
  from public.unscheduled_post_recipients() r
  where r.user_id = auth.uid()
    and not exists (select 1 from public.user_notification_prefs u where u.user_id = auth.uid() and u.key = 'unscheduled_posts' and not u.enabled)
  order by r.overdue desc, r.first_date, r.client_name;
$$;

create or replace function public.pm_tasks_push_on_assign()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  txt record;
begin
  if new.parent_task_id is not null then return new; end if;
  if new.is_draft is true then return new; end if;
  if new.assignee_id is null then return new; end if;
  if new.deleted_at is not null then return new; end if;
  if tg_op = 'UPDATE' and old.assignee_id is not distinct from new.assignee_id then return new; end if;
  if not public.notification_enabled(new.agency_id, 'task_assigned') then return new; end if;
  select * into txt from public.notification_text(new.agency_id, 'task_assigned', jsonb_build_object('tarefa', coalesce(new.title, '')));
  perform public.internal_push(new.assignee_id, txt.title, txt.body, new.id, 'task_assigned');
  return new;
end;
$$;

create or replace function public.pm_comments_push_on_mention()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mentioned_id uuid;
  m record;
  txt record;
begin
  if not public.notification_enabled(new.agency_id, 'mention') then return new; end if;
  select * into txt from public.notification_text(new.agency_id, 'mention', jsonb_build_object('texto', btrim(regexp_replace(new.content, '@[a-f0-9-]{36}', '', 'g'))));
  for m in select (regexp_matches(new.content, '@([a-f0-9-]{36})', 'g'))[1] as uid loop
    begin
      mentioned_id := m.uid::uuid;
    exception when others then continue;
    end;
    if mentioned_id = new.author_id then continue; end if;
    perform public.internal_push(mentioned_id, txt.title, txt.body, new.task_id, 'mention');
  end loop;
  return new;
end;
$$;

create or replace function public.calendar_publications_push_on_client_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignee uuid;
  v_title text;
  txt record;
begin
  if new.client_responded_at is not distinct from old.client_responded_at then return new; end if;
  if new.status not in ('aprovada', 'alteracao_solicitada') then return new; end if;
  if not public.notification_enabled(new.agency_id, 'client_reply') then return new; end if;
  select t.assignee_id, t.title into v_assignee, v_title from public.pm_tasks t where t.id = new.task_id;
  if v_assignee is null then return new; end if;
  select * into txt from public.notification_text(
    new.agency_id, 'client_reply',
    jsonb_build_object(
      'acao', case when new.status = 'aprovada' then 'aprovou ✅' else 'pediu alteração ✏️' end,
      'texto', case when new.status = 'aprovada' then coalesce(v_title, 'Publicação') else coalesce(new.client_feedback, coalesce(v_title, 'Publicação')) end
    )
  );
  perform public.internal_push(v_assignee, txt.title, txt.body, new.task_id, 'client_reply');
  return new;
end;
$$;

create or replace function public.capture_bookings_push_on_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  txt record;
begin
  if not public.notification_enabled(new.agency_id, 'capture_request') then return new; end if;
  select * into txt from public.notification_text(
    new.agency_id, 'capture_request',
    jsonb_build_object('empresa', new.company_name, 'data', to_char(new.booking_date, 'DD/MM'), 'periodo', case when new.period = 'manha' then 'manhã' else 'tarde' end)
  );
  for r in
    select tm.user_id from public.team_members tm
    join public.user_roles ur on ur.user_id = tm.user_id and ur.role = 'admin'
    where tm.agency_id = new.agency_id and tm.is_active
  loop
    perform public.internal_push(r.user_id, txt.title, txt.body, null, 'capture_request');
  end loop;
  return new;
end;
$$;

-- "Enviar teste": with a key, sends that type's message (agency text or default) with sample data, to the caller only
drop function if exists public.send_test_push();
create or replace function public.send_test_push(p_key text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  txt record;
  v_sample jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_key is null then
    perform public.internal_push(auth.uid(), 'Teste de notificação 🔔', 'Os avisos estão chegando aqui.');
    return;
  end if;
  v_sample := case p_key
    when 'unscheduled_posts' then '{"total": 20, "atrasados": 6, "resumo": "20 sem agendar · 6 atrasados"}'::jsonb
    when 'client_reply' then '{"acao": "pediu alteração ✏️", "texto": "Quero só mudar a última foto"}'::jsonb
    when 'capture_request' then '{"empresa": "Doce Rio", "data": "22/10", "periodo": "tarde"}'::jsonb
    when 'mention' then '{"texto": "Dá uma olhada nesse post?"}'::jsonb
    when 'task_assigned' then '{"tarefa": "[Doce Rio] - Design - Outubro"}'::jsonb
    else '{}'::jsonb
  end;
  select * into txt from public.notification_text(public.current_agency_id(), p_key, v_sample);
  perform public.internal_push(auth.uid(), txt.title, txt.body);
end;
$$;

revoke execute on function public.notification_default(text) from public, anon, authenticated;
revoke execute on function public.notification_text(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.internal_push(uuid, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.unscheduled_post_digest(boolean) from public, anon, authenticated;
revoke execute on function public.notify_unscheduled_posts() from public, anon, authenticated;
revoke execute on function public.my_unscheduled_post_alerts() from public, anon;
grant execute on function public.my_unscheduled_post_alerts() to authenticated;
revoke execute on function public.pm_tasks_push_on_assign() from public, anon, authenticated;
revoke execute on function public.pm_comments_push_on_mention() from public, anon, authenticated;
revoke execute on function public.calendar_publications_push_on_client_reply() from public, anon, authenticated;
revoke execute on function public.capture_bookings_push_on_request() from public, anon, authenticated;
revoke execute on function public.send_test_push(text) from public, anon;
grant execute on function public.send_test_push(text) to authenticated;
