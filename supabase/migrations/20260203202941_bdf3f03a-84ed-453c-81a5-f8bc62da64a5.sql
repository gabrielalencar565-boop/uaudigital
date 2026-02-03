-- Permitir que PLANNER também possa deletar tarefas (soft delete)
CREATE POLICY "Planner can delete tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'planner'::app_role));