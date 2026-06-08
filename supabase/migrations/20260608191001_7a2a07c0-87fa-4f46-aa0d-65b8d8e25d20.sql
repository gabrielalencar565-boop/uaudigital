
CREATE POLICY "chat_att_storage_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-attachments');

CREATE POLICY "chat_att_storage_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-attachments' AND owner = auth.uid());

CREATE POLICY "chat_att_storage_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-attachments' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)));
