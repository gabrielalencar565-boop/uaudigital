-- Backfill: estas 3 tabelas existem no projeto antigo (Lovable Cloud) mas nunca
-- tiveram uma migration de CREATE TABLE no histórico (foram criadas via edição
-- direta de schema fora do fluxo de migrations). Recriadas aqui, na posição
-- cronológica correta, a partir do schema real inspecionado no banco antigo,
-- para que as migrations seguintes que já assumem sua existência funcionem.

-- ============================================================
-- access_requests
-- ============================================================
CREATE TYPE public.access_request_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status public.access_request_status NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid,
  note text
);

CREATE UNIQUE INDEX access_requests_user_id_key ON public.access_requests (user_id);
CREATE INDEX access_requests_status_idx ON public.access_requests (status);

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_requests TO authenticated;
GRANT ALL ON public.access_requests TO service_role;

CREATE POLICY "Admins can read all access requests" ON public.access_requests
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update access requests" ON public.access_requests
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Users can request access" ON public.access_requests
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);
CREATE POLICY "Users can view own access request" ON public.access_requests
  FOR SELECT USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Nota: task_appeals foi movida para uma migration separada
-- (20260620230145_backfill_task_appeals.sql) porque suas policies usam o
-- valor 'planner' do enum app_role, que só é adicionado em 20260131163423 —
-- posterior a esta migration.

-- ============================================================
-- financial_opening_balances
-- ============================================================
CREATE TABLE public.financial_opening_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_opening_balances_year_month_key UNIQUE (year, month)
);

ALTER TABLE public.financial_opening_balances ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_opening_balances TO authenticated;
GRANT ALL ON public.financial_opening_balances TO service_role;

CREATE POLICY "fin_opening_balance_admin_all" ON public.financial_opening_balances
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
