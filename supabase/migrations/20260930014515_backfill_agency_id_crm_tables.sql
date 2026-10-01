update public.crm_leads set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.crm_tasks set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.crm_proposals set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.crm_activity_log set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.crm_lead_automations set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.crm_lead_welcome_log set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
