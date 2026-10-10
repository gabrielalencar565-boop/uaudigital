-- On iOS the notification shows title, a "from <app>" line and the body. Keep the body to one short line so it stays compact.

create or replace function public.internal_push(p_user uuid, p_title text, p_body text, p_task uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_body text := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_cron_secret';
  if v_secret is null or p_user is null then return; end if;
  if char_length(v_body) > 44 then v_body := rtrim(left(v_body, 43)) || '…'; end if;
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

-- "20 sem agendar · 6 atrasados": the clients are listed in the bell, not in the push
create or replace function public.unscheduled_post_digest(p_check_schedule boolean default false)
returns table (user_id uuid, title text, body text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.user_id,
         'Posts sem agendar ⏰',
         sum(r.total) || ' sem agendar'
           || (case when sum(r.overdue) > 0 then ' · ' || sum(r.overdue) || (case when sum(r.overdue) > 1 then ' atrasados' else ' atrasado' end) else '' end)
  from public.unscheduled_post_recipients() r
  where not p_check_schedule
     or (
       extract(hour from (now() at time zone 'America/Sao_Paulo'))::int in (9, 16)
       and extract(dow from (now() at time zone 'America/Sao_Paulo'))::int between 1 and 6
     )
  group by r.user_id;
$$;

-- Mentions: drop the raw "@<id>" tokens from the text
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
    perform public.internal_push(mentioned_id, 'Te chamaram numa conversa 👋', regexp_replace(new.content, '@[a-f0-9-]{36}', '', 'g'), new.task_id);
  end loop;
  return new;
end;
$$;

create or replace function public.send_test_push()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  perform public.internal_push(auth.uid(), 'Teste de notificação 🔔', 'Os avisos estão chegando aqui.');
end;
$$;

revoke execute on function public.internal_push(uuid, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.unscheduled_post_digest(boolean) from public, anon, authenticated;
revoke execute on function public.pm_comments_push_on_mention() from public, anon, authenticated;
revoke execute on function public.send_test_push() from public, anon;
grant execute on function public.send_test_push() to authenticated;
