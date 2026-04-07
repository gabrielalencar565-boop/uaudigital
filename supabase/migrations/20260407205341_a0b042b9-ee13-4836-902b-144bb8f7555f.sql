
-- Create trigger function for pm_tasks activity logging
CREATE OR REPLACE FUNCTION public.log_pm_task_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log due_date changes
  IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
    INSERT INTO public.task_activity_log (task_id, user_id, action, old_value, new_value)
    VALUES (NEW.id, COALESCE(auth.uid(), NEW.assignee_id, NEW.created_by), 'date_changed',
            COALESCE(OLD.due_date::text, '—'), COALESCE(NEW.due_date::text, '—'));
  END IF;

  -- Log completion (stage moved to entrega or agendamento = done)
  IF NEW.status_global = 'concluido' AND OLD.status_global IS DISTINCT FROM NEW.status_global THEN
    INSERT INTO public.task_activity_log (task_id, user_id, action, old_value, new_value)
    VALUES (NEW.id, COALESCE(auth.uid(), NEW.assignee_id, NEW.created_by), 'completed',
            OLD.status_global::text, now()::text);
  END IF;

  -- Log uncompletion
  IF OLD.status_global = 'concluido' AND NEW.status_global <> 'concluido' AND OLD.status_global IS DISTINCT FROM NEW.status_global THEN
    INSERT INTO public.task_activity_log (task_id, user_id, action, old_value, new_value)
    VALUES (NEW.id, COALESCE(auth.uid(), NEW.assignee_id, NEW.created_by), 'uncompleted',
            OLD.status_global::text, NEW.status_global::text);
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on pm_tasks
CREATE TRIGGER trg_log_pm_task_activity
  AFTER UPDATE ON public.pm_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.log_pm_task_activity();
