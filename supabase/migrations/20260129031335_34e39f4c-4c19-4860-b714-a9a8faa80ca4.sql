-- Permitir que qualquer usuário autenticado use o checklist mensal (ler/criar/atualizar)

-- client_cycles
ALTER TABLE public.client_cycles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='client_cycles' AND policyname='client_cycles_select_auth'
  ) THEN
    CREATE POLICY client_cycles_select_auth
    ON public.client_cycles
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='client_cycles' AND policyname='client_cycles_insert_auth'
  ) THEN
    CREATE POLICY client_cycles_insert_auth
    ON public.client_cycles
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='client_cycles' AND policyname='client_cycles_update_auth'
  ) THEN
    CREATE POLICY client_cycles_update_auth
    ON public.client_cycles
    FOR UPDATE
    TO authenticated
    USING (true);
  END IF;
END $$;

-- client_cycle_stages
ALTER TABLE public.client_cycle_stages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='client_cycle_stages' AND policyname='client_cycle_stages_select_auth'
  ) THEN
    CREATE POLICY client_cycle_stages_select_auth
    ON public.client_cycle_stages
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='client_cycle_stages' AND policyname='client_cycle_stages_insert_auth'
  ) THEN
    CREATE POLICY client_cycle_stages_insert_auth
    ON public.client_cycle_stages
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='client_cycle_stages' AND policyname='client_cycle_stages_update_auth'
  ) THEN
    CREATE POLICY client_cycle_stages_update_auth
    ON public.client_cycle_stages
    FOR UPDATE
    TO authenticated
    USING (true);
  END IF;
END $$;
