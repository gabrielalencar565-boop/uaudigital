-- Backfill: task_appeals existe no projeto antigo (Lovable Cloud) mas nunca
-- teve uma migration de CREATE TABLE (criada via edição direta de schema).
-- Recriada aqui a partir do schema real do banco antigo, posicionada logo
-- antes de 20260620230146 (primeira migration que a referencia) e depois de
-- 20260131163423 (que adiciona 'planner' ao enum app_role, usado nas policies
-- abaixo).

CREATE TABLE public.task_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  user_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_appeals_task_id_key UNIQUE (task_id)
);

CREATE INDEX idx_task_appeals_task_id ON public.task_appeals (task_id);
CREATE INDEX idx_task_appeals_user_id ON public.task_appeals (user_id);
CREATE INDEX idx_task_appeals_status ON public.task_appeals (status);
CREATE UNIQUE INDEX task_appeals_task_user_uniq ON public.task_appeals (task_id, user_id);

ALTER TABLE public.task_appeals ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_appeals TO authenticated;
GRANT ALL ON public.task_appeals TO service_role;

CREATE POLICY "Admins delete appeals" ON public.task_appeals
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage appeals" ON public.task_appeals
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'planner'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'planner'::public.app_role));
CREATE POLICY "Users insert own appeals" ON public.task_appeals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own appeals" ON public.task_appeals
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'planner'::public.app_role));
