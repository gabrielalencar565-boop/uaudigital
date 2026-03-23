
CREATE TABLE public.notification_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notification_key text NOT NULL,
  read_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, notification_key)
);

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notification_reads"
  ON public.notification_reads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own notification_reads"
  ON public.notification_reads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notification_reads"
  ON public.notification_reads FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
