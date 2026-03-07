
-- Fix: Make anon SELECT policies PERMISSIVE instead of RESTRICTIVE
-- pm_tasks
DROP POLICY IF EXISTS "pm_tasks_anon_select" ON public.pm_tasks;
CREATE POLICY "pm_tasks_anon_select" ON public.pm_tasks
  FOR SELECT TO anon USING (true);

-- pm_attachments
DROP POLICY IF EXISTS "pm_attachments_anon_select" ON public.pm_attachments;
CREATE POLICY "pm_attachments_anon_select" ON public.pm_attachments
  FOR SELECT TO anon USING (true);

-- clients
DROP POLICY IF EXISTS "clients_anon_select" ON public.clients;
CREATE POLICY "clients_anon_select" ON public.clients
  FOR SELECT TO anon USING (true);

-- pm_cronograma_feedback - also fix
DROP POLICY IF EXISTS "pm_cronograma_feedback_public_read" ON public.pm_cronograma_feedback;
CREATE POLICY "pm_cronograma_feedback_public_read" ON public.pm_cronograma_feedback
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "pm_cronograma_feedback_public_insert" ON public.pm_cronograma_feedback;
CREATE POLICY "pm_cronograma_feedback_public_insert" ON public.pm_cronograma_feedback
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "pm_cronograma_feedback_public_update" ON public.pm_cronograma_feedback;
CREATE POLICY "pm_cronograma_feedback_public_update" ON public.pm_cronograma_feedback
  FOR UPDATE TO anon, authenticated USING (true);
