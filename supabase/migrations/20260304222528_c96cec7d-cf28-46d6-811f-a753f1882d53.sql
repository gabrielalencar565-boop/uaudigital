
-- Allow admins to delete activity logs
CREATE POLICY "task_activity_log_admin_delete" ON public.task_activity_log
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
