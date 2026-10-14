-- As mensagens das automações saem pela função crm-whatsapp-outbox (WhatsApp Cloud API da agência), não mais pelo envio de avisos da equipe.
create or replace function public.comercial_send_wa(p_lead public.comercial_leads, p_text text, p_ref text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_phone text := regexp_replace(coalesce(p_lead.phone, ''), '\D', '', 'g');
begin
  if v_phone = '' or btrim(coalesce(p_text, '')) = '' then return false; end if;
  insert into public.whatsapp_outbox (notification_type, message, target_phone, source_ref, status, agency_id)
  values ('crm_automation', p_text, v_phone, p_ref, 'queued', p_lead.agency_id);
  begin
    perform net.http_post(
      url := 'https://bzzubzjbsjwuvchuhklr.supabase.co/functions/v1/crm-whatsapp-outbox',
      headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6enViempic2p3dXZjaHVoa2xyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5ODE5NDcsImV4cCI6MjEwMDU1Nzk0N30.KlznJ82oOa7DSXDNDZBdzoPhwYTSdP6X6cOzLWM2Q24"}'::jsonb,
      body := '{}'::jsonb
    );
  exception when others then null;
  end;
  return true;
end;
$fn$;
revoke execute on function public.comercial_send_wa(public.comercial_leads, text, text) from public, anon, authenticated;
