
DROP POLICY IF EXISTS "Admins manage crm-proposals" ON storage.objects;
CREATE POLICY "Admins manage crm-proposals" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'crm-proposals' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'crm-proposals' AND public.has_role(auth.uid(), 'admin'::public.app_role));
