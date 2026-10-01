alter table public.chat_conversations add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.chat_participants add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.chat_messages add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.chat_message_attachments add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.chat_message_reads add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.chat_presence add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.chat_mentions add column agency_id uuid references public.agencies(id) default public.current_agency_id();
