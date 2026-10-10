-- One place for the "unscheduled posts" rule, shared by the reminders (recipients) and by the client list/page
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
    and cp.instagram_scheduled is not true
    and coalesce(cp.instagram_status, '') <> 'published'
    and cp.publish_date between t.d - 7 and t.d + 7
  group by c.agency_id, c.id, c.name;
$$;

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
  with o as (
    select s.*,
      (select case jsonb_typeof(f.stage_assignees -> 'agendamento' -> (s.client_id::text))
                when 'array' then f.stage_assignees -> 'agendamento' -> (s.client_id::text) ->> 0
                when 'string' then f.stage_assignees -> 'agendamento' ->> (s.client_id::text)
              end
         from public.pm_stage_flows f
        where f.agency_id = s.agency_id and f.is_default
        limit 1) as owner_id
    from public.unscheduled_post_summary() s
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

-- For everyone on the team: which clients of their agency have posts waiting to be scheduled
create or replace function public.unscheduled_post_by_client()
returns table (client_id uuid, total int, overdue int, due_today int, awaiting_approval int, first_date date)
language sql
stable
security definer
set search_path = ''
as $$
  select s.client_id, s.total, s.overdue, s.due_today, s.awaiting_approval, s.first_date
  from public.unscheduled_post_summary() s
  where s.agency_id = public.current_agency_id();
$$;

revoke execute on function public.unscheduled_post_summary() from public, anon, authenticated;
revoke execute on function public.unscheduled_post_recipients() from public, anon, authenticated;
revoke execute on function public.unscheduled_post_by_client() from public, anon;
grant execute on function public.unscheduled_post_by_client() to authenticated;
