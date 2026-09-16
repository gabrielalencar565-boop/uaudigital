-- Web Push notifications for existing events (task assignment, @mentions, due-soon/
-- overdue digest) so they reach users even when the app tab/PWA is closed — the bell
-- dropdown and toast/sound system only fire while a tab is open. Delivery itself happens
-- in the push-send edge function.

-- ── Subscriptions: one row per subscribed device ──
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "users manage own push subscriptions"
  on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- service_role (the push-send edge function's admin client) needs to read every
-- subscription to fan out a dispatch/digest — RLS above only covers end-user access.
grant select, delete on public.push_subscriptions to service_role;

-- ── Cron auth for the daily digest (same Vault-backed pattern as
-- verify_instagram_cron_secret, see 20260821140000_instagram_cron_secret_verify_fn.sql) ──
create or replace function public.verify_push_cron_secret(candidate text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select candidate is not null
    and length(candidate) > 0
    and candidate = (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret');
$$;

revoke all on function public.verify_push_cron_secret(text) from public;
revoke all on function public.verify_push_cron_secret(text) from anon, authenticated;
grant execute on function public.verify_push_cron_secret(text) to service_role;

-- VAPID keys (also in Vault: vapid_public_key/vapid_private_key/vapid_subject) — the
-- edge function reads them itself via this function rather than Edge Function secrets,
-- since Vault is reachable here without needing CLI/dashboard access to set them.
create or replace function public.get_vapid_config()
returns table(public_key text, private_key text, subject text)
language sql
security definer
set search_path = ''
as $$
  select
    (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public_key'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_private_key'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_subject');
$$;

revoke all on function public.get_vapid_config() from public;
revoke all on function public.get_vapid_config() from anon, authenticated;
grant execute on function public.get_vapid_config() to service_role;

-- ── Trigger: task assigned/reassigned ──
-- Fires only for root tasks (parent_task_id is null) — subtasks are excluded from
-- notifications app-wide since the bell dropdown fix (see NotificationsDropdown.tsx).
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

  -- push-send's "dispatch" action accepts an arbitrary user_id/title/body straight from the
  -- request — unlike whatsapp-dispatch's process_outbox (which only flushes an already-
  -- validated queued row), an apikey-only call here would let anyone holding the public
  -- anon key spam any user with fake push notifications, so this also sends X-Cron-Secret
  -- (same Vault secret the daily_digest cron uses) and the edge function checks it too.
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
        'title', 'Nova tarefa atribuída',
        'body', new.title,
        'task_id', new.id
      )
    );
  exception when others then null;
  end;

  return new;
end;
$$;

drop trigger if exists trg_pm_tasks_push_on_assign on public.pm_tasks;
create trigger trg_pm_tasks_push_on_assign
  after insert or update of assignee_id on public.pm_tasks
  for each row execute function public.pm_tasks_push_on_assign();

-- ── Trigger: @mention in a comment (same @<uuid> inline format PmCommentsSection.tsx
-- writes and NotificationsDropdown.tsx already parses) ──
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
          'title', 'Você foi mencionado',
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

drop trigger if exists trg_pm_comments_push_on_mention on public.pm_comments;
create trigger trg_pm_comments_push_on_mention
  after insert on public.pm_comments
  for each row execute function public.pm_comments_push_on_mention();
