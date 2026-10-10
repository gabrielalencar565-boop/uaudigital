-- Controls for the "posts sem agendar" reminders: agency rules (admins) and each person's own switches.

create table public.unscheduled_alert_settings (
  agency_id uuid primary key default public.current_agency_id() references public.agencies(id) on delete cascade,
  enabled boolean not null default true,
  push_enabled boolean not null default true,
  bell_enabled boolean not null default true,
  send_hours smallint[] not null default '{9,16}'
    check (cardinality(send_hours) between 1 and 6 and send_hours <@ array[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23]::smallint[]),
  weekdays smallint[] not null default '{1,2,3,4,5,6}'
    check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]),
  days_back smallint not null default 7 check (days_back between 0 and 30),
  days_ahead smallint not null default 7 check (days_ahead between 0 and 30),
  updated_at timestamptz not null default now()
);

create table public.user_alert_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  unscheduled_push boolean not null default true,
  unscheduled_bell boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.unscheduled_alert_settings enable row level security;
alter table public.user_alert_preferences enable row level security;

create policy unscheduled_alert_settings_read on public.unscheduled_alert_settings for select to authenticated
  using (agency_id = public.current_agency_id());
create policy unscheduled_alert_settings_admin_write on public.unscheduled_alert_settings for all to authenticated
  using (agency_id = public.current_agency_id() and public.has_role(auth.uid(), 'admin'))
  with check (agency_id = public.current_agency_id() and public.has_role(auth.uid(), 'admin'));

create policy user_alert_preferences_own on public.user_alert_preferences for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- The rule now reads the agency's window and on/off switch
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
  left join public.unscheduled_alert_settings st on st.agency_id = c.agency_id
  cross join today t
  where cp.deleted_at is null
    and c.is_active
    and coalesce(st.enabled, true)
    and cp.instagram_scheduled is not true
    and coalesce(cp.instagram_status, '') <> 'published'
    and cp.publish_date between t.d - coalesce(st.days_back, 7)::int and t.d + coalesce(st.days_ahead, 7)::int
  group by c.agency_id, c.id, c.name;
$$;

-- Push digest: respects the agency's channel switch and each person's own choice; with p_check_schedule it only
-- returns people whose agency is due right now (hour and weekday, Brasília time) — what the hourly cron uses.
drop function if exists public.unscheduled_post_digest();
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
  left join public.unscheduled_alert_settings st on st.agency_id = r.agency_id
  left join public.user_alert_preferences up on up.user_id = r.user_id
  where coalesce(st.push_enabled, true)
    and coalesce(up.unscheduled_push, true)
    and (
      not p_check_schedule
      or (
        extract(hour from (now() at time zone 'America/Sao_Paulo'))::int = any (coalesce(st.send_hours, '{9,16}'::smallint[]))
        and extract(dow from (now() at time zone 'America/Sao_Paulo'))::int = any (coalesce(st.weekdays, '{1,2,3,4,5,6}'::smallint[]))
      )
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
  v_secret text;
  r record;
  v_sent int := 0;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_cron_secret';
  if v_secret is null then return 0; end if;
  for r in select * from public.unscheduled_post_digest(true) loop
    begin
      perform net.http_post(
        url := 'https://bzzubzjbsjwuvchuhklr.supabase.co/functions/v1/push-send',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6enViempic2p3dXZjaHVoa2xyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5ODE5NDcsImV4cCI6MjEwMDU1Nzk0N30.KlznJ82oOa7DSXDNDZBdzoPhwYTSdP6X6cOzLWM2Q24',
          'X-Cron-Secret', v_secret
        ),
        body := jsonb_build_object('action', 'dispatch', 'user_id', r.user_id, 'title', r.title, 'body', r.body)
      );
      v_sent := v_sent + 1;
    exception when others then null;
    end;
  end loop;
  return v_sent;
end;
$$;

-- The bell: agency switch and personal switch both have to be on
create or replace function public.my_unscheduled_post_alerts()
returns table (client_id uuid, client_name text, total int, overdue int, due_today int, awaiting_approval int, first_date date)
language sql
stable
security definer
set search_path = ''
as $$
  select r.client_id, r.client_name, r.total, r.overdue, r.due_today, r.awaiting_approval, r.first_date
  from public.unscheduled_post_recipients() r
  left join public.unscheduled_alert_settings st on st.agency_id = r.agency_id
  left join public.user_alert_preferences up on up.user_id = r.user_id
  where r.user_id = auth.uid()
    and coalesce(st.bell_enabled, true)
    and coalesce(up.unscheduled_bell, true)
  order by r.overdue desc, r.first_date, r.client_name;
$$;

revoke execute on function public.unscheduled_post_summary() from public, anon, authenticated;
revoke execute on function public.unscheduled_post_digest(boolean) from public, anon, authenticated;
revoke execute on function public.notify_unscheduled_posts() from public, anon, authenticated;
revoke execute on function public.my_unscheduled_post_alerts() from public, anon;
grant execute on function public.my_unscheduled_post_alerts() to authenticated;

-- Hourly check: each agency's own hours and weekdays decide whether anything is sent
select cron.schedule('unscheduled-posts-reminder', '0 * * * *', $cron$select public.notify_unscheduled_posts();$cron$);
