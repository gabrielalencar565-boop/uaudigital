-- Magic Number mensal: ciclos (mês/ano) + etapas por ciclo

-- 1) Tabela de ciclos mensais por cliente
CREATE TABLE IF NOT EXISTS public.client_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  due_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_cycles_month_range CHECK (month BETWEEN 1 AND 12),
  CONSTRAINT client_cycles_unique UNIQUE (client_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_client_cycles_client ON public.client_cycles (client_id);
CREATE INDEX IF NOT EXISTS idx_client_cycles_year_month ON public.client_cycles (year, month);

-- 2) Etapas por ciclo
CREATE TABLE IF NOT EXISTS public.client_cycle_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES public.client_cycles(id) ON DELETE CASCADE,
  stage public.stage_type NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_cycle_stages_unique UNIQUE (cycle_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_client_cycle_stages_cycle ON public.client_cycle_stages (cycle_id);
CREATE INDEX IF NOT EXISTS idx_client_cycle_stages_stage ON public.client_cycle_stages (stage);

-- 3) Triggers updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_client_cycles_updated_at'
  ) THEN
    CREATE TRIGGER update_client_cycles_updated_at
    BEFORE UPDATE ON public.client_cycles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_client_cycle_stages_updated_at'
  ) THEN
    CREATE TRIGGER update_client_cycle_stages_updated_at
    BEFORE UPDATE ON public.client_cycle_stages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 4) RLS
ALTER TABLE public.client_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_cycle_stages ENABLE ROW LEVEL SECURITY;

-- client_cycles policies
DROP POLICY IF EXISTS "Client cycles readable by authenticated" ON public.client_cycles;
DROP POLICY IF EXISTS "Admins manage client cycles" ON public.client_cycles;

CREATE POLICY "Client cycles readable by authenticated"
ON public.client_cycles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins manage client cycles"
ON public.client_cycles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- client_cycle_stages policies
DROP POLICY IF EXISTS "Client cycle stages readable by authenticated" ON public.client_cycle_stages;
DROP POLICY IF EXISTS "Admins manage client cycle stages" ON public.client_cycle_stages;
DROP POLICY IF EXISTS "Assignees can update their cycle stage completion" ON public.client_cycle_stages;

CREATE POLICY "Client cycle stages readable by authenticated"
ON public.client_cycle_stages
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins manage client cycle stages"
ON public.client_cycle_stages
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Assignees can update: must have a task for the same client+stage in that cycle's month
CREATE POLICY "Assignees can update their cycle stage completion"
ON public.client_cycle_stages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.client_cycles cc
    JOIN public.tasks t
      ON t.client_id = cc.client_id
     AND t.stage = client_cycle_stages.stage
     AND date_trunc('month', t.due_date::timestamp) = make_date(cc.year, cc.month, 1)::timestamp
    WHERE cc.id = client_cycle_stages.cycle_id
      AND t.assigned_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.client_cycles cc
    JOIN public.tasks t
      ON t.client_id = cc.client_id
     AND t.stage = client_cycle_stages.stage
     AND date_trunc('month', t.due_date::timestamp) = make_date(cc.year, cc.month, 1)::timestamp
    WHERE cc.id = client_cycle_stages.cycle_id
      AND t.assigned_user_id = auth.uid()
  )
);
