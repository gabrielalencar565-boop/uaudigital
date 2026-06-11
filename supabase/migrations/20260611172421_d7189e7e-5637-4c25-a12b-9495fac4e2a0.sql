
-- Remove unrestricted anon access on sensitive tables.
-- Public flows (cronograma + health score) now go through edge functions using the service role.

DROP POLICY IF EXISTS clients_anon_select ON public.clients;
DROP POLICY IF EXISTS health_score_tokens_anon_select ON public.health_score_tokens;
DROP POLICY IF EXISTS health_score_tokens_anon_update ON public.health_score_tokens;
DROP POLICY IF EXISTS health_scores_anon_select ON public.health_scores;
DROP POLICY IF EXISTS health_scores_anon_insert ON public.health_scores;
DROP POLICY IF EXISTS pm_attachments_anon_select ON public.pm_attachments;
DROP POLICY IF EXISTS pm_tasks_anon_select ON public.pm_tasks;

-- Lock down pm_cronograma_feedback: anon writes now happen via edge function.
DROP POLICY IF EXISTS pm_cronograma_feedback_public_insert ON public.pm_cronograma_feedback;
DROP POLICY IF EXISTS pm_cronograma_feedback_public_read ON public.pm_cronograma_feedback;
DROP POLICY IF EXISTS pm_cronograma_feedback_public_update ON public.pm_cronograma_feedback;

CREATE POLICY pm_cronograma_feedback_auth_select
  ON public.pm_cronograma_feedback FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY pm_cronograma_feedback_auth_insert
  ON public.pm_cronograma_feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY pm_cronograma_feedback_auth_update
  ON public.pm_cronograma_feedback FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Revoke anon table grants left over from the dropped policies.
REVOKE ALL ON public.clients FROM anon;
REVOKE ALL ON public.health_score_tokens FROM anon;
REVOKE ALL ON public.health_scores FROM anon;
REVOKE ALL ON public.pm_attachments FROM anon;
REVOKE ALL ON public.pm_tasks FROM anon;
REVOKE ALL ON public.pm_cronograma_feedback FROM anon;
