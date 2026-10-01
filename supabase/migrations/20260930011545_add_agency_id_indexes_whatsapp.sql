create index if not exists whatsapp_contacts_agency_id_idx on public.whatsapp_contacts (agency_id);
create index if not exists whatsapp_messages_agency_id_idx on public.whatsapp_messages (agency_id);
create index if not exists whatsapp_outbox_agency_id_idx on public.whatsapp_outbox (agency_id);
create index if not exists whatsapp_send_log_agency_id_idx on public.whatsapp_send_log (agency_id);
create index if not exists whatsapp_automations_agency_id_idx on public.whatsapp_automations (agency_id);
create index if not exists whatsapp_ranking_state_agency_id_idx on public.whatsapp_ranking_state (agency_id);
create index if not exists user_whatsapp_preferences_agency_id_idx on public.user_whatsapp_preferences (agency_id);
