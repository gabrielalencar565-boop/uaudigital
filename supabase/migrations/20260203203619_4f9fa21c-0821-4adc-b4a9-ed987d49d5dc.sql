-- Remove a política antiga que não considera membros adicionais
DROP POLICY IF EXISTS "Assignees can update their tasks" ON public.tasks;

-- Cria nova política que permite atualização por assignee principal OU membros adicionais
CREATE POLICY "Assignees can update their tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  assigned_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.task_assignees ta
    WHERE ta.task_id = tasks.id
    AND ta.user_id = auth.uid()
  )
);