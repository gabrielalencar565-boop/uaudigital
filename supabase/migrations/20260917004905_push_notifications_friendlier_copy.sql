-- Friendlier, more "Uau Digital" push notification copy — the plain "Nova tarefa
-- atribuída" / "Você foi mencionado" titles felt too dry compared to the rest of the
-- app's voice (see MeuPainelPanel.tsx's motivational header phrases).

create or replace function public.pm_tasks_push_on_assign()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  if new.parent_task_id is not null then return new; end if;
  if new.is_draft is true then return new; end if;
  if new.assignee_id is null then return new; end if;
  if new.deleted_at is not null then return new; end if;
  if tg_op = 'UPDATE' and old.assignee_id is not distinct from new.assignee_id then return new; end if;

  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_cron_secret';

  begin
    perform net.http_post(
      url := 'https://bzzubzjbsjwuvchuhklr.supabase.co/functions/v1/push-send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6enViempic2p3dXZjaHVoa2xyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5ODE5NDcsImV4cCI6MjEwMDU1Nzk0N30.KlznJ82oOa7DSXDNDZBdzoPhwYTSdP6X6cOzLWM2Q24',
        'X-Cron-Secret', v_secret
      ),
      body := jsonb_build_object(
        'action', 'dispatch',
        'user_id', new.assignee_id,
        'title', 'Tarefa nova caiu pra você 🎯',
        'body', new.title,
        'task_id', new.id
      )
    );
  exception when others then null;
  end;

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
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_cron_secret';

  for m in select (regexp_matches(new.content, '@([a-f0-9-]{36})', 'g'))[1] as uid loop
    begin
      mentioned_id := m.uid::uuid;
    exception when others then continue;
    end;
    if mentioned_id = new.author_id then continue; end if;

    begin
      perform net.http_post(
        url := 'https://bzzubzjbsjwuvchuhklr.supabase.co/functions/v1/push-send',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6enViempic2p3dXZjaHVoa2xyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5ODE5NDcsImV4cCI6MjEwMDU1Nzk0N30.KlznJ82oOa7DSXDNDZBdzoPhwYTSdP6X6cOzLWM2Q24',
          'X-Cron-Secret', v_secret
        ),
        body := jsonb_build_object(
          'action', 'dispatch',
          'user_id', mentioned_id,
          'title', 'Te chamaram numa conversa 👋',
          'body', left(new.content, 120),
          'task_id', new.task_id
        )
      );
    exception when others then null;
    end;
  end loop;

  return new;
end;
$$;
