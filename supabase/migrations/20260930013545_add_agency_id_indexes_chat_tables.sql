create index if not exists chat_conversations_agency_id_idx on public.chat_conversations (agency_id);
create index if not exists chat_participants_agency_id_idx on public.chat_participants (agency_id);
create index if not exists chat_messages_agency_id_idx on public.chat_messages (agency_id);
create index if not exists chat_message_attachments_agency_id_idx on public.chat_message_attachments (agency_id);
create index if not exists chat_message_reads_agency_id_idx on public.chat_message_reads (agency_id);
create index if not exists chat_presence_agency_id_idx on public.chat_presence (agency_id);
create index if not exists chat_mentions_agency_id_idx on public.chat_mentions (agency_id);
