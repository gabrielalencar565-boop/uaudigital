create index if not exists crm_leads_agency_id_idx on public.crm_leads (agency_id);
create index if not exists crm_tasks_agency_id_idx on public.crm_tasks (agency_id);
create index if not exists crm_proposals_agency_id_idx on public.crm_proposals (agency_id);
create index if not exists crm_activity_log_agency_id_idx on public.crm_activity_log (agency_id);
create index if not exists crm_lead_automations_agency_id_idx on public.crm_lead_automations (agency_id);
create index if not exists crm_lead_welcome_log_agency_id_idx on public.crm_lead_welcome_log (agency_id);
