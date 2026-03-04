
-- Table to log task activity (date changes, completions)
CREATE TABLE public.task_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL, -- 'date_changed', 'completed', 'uncompleted'
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_activity_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read
CREATE POLICY "task_activity_log_admin_select" ON public.task_activity_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Authenticated users can insert (triggered by app logic)
CREATE POLICY "task_activity_log_insert_authenticated" ON public.task_activity_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger to auto-log date changes and completions
CREATE OR REPLACE FUNCTION public.log_task_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log date changes
  IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
    INSERT INTO public.task_activity_log (task_id, user_id, action, old_value, new_value)
    VALUES (NEW.id, COALESCE(auth.uid(), NEW.assigned_user_id), 'date_changed', OLD.due_date::text, NEW.due_date::text);
  END IF;

  -- Log completion
  IF NEW.status = 'concluido' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.task_activity_log (task_id, user_id, action, old_value, new_value)
    VALUES (NEW.id, COALESCE(auth.uid(), NEW.assigned_user_id), 'completed', OLD.status::text, NEW.completed_at::text);
  END IF;

  -- Log uncompletion
  IF OLD.status = 'concluido' AND NEW.status <> 'concluido' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.task_activity_log (task_id, user_id, action, old_value, new_value)
    VALUES (NEW.id, COALESCE(auth.uid(), NEW.assigned_user_id), 'uncompleted', OLD.status::text, NEW.status::text);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_task_activity
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.log_task_activity();
