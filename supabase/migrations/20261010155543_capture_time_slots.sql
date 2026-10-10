-- The client picks the TIME of the recording, not just morning/afternoon.
-- Rules: the agency sets the working hours, how long a recording lasts and the step between start times; two recordings
-- never overlap on the same day, and a day never holds more recordings than its capacity.

alter table public.capture_settings
  add column day_start_hour smallint not null default 8 check (day_start_hour between 0 and 23),
  add column day_end_hour smallint not null default 18 check (day_end_hour between 1 and 24),
  add column duration_minutes smallint not null default 120 check (duration_minutes between 30 and 480),
  add column slot_step_minutes smallint not null default 60 check (slot_step_minutes in (15, 30, 60, 120)),
  add constraint capture_settings_hours_order check (day_end_hour > day_start_hour);

alter table public.capture_bookings
  add column start_time time not null default '09:00',
  add column duration_minutes smallint not null default 120 check (duration_minutes between 30 and 480);

-- Bookings made before this change only knew morning / afternoon
update public.capture_bookings set start_time = case period when 'tarde' then time '14:00' else time '09:00' end;

create or replace function public.capture_booking_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity int;
  v_taken int;
begin
  if new.status not in ('pending', 'confirmed') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status in ('pending', 'confirmed') and old.booking_date = new.booking_date
     and old.start_time = new.start_time and old.duration_minutes = new.duration_minutes then
    return new; -- nothing that affects the day's load changed
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.agency_id::text || new.booking_date::text, 0));

  if exists (select 1 from public.capture_blocks b where b.agency_id = new.agency_id and b.block_date = new.booking_date) then
    raise exception 'day_blocked' using errcode = 'P0001';
  end if;

  select coalesce(s.capacity_per_day, 2) into v_capacity from public.capture_settings s where s.agency_id = new.agency_id;
  v_capacity := coalesce(v_capacity, 2);

  select count(*) into v_taken
  from public.capture_bookings b
  where b.agency_id = new.agency_id
    and b.booking_date = new.booking_date
    and b.status in ('pending', 'confirmed')
    and b.id <> new.id;

  if v_taken >= v_capacity then
    raise exception 'day_full' using errcode = 'P0001';
  end if;

  -- no two recordings at the same time
  if exists (
    select 1 from public.capture_bookings b
    where b.agency_id = new.agency_id
      and b.booking_date = new.booking_date
      and b.status in ('pending', 'confirmed')
      and b.id <> new.id
      and b.start_time < (new.start_time + make_interval(mins => new.duration_minutes))
      and (b.start_time + make_interval(mins => b.duration_minutes)) > new.start_time
  ) then
    raise exception 'slot_taken' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists capture_booking_guard_trg on public.capture_bookings;
create trigger capture_booking_guard_trg
before insert or update of status, booking_date, start_time, duration_minutes on public.capture_bookings
for each row execute function public.capture_booking_guard();

revoke execute on function public.capture_booking_guard() from public, anon, authenticated;

-- Notification: say the time, not the period
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
    ('capture_request', 'Novo pedido de gravação 🎬', '{empresa} — {data} às {hora}'),
    ('mention', 'Te chamaram numa conversa 👋', '{texto}'),
    ('task_assigned', 'Tarefa nova caiu pra você 🎯', '{tarefa}')
  ) as v(k, t, b)
  where v.k = p_key;
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
    jsonb_build_object(
      'empresa', new.company_name,
      'data', to_char(new.booking_date, 'DD/MM'),
      'hora', to_char(new.start_time, 'HH24:MI'),
      'periodo', case when new.period = 'manha' then 'manhã' else 'tarde' end
    )
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
    when 'client_reply' then '{"acao": "pediu alteração ✏️", "texto": "Quero só mudar a última foto", "cliente": "Doce Rio"}'::jsonb
    when 'capture_request' then '{"empresa": "Doce Rio", "data": "22/10", "hora": "14:00", "periodo": "tarde"}'::jsonb
    when 'mention' then '{"texto": "Dá uma olhada nesse post?", "autor": "Ana Beatriz"}'::jsonb
    when 'task_assigned' then '{"tarefa": "[Doce Rio] - Design - Outubro", "cliente": "Doce Rio"}'::jsonb
    else '{}'::jsonb
  end;
  select * into txt from public.notification_text(public.current_agency_id(), p_key, v_sample);
  perform public.internal_push(auth.uid(), txt.title, txt.body);
end;
$$;

revoke execute on function public.capture_bookings_push_on_request() from public, anon, authenticated;
revoke execute on function public.send_test_push(text) from public, anon;
grant execute on function public.send_test_push(text) to authenticated;
