-- Magic Number v2 (tabelas novas)

-- Enum só com as 7 etapas do Magic Number (sem Revisão/Entrega)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'magic2_stage_type') THEN
    CREATE TYPE public.magic2_stage_type AS ENUM (
      'captacao',
      'edicao_videos',
      'planejamento',
      'design',
      'pdf',
      'alteracoes',
      'agendamento'
    );
  END IF;
END $$;

-- Função padrão de updated_at (caso ainda não exista)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Clientes do Magic v2 (independente do resto do app)
CREATE TABLE IF NOT EXISTS public.magic2_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Participação mensal (preserva histórico; um cliente pode estar ativo/inativo por mês/ano)
CREATE TABLE IF NOT EXISTS public.magic2_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.magic2_clients(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  due_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, year, month)
);

-- Checklist por ciclo x etapa
CREATE TABLE IF NOT EXISTS public.magic2_cycle_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES public.magic2_cycles(id) ON DELETE CASCADE,
  stage public.magic2_stage_type NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, stage)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_magic2_cycles_year_month ON public.magic2_cycles(year, month);
CREATE INDEX IF NOT EXISTS idx_magic2_cycles_client_id ON public.magic2_cycles(client_id);
CREATE INDEX IF NOT EXISTS idx_magic2_cycle_stages_cycle_id ON public.magic2_cycle_stages(cycle_id);

-- Triggers updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_magic2_clients_updated_at'
  ) THEN
    CREATE TRIGGER trg_magic2_clients_updated_at
    BEFORE UPDATE ON public.magic2_clients
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_magic2_cycles_updated_at'
  ) THEN
    CREATE TRIGGER trg_magic2_cycles_updated_at
    BEFORE UPDATE ON public.magic2_cycles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_magic2_cycle_stages_updated_at'
  ) THEN
    CREATE TRIGGER trg_magic2_cycle_stages_updated_at
    BEFORE UPDATE ON public.magic2_cycle_stages
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- RLS
ALTER TABLE public.magic2_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.magic2_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.magic2_cycle_stages ENABLE ROW LEVEL SECURITY;

-- Leitura para qualquer autenticado
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='magic2_clients' AND policyname='magic2_clients_select_authenticated') THEN
    CREATE POLICY magic2_clients_select_authenticated
    ON public.magic2_clients
    FOR SELECT
    USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='magic2_cycles' AND policyname='magic2_cycles_select_authenticated') THEN
    CREATE POLICY magic2_cycles_select_authenticated
    ON public.magic2_cycles
    FOR SELECT
    USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='magic2_cycle_stages' AND policyname='magic2_cycle_stages_select_authenticated') THEN
    CREATE POLICY magic2_cycle_stages_select_authenticated
    ON public.magic2_cycle_stages
    FOR SELECT
    USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Escrita: qualquer autenticado pode inserir/atualizar (marcar/desmarcar)
-- Regras de sanidade: mês 1-12, ano 2000-2100, due_date = dia 27 do mês
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='magic2_clients' AND policyname='magic2_clients_write_authenticated') THEN
    CREATE POLICY magic2_clients_write_authenticated
    ON public.magic2_clients
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

    CREATE POLICY magic2_clients_update_authenticated
    ON public.magic2_clients
    FOR UPDATE
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='magic2_cycles' AND policyname='magic2_cycles_insert_authenticated') THEN
    CREATE POLICY magic2_cycles_insert_authenticated
    ON public.magic2_cycles
    FOR INSERT
    WITH CHECK (
      auth.uid() IS NOT NULL
      AND month BETWEEN 1 AND 12
      AND year BETWEEN 2000 AND 2100
      AND due_date = make_date(year, month, 27)
    );

    CREATE POLICY magic2_cycles_update_authenticated
    ON public.magic2_cycles
    FOR UPDATE
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (
      auth.uid() IS NOT NULL
      AND month BETWEEN 1 AND 12
      AND year BETWEEN 2000 AND 2100
      AND due_date = make_date(year, month, 27)
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='magic2_cycle_stages' AND policyname='magic2_cycle_stages_insert_authenticated') THEN
    CREATE POLICY magic2_cycle_stages_insert_authenticated
    ON public.magic2_cycle_stages
    FOR INSERT
    WITH CHECK (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.magic2_cycles c
        WHERE c.id = magic2_cycle_stages.cycle_id
          AND c.due_date = make_date(c.year, c.month, 27)
          AND c.month BETWEEN 1 AND 12
          AND c.year BETWEEN 2000 AND 2100
      )
    );

    CREATE POLICY magic2_cycle_stages_update_authenticated
    ON public.magic2_cycle_stages
    FOR UPDATE
    USING (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.magic2_cycles c
        WHERE c.id = magic2_cycle_stages.cycle_id
          AND c.due_date = make_date(c.year, c.month, 27)
          AND c.month BETWEEN 1 AND 12
          AND c.year BETWEEN 2000 AND 2100
      )
    )
    WITH CHECK (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.magic2_cycles c
        WHERE c.id = magic2_cycle_stages.cycle_id
          AND c.due_date = make_date(c.year, c.month, 27)
          AND c.month BETWEEN 1 AND 12
          AND c.year BETWEEN 2000 AND 2100
      )
    );
  END IF;
END $$;

-- Admin pode tudo (se já existir função has_role)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='magic2_clients' AND policyname='magic2_clients_admin_all') THEN
      CREATE POLICY magic2_clients_admin_all ON public.magic2_clients FOR ALL
      USING (has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='magic2_cycles' AND policyname='magic2_cycles_admin_all') THEN
      CREATE POLICY magic2_cycles_admin_all ON public.magic2_cycles FOR ALL
      USING (has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='magic2_cycle_stages' AND policyname='magic2_cycle_stages_admin_all') THEN
      CREATE POLICY magic2_cycle_stages_admin_all ON public.magic2_cycle_stages FOR ALL
      USING (has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
    END IF;
  END IF;
END $$;
