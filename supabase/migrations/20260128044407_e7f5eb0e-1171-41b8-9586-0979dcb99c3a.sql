-- Disable bootstrap-first-admin escalation path
DROP POLICY IF EXISTS "Bootstrap first admin" ON public.user_roles;