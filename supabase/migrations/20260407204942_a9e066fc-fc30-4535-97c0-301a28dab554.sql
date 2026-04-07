
-- Drop the incorrectly configured trigger
DROP TRIGGER IF EXISTS trg_log_task_activity ON public.tasks;

-- Recreate as AFTER UPDATE trigger (correct event)
CREATE TRIGGER trg_log_task_activity
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.log_task_activity();
