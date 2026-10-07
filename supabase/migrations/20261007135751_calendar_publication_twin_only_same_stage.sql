-- Follow-up to 20261007135638: the twin that inherits a deleted task's publication must be the same post in the PDF stage.
-- The same post one stage earlier (Planejamento, Vídeo, Revisão) shares title and lineage but has no publication by design.
CREATE OR REPLACE FUNCTION public.pm_task_soft_delete_cleanup_calendar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_root uuid;
  v_twin uuid;
BEGIN
  IF new.deleted_at IS NOT NULL AND old.deleted_at IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.calendar_publications WHERE task_id = new.id AND deleted_at IS NULL) THEN
      SELECT COALESCE(c.origin_task_id, c.id) INTO v_root
      FROM public.pm_tasks c WHERE c.id = COALESCE(new.parent_task_id, new.id);

      -- the twin is the same post in the same stage (the same post one stage earlier has no publication, by design)
      SELECT t.id INTO v_twin
      FROM public.pm_tasks t
      JOIN public.pm_tasks tc ON tc.id = COALESCE(t.parent_task_id, t.id)
      WHERE t.id <> new.id
        AND t.deleted_at IS NULL
        AND tc.deleted_at IS NULL
        AND t.stage_current = 'pdf'
        AND t.client_id IS NOT DISTINCT FROM new.client_id
        AND t.title = new.title
        AND COALESCE(tc.origin_task_id, tc.id) = v_root
        AND NOT EXISTS (SELECT 1 FROM public.calendar_publications x WHERE x.task_id = t.id)
      LIMIT 1;

      IF v_twin IS NOT NULL THEN
        UPDATE public.calendar_publications SET task_id = v_twin WHERE task_id = new.id AND deleted_at IS NULL;
        RETURN new;
      END IF;
    END IF;
    UPDATE public.calendar_publications SET deleted_at = now() WHERE task_id = new.id AND deleted_at IS NULL;
  ELSIF new.deleted_at IS NULL AND old.deleted_at IS NOT NULL THEN
    UPDATE public.calendar_publications SET deleted_at = NULL WHERE task_id = new.id AND deleted_at IS NOT NULL;
  END IF;
  RETURN new;
END;
$function$;
