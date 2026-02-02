-- Trocar políticas permissivas (true) por regras explícitas (ainda permitindo qualquer autenticado marcar)

-- client_cycles
DO $$
BEGIN
  -- Drop antigas (se existirem)
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='client_cycles' AND policyname='client_cycles_insert_auth') THEN
    DROP POLICY client_cycles_insert_auth ON public.client_cycles;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='client_cycles' AND policyname='client_cycles_update_auth') THEN
    DROP POLICY client_cycles_update_auth ON public.client_cycles;
  END IF;

  -- Recria com checks explícitos
  CREATE POLICY client_cycles_insert_auth
  ON public.client_cycles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    month BETWEEN 1 AND 12
    AND year BETWEEN 2000 AND 2100
    AND due_date = make_date(year, month, 27)
  );

  CREATE POLICY client_cycles_update_auth
  ON public.client_cycles
  FOR UPDATE
  TO authenticated
  USING (
    month BETWEEN 1 AND 12
    AND year BETWEEN 2000 AND 2100
    AND due_date = make_date(year, month, 27)
  )
  WITH CHECK (
    month BETWEEN 1 AND 12
    AND year BETWEEN 2000 AND 2100
    AND due_date = make_date(year, month, 27)
  );
END $$;

-- client_cycle_stages
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='client_cycle_stages' AND policyname='client_cycle_stages_insert_auth') THEN
    DROP POLICY client_cycle_stages_insert_auth ON public.client_cycle_stages;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='client_cycle_stages' AND policyname='client_cycle_stages_update_auth') THEN
    DROP POLICY client_cycle_stages_update_auth ON public.client_cycle_stages;
  END IF;

  CREATE POLICY client_cycle_stages_insert_auth
  ON public.client_cycle_stages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    stage IN (
      'captacao','edicao_videos','planejamento','design','revisao','pdf','entrega','alteracoes','agendamento'
    )
    AND EXISTS (
      SELECT 1
      FROM public.client_cycles cc
      WHERE cc.id = client_cycle_stages.cycle_id
        AND cc.due_date = make_date(cc.year, cc.month, 27)
        AND cc.month BETWEEN 1 AND 12
        AND cc.year BETWEEN 2000 AND 2100
    )
  );

  CREATE POLICY client_cycle_stages_update_auth
  ON public.client_cycle_stages
  FOR UPDATE
  TO authenticated
  USING (
    stage IN (
      'captacao','edicao_videos','planejamento','design','revisao','pdf','entrega','alteracoes','agendamento'
    )
    AND EXISTS (
      SELECT 1
      FROM public.client_cycles cc
      WHERE cc.id = client_cycle_stages.cycle_id
        AND cc.due_date = make_date(cc.year, cc.month, 27)
        AND cc.month BETWEEN 1 AND 12
        AND cc.year BETWEEN 2000 AND 2100
    )
  )
  WITH CHECK (
    stage IN (
      'captacao','edicao_videos','planejamento','design','revisao','pdf','entrega','alteracoes','agendamento'
    )
    AND EXISTS (
      SELECT 1
      FROM public.client_cycles cc
      WHERE cc.id = client_cycle_stages.cycle_id
        AND cc.due_date = make_date(cc.year, cc.month, 27)
        AND cc.month BETWEEN 1 AND 12
        AND cc.year BETWEEN 2000 AND 2100
    )
  );
END $$;
