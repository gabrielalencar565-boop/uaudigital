-- The instagram-publish edge function's "run_schedules" action (triggered every 5min by
-- pg_cron) was comparing the X-Cron-Secret header against a Deno.env var
-- (INSTAGRAM_CRON_SECRET) that had drifted out of sync with the value actually stored in
-- Vault (instagram_cron_secret) — the value pg_cron itself sends. Every single tick since
-- the feature launched returned 401 Unauthorized, so the Cronograma → Instagram
-- auto-publish pipeline has never successfully run.
--
-- Fixes the drift risk at the root by making Vault the one source of truth: the edge
-- function now verifies the header via this function instead of its own env var, so
-- there's nothing left to fall out of sync. security definer + a narrow search_path let
-- it read vault.decrypted_secrets despite the caller (service_role) not having direct
-- grants there; execute is restricted to service_role since this is only ever meant to be
-- called by the edge function's admin client.
create or replace function public.verify_instagram_cron_secret(candidate text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select candidate is not null
    and length(candidate) > 0
    and candidate = (select decrypted_secret from vault.decrypted_secrets where name = 'instagram_cron_secret');
$$;

revoke all on function public.verify_instagram_cron_secret(text) from public;
revoke all on function public.verify_instagram_cron_secret(text) from anon, authenticated;
grant execute on function public.verify_instagram_cron_secret(text) to service_role;
