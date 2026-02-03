-- Remove a política restritiva atual
DROP POLICY IF EXISTS "Assignees can update their tasks" ON public.tasks;

-- Cria nova política que permite qualquer usuário autenticado atualizar tarefas
CREATE POLICY "Authenticated users can update tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (true);