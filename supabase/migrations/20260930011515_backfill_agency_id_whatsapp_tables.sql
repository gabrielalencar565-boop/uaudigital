update public.whatsapp_contacts set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.whatsapp_messages set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.whatsapp_outbox set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.whatsapp_send_log set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.whatsapp_automations set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.whatsapp_ranking_state set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.user_whatsapp_preferences set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
