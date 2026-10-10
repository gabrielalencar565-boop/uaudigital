-- "Enviar notificação de teste" button: pushes a test message to the caller's own devices, nobody else's
create or replace function public.send_test_push()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_cron_secret';
  if v_secret is null then
    raise exception 'push not configured';
  end if;
  perform net.http_post(
    url := 'https://bzzubzjbsjwuvchuhklr.supabase.co/functions/v1/push-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6enViempic2p3dXZjaHVoa2xyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5ODE5NDcsImV4cCI6MjEwMDU1Nzk0N30.KlznJ82oOa7DSXDNDZBdzoPhwYTSdP6X6cOzLWM2Q24',
      'X-Cron-Secret', v_secret
    ),
    body := jsonb_build_object(
      'action', 'dispatch',
      'user_id', auth.uid(),
      'title', 'Teste de notificação 🔔',
      'body', 'Se você viu isto, os avisos estão chegando neste aparelho.'
    )
  );
end;
$$;

revoke execute on function public.send_test_push() from public, anon;
grant execute on function public.send_test_push() to authenticated;
