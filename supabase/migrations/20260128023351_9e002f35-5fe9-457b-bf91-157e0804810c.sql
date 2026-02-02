-- Remove stage 'edicao_fotos' definitively (schema + data)

-- 1) Delete data that uses the stage
DELETE FROM public.tasks WHERE stage = 'edicao_fotos';
DELETE FROM public.client_stages WHERE stage = 'edicao_fotos';

-- 2) Drop policies that depend on stage columns (required to alter enum types)
DROP POLICY IF EXISTS "Assignees can update their stage completion" ON public.client_stages;

DROP POLICY IF EXISTS "Admins can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins can delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins can update/delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "Assignees can update their tasks" ON public.tasks;
DROP POLICY IF EXISTS "Tasks readable by authenticated" ON public.tasks;

-- 3) Replace enum type to remove the value
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'stage_type_new'
  ) THEN
    EXECUTE 'CREATE TYPE public.stage_type_new AS ENUM (
      ''captacao'',
      ''edicao_videos'',
      ''planejamento'',
      ''design'',
      ''revisao'',
      ''pdf'',
      ''entrega'',
      ''alteracoes'',
      ''agendamento''
    )';
  END IF;

  EXECUTE 'ALTER TABLE public.client_stages
           ALTER COLUMN stage TYPE public.stage_type_new
           USING stage::text::public.stage_type_new';

  EXECUTE 'ALTER TABLE public.tasks
           ALTER COLUMN stage TYPE public.stage_type_new
           USING stage::text::public.stage_type_new';

  EXECUTE 'ALTER TYPE public.stage_type RENAME TO stage_type_old';
  EXECUTE 'ALTER TYPE public.stage_type_new RENAME TO stage_type';
  EXECUTE 'DROP TYPE public.stage_type_old';
END $do$;

-- 4) Recreate policies
CREATE POLICY "Assignees can update their stage completion"
ON public.client_stages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.client_id = client_stages.client_id
      AND t.stage = client_stages.stage
      AND t.assigned_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.client_id = client_stages.client_id
      AND t.stage = client_stages.stage
      AND t.assigned_user_id = auth.uid()
  )
);

CREATE POLICY "Tasks readable by authenticated"
ON public.tasks
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Assignees can update their tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (assigned_user_id = auth.uid());

CREATE POLICY "Admins can update/delete tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create tasks"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND created_by = auth.uid());
