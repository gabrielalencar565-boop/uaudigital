-- Reminders for posts that sit in the Cronograma but were never scheduled on Instagram.
-- Scope: clients with an active Instagram connection (the only ones the app can schedule for), live publications
-- dated from 7 days ago to 7 days ahead that are neither scheduled nor published. Who is reminded: the person set as
-- "Agendamento" for that client in the stage flow; with nobody set, the agency's admins.

create or replace function public.unscheduled_post_recipients()
returns table (
  user_id uuid, agency_id uuid, client_id uuid, client_name text,
  total int, overdue int, due_today int, awaiting_approval int, first_date date
)
language sql
stable
security definer
set search_path = ''
as $$
  with today as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  s as (
    select c.agency_id, c.id as client_id, c.name as client_name,
           count(*)::int as total,
           (count(*) filter (where cp.publish_date < t.d))::int as overdue,
           (count(*) filter (where cp.publish_date = t.d))::int as due_today,
           (count(*) filter (where cp.status = 'aguardando_aprovacao'))::int as awaiting_approval,
           min(cp.publish_date) as first_date
    from public.calendar_publications cp
    join public.publication_calendars pc on pc.id = cp.calendar_id
    join public.clients c on c.id = pc.client_id
    join public.instagram_connections ic on ic.client_id = c.id and ic.status = 'active'
    cross join today t
    where cp.deleted_at is null
      and c.is_active
      and cp.instagram_scheduled is not true
      and coalesce(cp.instagram_status, '') <> 'published'
      and cp.publish_date between t.d - 7 and t.d + 7
    group by c.agency_id, c.id, c.name
  ),
  o as (
    select s.*,
      (select case jsonb_typeof(f.stage_assignees -> 'agendamento' -> (s.client_id::text))
                when 'array' then f.stage_assignees -> 'agendamento' -> (s.client_id::text) ->> 0
                when 'string' then f.stage_assignees -> 'agendamento' ->> (s.client_id::text)
              end
         from public.pm_stage_flows f
        where f.agency_id = s.agency_id and f.is_default
        limit 1) as owner_id
    from s
  )
  select o.owner_id::uuid, o.agency_id, o.client_id, o.client_name, o.total, o.overdue, o.due_today, o.awaiting_approval, o.first_date
  from o
  where o.owner_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  union all
  select tm.user_id, o.agency_id, o.client_id, o.client_name, o.total, o.overdue, o.due_today, o.awaiting_approval, o.first_date
  from o
  join public.team_members tm on tm.agency_id = o.agency_id and tm.is_active
  join public.user_roles ur on ur.user_id = tm.user_id and ur.role = 'admin'
  where o.owner_id is null or o.owner_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

-- One push per person, summing up their clients (what the cron sends)
create or replace function public.unscheduled_post_digest()
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
  for r in select * from public.unscheduled_post_digest() loop
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

-- What the bell shows to the signed-in person (same rule as the push)
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

revoke execute on function public.unscheduled_post_recipients() from public, anon, authenticated;
revoke execute on function public.unscheduled_post_digest() from public, anon, authenticated;
revoke execute on function public.notify_unscheduled_posts() from public, anon, authenticated;
revoke execute on function public.my_unscheduled_post_alerts() from public, anon;
grant execute on function public.my_unscheduled_post_alerts() to authenticated;

-- 09:00 and 16:00 in Brasília (12:00 and 19:00 UTC), Monday to Saturday
select cron.schedule('unscheduled-posts-reminder', '0 12,19 * * 1-6', $cron$select public.notify_unscheduled_posts();$cron$);
