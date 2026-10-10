-- Who receives each type of notification: everybody (default), or only some roles (administrador / membro) and cargos.
-- Same idea as the permissions screen: a person qualifies if their role OR any of their cargos was selected.

alter table public.notification_settings
  add column audience_all boolean not null default true,
  add column allowed_roles text[] not null default '{}' check (allowed_roles <@ array['admin', 'member']::text[]),
  add column allowed_cargos text[] not null default '{}';

create or replace function public.notification_audience_ok(p_user uuid, p_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_agency uuid;
  v_cargos text[];
  s record;
  v_admin boolean;
begin
  select tm.agency_id, tm.role_titles into v_agency, v_cargos from public.team_members tm where tm.user_id = p_user limit 1;
  if v_agency is null then return true; end if;
  select st.audience_all, st.allowed_roles, st.allowed_cargos into s
  from public.notification_settings st where st.agency_id = v_agency and st.key = p_key;
  if not found or s.audience_all then return true; end if;
  v_admin := exists (select 1 from public.user_roles ur where ur.user_id = p_user and ur.role = 'admin');
  return (v_admin and 'admin' = any (s.allowed_roles))
      or (not v_admin and 'member' = any (s.allowed_roles))
      or (coalesce(v_cargos, '{}'::text[]) && s.allowed_cargos);
end;
$$;

-- Which types reach the signed-in person (the bell and the personal list use it)
create or replace function public.my_notification_audience()
returns table (key text, allowed boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select k, public.notification_audience_ok(auth.uid(), k)
  from unnest(array['unscheduled_posts', 'task_assigned', 'mention', 'client_reply', 'capture_request']) as k;
$$;

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
  if p_key is not null then
    -- the person turned this type off for themselves
    if exists (select 1 from public.user_notification_prefs u where u.user_id = p_user and u.key = p_key and not u.enabled) then
      return;
    end if;
    -- the agency limited this type to other roles / cargos
    if not public.notification_audience_ok(p_user, p_key) then
      return;
    end if;
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
    and public.notification_audience_ok(auth.uid(), 'unscheduled_posts')
    and not exists (select 1 from public.user_notification_prefs u where u.user_id = auth.uid() and u.key = 'unscheduled_posts' and not u.enabled)
  order by r.overdue desc, r.first_date, r.client_name;
$$;

revoke execute on function public.notification_audience_ok(uuid, text) from public, anon, authenticated;
revoke execute on function public.internal_push(uuid, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.my_notification_audience() from public, anon;
grant execute on function public.my_notification_audience() to authenticated;
revoke execute on function public.my_unscheduled_post_alerts() from public, anon;
grant execute on function public.my_unscheduled_post_alerts() to authenticated;
