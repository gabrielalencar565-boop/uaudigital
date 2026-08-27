-- Anexos de tarefa são um recurso colaborativo — várias pessoas da equipe mexem na mesma
-- tarefa, e restringir a exclusão a "só quem enviou ou um admin" bloqueava membros do time
-- de limpar anexos enviados por colegas na mesma tarefa. Alinha com pm_attachments_update_auth,
-- que já permite qualquer autenticado.
DROP POLICY IF EXISTS "pm_attachments_delete" ON public.pm_attachments;
CREATE POLICY "pm_attachments_delete" ON public.pm_attachments
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
