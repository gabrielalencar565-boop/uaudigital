CREATE TABLE public.notification_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notification_key text NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, notification_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_dismissals TO authenticated;
GRANT ALL ON public.notification_dismissals TO service_role;

ALTER TABLE public.notification_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own dismissals" ON public.notification_dismissals
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own dismissals" ON public.notification_dismissals
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own dismissals" ON public.notification_dismissals
  FOR DELETE TO authenticated USING (user_id = auth.uid());