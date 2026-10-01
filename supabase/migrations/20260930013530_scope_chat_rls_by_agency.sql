-- chat_conversations
drop policy "chat_conv_select_general_or_participant" on public.chat_conversations;
create policy "chat_conv_select_general_or_participant" on public.chat_conversations
  for select to authenticated
  using ((type = 'general'::chat_conversation_type or chat_is_participant(id, (select auth.uid()))) and agency_id = (select public.current_agency_id()));

-- chat_mentions
drop policy "chat_mentions_insert_own_msg" on public.chat_mentions;
create policy "chat_mentions_insert_own_msg" on public.chat_mentions
  for insert to authenticated
  with check ((exists (select 1 from chat_messages m where m.id = chat_mentions.message_id and m.sender_id = (select auth.uid()))) and agency_id = (select public.current_agency_id()));

drop policy "chat_mentions_select_self_or_msg" on public.chat_mentions;
create policy "chat_mentions_select_self_or_msg" on public.chat_mentions
  for select to authenticated
  using ((user_id = (select auth.uid()) or (exists (select 1 from chat_messages m where m.id = chat_mentions.message_id and (chat_conversation_type(m.conversation_id) = 'general'::chat_conversation_type or chat_is_participant(m.conversation_id, (select auth.uid())))))) and agency_id = (select public.current_agency_id()));

-- chat_message_attachments
drop policy "chat_att_delete_own_or_admin" on public.chat_message_attachments;
create policy "chat_att_delete_own_or_admin" on public.chat_message_attachments
  for delete to authenticated
  using ((exists (select 1 from chat_messages m where m.id = chat_message_attachments.message_id and (m.sender_id = (select auth.uid()) or has_role((select auth.uid()), 'admin'::app_role)))) and agency_id = (select public.current_agency_id()));

drop policy "chat_att_insert_own_msg" on public.chat_message_attachments;
create policy "chat_att_insert_own_msg" on public.chat_message_attachments
  for insert to authenticated
  with check ((exists (select 1 from chat_messages m where m.id = chat_message_attachments.message_id and m.sender_id = (select auth.uid()))) and agency_id = (select public.current_agency_id()));

drop policy "chat_att_select_msg_visible" on public.chat_message_attachments;
create policy "chat_att_select_msg_visible" on public.chat_message_attachments
  for select to authenticated
  using ((exists (select 1 from chat_messages m where m.id = chat_message_attachments.message_id and (chat_conversation_type(m.conversation_id) = 'general'::chat_conversation_type or chat_is_participant(m.conversation_id, (select auth.uid()))))) and agency_id = (select public.current_agency_id()));

-- chat_message_reads
drop policy "chat_reads_insert_self" on public.chat_message_reads;
create policy "chat_reads_insert_self" on public.chat_message_reads
  for insert to authenticated
  with check (user_id = (select auth.uid()) and agency_id = (select public.current_agency_id()));

drop policy "chat_reads_select_self" on public.chat_message_reads;
create policy "chat_reads_select_self" on public.chat_message_reads
  for select to authenticated
  using ((user_id = (select auth.uid()) or (exists (select 1 from chat_messages m where m.id = chat_message_reads.message_id and m.sender_id = (select auth.uid())))) and agency_id = (select public.current_agency_id()));

-- chat_messages
drop policy "chat_msg_delete_own_or_admin" on public.chat_messages;
create policy "chat_msg_delete_own_or_admin" on public.chat_messages
  for delete to authenticated
  using ((sender_id = (select auth.uid()) or has_role((select auth.uid()), 'admin'::app_role)) and agency_id = (select public.current_agency_id()));

drop policy "chat_msg_insert_participant" on public.chat_messages;
create policy "chat_msg_insert_participant" on public.chat_messages
  for insert to authenticated
  with check (sender_id = (select auth.uid()) and (chat_conversation_type(conversation_id) = 'general'::chat_conversation_type or chat_is_participant(conversation_id, (select auth.uid()))) and agency_id = (select public.current_agency_id()));

drop policy "chat_msg_select_visible" on public.chat_messages;
create policy "chat_msg_select_visible" on public.chat_messages
  for select to authenticated
  using ((chat_conversation_type(conversation_id) = 'general'::chat_conversation_type or chat_is_participant(conversation_id, (select auth.uid()))) and agency_id = (select public.current_agency_id()));

drop policy "chat_msg_update_own_or_admin" on public.chat_messages;
create policy "chat_msg_update_own_or_admin" on public.chat_messages
  for update to authenticated
  using ((sender_id = (select auth.uid()) or has_role((select auth.uid()), 'admin'::app_role)) and agency_id = (select public.current_agency_id()));

-- chat_participants
drop policy "chat_part_insert_self_general" on public.chat_participants;
create policy "chat_part_insert_self_general" on public.chat_participants
  for insert to authenticated
  with check (user_id = (select auth.uid()) and chat_conversation_type(conversation_id) = 'general'::chat_conversation_type and agency_id = (select public.current_agency_id()));

drop policy "chat_part_select_own_or_general" on public.chat_participants;
create policy "chat_part_select_own_or_general" on public.chat_participants
  for select to authenticated
  using ((user_id = (select auth.uid()) or chat_conversation_type(conversation_id) = 'general'::chat_conversation_type or chat_is_participant(conversation_id, (select auth.uid()))) and agency_id = (select public.current_agency_id()));

drop policy "chat_part_update_own" on public.chat_participants;
create policy "chat_part_update_own" on public.chat_participants
  for update to authenticated
  using (user_id = (select auth.uid()) and agency_id = (select public.current_agency_id()))
  with check (user_id = (select auth.uid()) and agency_id = (select public.current_agency_id()));

-- chat_presence
drop policy "chat_presence_select_all" on public.chat_presence;
create policy "chat_presence_select_all" on public.chat_presence
  for select to authenticated
  using (agency_id = (select public.current_agency_id()));

drop policy "chat_presence_update_self" on public.chat_presence;
create policy "chat_presence_update_self" on public.chat_presence
  for update to authenticated
  using (user_id = (select auth.uid()) and agency_id = (select public.current_agency_id()))
  with check (user_id = (select auth.uid()) and agency_id = (select public.current_agency_id()));

drop policy "chat_presence_upsert_self" on public.chat_presence;
create policy "chat_presence_upsert_self" on public.chat_presence
  for insert to authenticated
  with check (user_id = (select auth.uid()) and agency_id = (select public.current_agency_id()));
