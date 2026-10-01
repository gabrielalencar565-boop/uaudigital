update public.chat_conversations set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.chat_participants set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.chat_messages set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.chat_message_attachments set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.chat_message_reads set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.chat_presence set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.chat_mentions set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
