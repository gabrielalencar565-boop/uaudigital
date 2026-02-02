-- Fix Magic Number checklist permissions: allow any authenticated user to read/update cycle stages
-- while keeping admin full access.

-- client_cycle_stages
DROP POLICY IF EXISTS "Assignees can update their cycle stage completion" ON public.client_cycle_stages;
DROP POLICY IF EXISTS "client_cycle_stages_select_auth" ON public.client_cycle_stages;
DROP POLICY IF EXISTS "Client cycle stages readable by authenticated" ON public.client_cycle_stages;
DROP POLICY IF EXISTS "client_cycle_stages_update_auth" ON public.client_cycle_stages;
DROP POLICY IF EXISTS "client_cycle_stages_insert_auth" ON public.client_cycle_stages;

-- Read: authenticated only
CREATE POLICY "client_cycle_stages_select_authenticated"
ON public.client_cycle_stages
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Insert: authenticated only + basic validity checks (keep existing safeguards)
CREATE POLICY "client_cycle_stages_insert_authenticated"
ON public.client_cycle_stages
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    stage = ANY (
      ARRAY[
        'captacao'::stage_type,
        'edicao_videos'::stage_type,
        'planejamento'::stage_type,
        'design'::stage_type,
        'revisao'::stage_type,
        'pdf'::stage_type,
        'entrega'::stage_type,
        'alteracoes'::stage_type,
        'agendamento'::stage_type
      ]
    )
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

-- Update: authenticated users can mark/unmark (manual confirmation allowed)
CREATE POLICY "client_cycle_stages_update_authenticated"
ON public.client_cycle_stages
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND (
    stage = ANY (
      ARRAY[
        'captacao'::stage_type,
        'edicao_videos'::stage_type,
        'planejamento'::stage_type,
        'design'::stage_type,
        'revisao'::stage_type,
        'pdf'::stage_type,
        'entrega'::stage_type,
        'alteracoes'::stage_type,
        'agendamento'::stage_type
      ]
    )
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
  auth.uid() IS NOT NULL
  AND (
    stage = ANY (
      ARRAY[
        'captacao'::stage_type,
        'edicao_videos'::stage_type,
        'planejamento'::stage_type,
        'design'::stage_type,
        'revisao'::stage_type,
        'pdf'::stage_type,
        'entrega'::stage_type,
        'alteracoes'::stage_type,
        'agendamento'::stage_type
      ]
    )
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

-- client_cycles: make sure cycles aren't publicly readable/writable
DROP POLICY IF EXISTS "client_cycles_select_auth" ON public.client_cycles;
DROP POLICY IF EXISTS "Client cycles readable by authenticated" ON public.client_cycles;
DROP POLICY IF EXISTS "client_cycles_insert_auth" ON public.client_cycles;
DROP POLICY IF EXISTS "client_cycles_update_auth" ON public.client_cycles;

CREATE POLICY "client_cycles_select_authenticated"
ON public.client_cycles
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "client_cycles_insert_authenticated"
ON public.client_cycles
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND month BETWEEN 1 AND 12
  AND year BETWEEN 2000 AND 2100
  AND due_date = make_date(year, month, 27)
);

CREATE POLICY "client_cycles_update_authenticated"
ON public.client_cycles
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND month BETWEEN 1 AND 12
  AND year BETWEEN 2000 AND 2100
  AND due_date = make_date(year, month, 27)
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND month BETWEEN 1 AND 12
  AND year BETWEEN 2000 AND 2100
  AND due_date = make_date(year, month, 27)
);
