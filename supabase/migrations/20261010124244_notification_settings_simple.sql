-- Notifications: one on/off switch per type for the agency (every notification goes to the bell AND to the phone/computer).
-- Replaces the detailed "posts sem agendar" settings and the personal switches.

create table public.notification_settings (
  agency_id uuid not null default public.current_agency_id() references public.agencies(id) on delete cascade,
  key text not null check (key in ('unscheduled_posts', 'task_assigned', 'mention', 'client_reply', 'capture_request')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (agency_id, key)
);
alter table public.notification_settings enable row level security;
create policy notification_settings_read on public.notification_settings for select to authenticated
  using (agency_id = public.current_agency_id());
create policy notification_settings_admin_write on public.notification_settings for all to authenticated
  using (agency_id = public.current_agency_id() and public.has_role(auth.uid(), 'admin'))
  with check (agency_id = public.current_agency_id() and public.has_role(auth.uid(), 'admin'));

-- Everything is on until an admin turns a type off
create or replace function public.notification_enabled(p_agency uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.enabled from public.notification_settings s where s.agency_id = p_agency and s.key = p_key), true);
$$;

-- Internal helper: push to one person (never exposed to the API)
create or replace function public.internal_push(p_user uuid, p_title text, p_body text, p_task uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_cron_secret';
  if v_secret is null or p_user is null then return; end if;
  begin
    perform net.http_post(
      url := 'https://bzzubzjbsjwuvchuhklr.supabase.co/functions/v1/push-send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6enViempic2p3dXZjaHVoa2xyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5ODE5NDcsImV4cCI6MjEwMDU1Nzk0N30.KlznJ82oOa7DSXDNDZBdzoPhwYTSdP6X6cOzLWM2Q24',
        'X-Cron-Secret', v_secret
      ),
      body := jsonb_build_object('action', 'dispatch', 'user_id', p_user, 'title', p_title, 'body', p_body, 'task_id', p_task)
    );
  exception when others then null;
  end;
end;
$$;

-- "Posts sem agendar": fixed rule (a week back to a week ahead, 09h and 16h, Monday to Saturday), only the switch is configurable
create or replace function public.unscheduled_post_summary()
returns table (agency_id uuid, client_id uuid, client_name text, total int, overdue int, due_today int, awaiting_approval int, first_date date)
language sql
stable
security definer
set search_path = ''
as $$
  with today as (select (now() at time zone 'America/Sao_Paulo')::date as d)
  select c.agency_id, c.id, c.name,
         count(*)::int,
         (count(*) filter (where cp.publish_date < t.d))::int,
         (count(*) filter (where cp.publish_date = t.d))::int,
         (count(*) filter (where cp.status = 'aguardando_aprovacao'))::int,
         min(cp.publish_date)
  from public.calendar_publications cp
  join public.publication_calendars pc on pc.id = cp.calendar_id
  join public.clients c on c.id = pc.client_id
  join public.instagram_connections ic on ic.client_id = c.id and ic.status = 'active'
  cross join today t
  where cp.deleted_at is null
    and c.is_active
    and public.notification_enabled(c.agency_id, 'unscheduled_posts')
    and cp.instagram_scheduled is not true
    and coalesce(cp.instagram_status, '') <> 'published'
    and cp.publish_date between t.d - 7 and t.d + 7
  group by c.agency_id, c.id, c.name;
$$;

drop function if exists public.unscheduled_post_digest(boolean);
create or replace function public.unscheduled_post_digest(p_check_schedule boolean default false)
returns table (user_id uuid, title text, body text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.user_id,
         'Posts sem agendar ⏰',
         sum(r.total) || (case when sum(r.total) > 1 then ' posts' else ' post' end) || ' no calendário sem agendar'
           || (case when sum(r.overdue) > 0 then ' (' || sum(r.overdue) || (case when sum(r.overdue) > 1 then ' atrasados' else ' atrasado' end) || ')' else '' end)
           || ' — ' || left(string_agg(r.client_name || ' ' || r.total, ', ' order by r.overdue desc, r.total desc), 110)
  from public.unscheduled_post_recipients() r
  where not p_check_schedule
     or (
       extract(hour from (now() at time zone 'America/Sao_Paulo'))::int in (9, 16)
       and extract(dow from (now() at time zone 'America/Sao_Paulo'))::int between 1 and 6
     )
  group by r.user_id;
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
    perform public.internal_push(r.user_id, r.title, r.body);
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
  order by r.overdue desc, r.first_date, r.client_name;
$$;

-- The two switches that already existed as push triggers now respect the agency's choice
create or replace function public.pm_tasks_push_on_assign()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_task_id is not null then return new; end if;
  if new.is_draft is true then return new; end if;
  if new.assignee_id is null then return new; end if;
  if new.deleted_at is not null then return new; end if;
  if tg_op = 'UPDATE' and old.assignee_id is not distinct from new.assignee_id then return new; end if;
  if not public.notification_enabled(new.agency_id, 'task_assigned') then return new; end if;
  perform public.internal_push(new.assignee_id, 'Tarefa nova caiu pra você 🎯', new.title, new.id);
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
begin
  if not public.notification_enabled(new.agency_id, 'mention') then return new; end if;
  for m in select (regexp_matches(new.content, '@([a-f0-9-]{36})', 'g'))[1] as uid loop
    begin
      mentioned_id := m.uid::uuid;
    exception when others then continue;
    end;
    if mentioned_id = new.author_id then continue; end if;
    perform public.internal_push(mentioned_id, 'Te chamaram numa conversa 👋', left(new.content, 120), new.task_id);
  end loop;
  return new;
end;
$$;

-- The client answered on the approval page: the person with that task gets a push too (the bell already showed it)
create or replace function public.calendar_publications_push_on_client_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignee uuid;
  v_title text;
begin
  if new.client_responded_at is not distinct from old.client_responded_at then return new; end if;
  if new.status not in ('aprovada', 'alteracao_solicitada') then return new; end if;
  if not public.notification_enabled(new.agency_id, 'client_reply') then return new; end if;
  select t.assignee_id, t.title into v_assignee, v_title from public.pm_tasks t where t.id = new.task_id;
  if v_assignee is null then return new; end if;
  perform public.internal_push(
    v_assignee,
    case when new.status = 'aprovada' then 'Cliente aprovou ✅' else 'Cliente pediu alteração ✏️' end,
    case when new.status = 'aprovada' then coalesce(v_title, 'Publicação') else left(coalesce(new.client_feedback, coalesce(v_title, 'Publicação')), 120) end,
    new.task_id
  );
  return new;
end;
$$;
create trigger trg_calendar_publications_push_on_client_reply
after update of client_responded_at on public.calendar_publications
for each row execute function public.calendar_publications_push_on_client_reply();

-- A client asked for a recording day through the public link: the admins get a push (the bell lists the request too)
create or replace function public.capture_bookings_push_on_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if not public.notification_enabled(new.agency_id, 'capture_request') then return new; end if;
  for r in
    select tm.user_id from public.team_members tm
    join public.user_roles ur on ur.user_id = tm.user_id and ur.role = 'admin'
    where tm.agency_id = new.agency_id and tm.is_active
  loop
    perform public.internal_push(
      r.user_id,
      'Novo pedido de gravação 🎬',
      new.company_name || ' — ' || to_char(new.booking_date, 'DD/MM') || (case when new.period = 'manha' then ' (manhã)' else ' (tarde)' end)
    );
  end loop;
  return new;
end;
$$;
create trigger trg_capture_bookings_push_on_request
after insert on public.capture_bookings
for each row execute function public.capture_bookings_push_on_request();

drop table public.unscheduled_alert_settings;
drop table public.user_alert_preferences;

revoke execute on function public.notification_enabled(uuid, text) from public, anon, authenticated;
revoke execute on function public.internal_push(uuid, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.unscheduled_post_summary() from public, anon, authenticated;
revoke execute on function public.unscheduled_post_digest(boolean) from public, anon, authenticated;
revoke execute on function public.notify_unscheduled_posts() from public, anon, authenticated;
revoke execute on function public.my_unscheduled_post_alerts() from public, anon;
grant execute on function public.my_unscheduled_post_alerts() to authenticated;
revoke execute on function public.calendar_publications_push_on_client_reply() from public, anon, authenticated;
revoke execute on function public.capture_bookings_push_on_request() from public, anon, authenticated;
