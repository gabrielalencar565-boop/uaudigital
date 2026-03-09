-- Table to store evaluation tokens for public client access
CREATE TABLE public.health_score_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL CHECK (year >= 2000 AND year <= 2100),
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (client_id, month, year)
);

-- Enable RLS
ALTER TABLE public.health_score_tokens ENABLE ROW LEVEL SECURITY;

-- Admin can manage all tokens
CREATE POLICY "health_score_tokens_admin_all" ON public.health_score_tokens
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can view and create tokens
CREATE POLICY "health_score_tokens_auth_select" ON public.health_score_tokens
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "health_score_tokens_auth_insert" ON public.health_score_tokens
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Anonymous users can select by token (for public page validation)
CREATE POLICY "health_score_tokens_anon_select" ON public.health_score_tokens
  FOR SELECT TO anon
  USING (true);

-- Allow anonymous to update used_at when submitting
CREATE POLICY "health_score_tokens_anon_update" ON public.health_score_tokens
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anonymous INSERT on health_scores for public submissions
CREATE POLICY "health_scores_anon_insert" ON public.health_scores
  FOR INSERT TO anon
  WITH CHECK (true);

-- Allow anonymous SELECT on health_scores to check if already submitted
CREATE POLICY "health_scores_anon_select" ON public.health_scores
  FOR SELECT TO anon
  USING (true);