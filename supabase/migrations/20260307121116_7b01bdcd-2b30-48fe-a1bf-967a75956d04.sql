
-- Add order_index to pm_attachments for reordering
ALTER TABLE public.pm_attachments ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0;

-- Create feedback table for cronograma approval flow
CREATE TABLE IF NOT EXISTS public.pm_cronograma_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  feedback_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_cronograma_feedback ENABLE ROW LEVEL SECURITY;

-- Public access (no auth needed - for client approval via shared link)
CREATE POLICY "pm_cronograma_feedback_public_read" ON public.pm_cronograma_feedback
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "pm_cronograma_feedback_public_insert" ON public.pm_cronograma_feedback
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "pm_cronograma_feedback_public_update" ON public.pm_cronograma_feedback
  FOR UPDATE TO anon, authenticated USING (true);

-- Add update policy for pm_attachments order_index
CREATE POLICY "pm_attachments_update_auth" ON public.pm_attachments
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
