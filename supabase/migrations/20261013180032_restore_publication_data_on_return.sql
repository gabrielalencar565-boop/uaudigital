-- A deleted post must come back with its day, time, caption, cover and schedule, however it comes back:
--  1. through the trash: the publication is restored with the task (already worked); if an EMPTY publication for the
--     same post appeared in the meantime, that redundant one is removed (soft) so the post doesn't show up twice.
--  2. through the pipeline (the post is sent to the PDF stage again instead of being restored): the new task takes over
--     the old deleted publication, with everything it had, instead of starting an empty one.
-- Only publications that carry something (a day, a time, a caption, a cover or a schedule) are taken over or kept.

CREATE OR REPLACE FUNCTION public.pm_task_pdf_stage_to_calendar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bounds record;
  v_calendar_id uuid;
  v_root uuid;
  v_old uuid;
BEGIN
  IF NEW.stage_current IS DISTINCT FROM 'pdf' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.calendar_publications WHERE task_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- a container is represented by its subtasks, never by a publication of its own
  IF EXISTS (SELECT 1 FROM public.pm_tasks c WHERE c.parent_task_id = NEW.id AND c.deleted_at IS NULL) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(c.origin_task_id, c.id) INTO v_root
  FROM public.pm_tasks c WHERE c.id = COALESCE(NEW.parent_task_id, NEW.id);

  IF EXISTS (
    SELECT 1
    FROM public.calendar_publications cp
    JOIN public.pm_tasks ot ON ot.id = cp.task_id
    JOIN public.pm_tasks oc ON oc.id = COALESCE(ot.parent_task_id, ot.id)
    WHERE cp.deleted_at IS NULL
      AND ot.id <> NEW.id
      AND ot.deleted_at IS NULL
      AND ot.client_id IS NOT DISTINCT FROM NEW.client_id
      AND ot.title = NEW.title
      AND COALESCE(oc.origin_task_id, oc.id) = v_root
  ) THEN
    RETURN NEW;
  END IF;

  -- the same post was deleted along with its task and is coming back through the pipeline: take its publication back
  SELECT cp.id INTO v_old
  FROM public.calendar_publications cp
  JOIN public.pm_tasks ot ON ot.id = cp.task_id
  JOIN public.pm_tasks oc ON oc.id = COALESCE(ot.parent_task_id, ot.id)
  WHERE cp.deleted_at IS NOT NULL
    AND ot.id <> NEW.id
    AND ot.deleted_at IS NOT NULL
    AND ot.client_id IS NOT DISTINCT FROM NEW.client_id
    AND ot.title = NEW.title
    AND COALESCE(oc.origin_task_id, oc.id) = v_root
    AND (cp.publish_date IS NOT NULL OR cp.publish_time IS NOT NULL OR COALESCE(cp.caption, '') <> ''
         OR cp.cover_attachment_id IS NOT NULL OR cp.instagram_scheduled IS TRUE)
  ORDER BY cp.deleted_at DESC, cp.updated_at DESC
  LIMIT 1;

  IF v_old IS NOT NULL THEN
    UPDATE public.calendar_publications SET task_id = NEW.id, deleted_at = NULL WHERE id = v_old;
    RETURN NEW;
  END IF;

  SELECT * INTO v_bounds FROM public.calendar_cycle_bounds(COALESCE(NEW.posting_date, CURRENT_DATE));

  INSERT INTO public.publication_calendars (client_id, cycle_start, cycle_end)
  VALUES (NEW.client_id, v_bounds.cycle_start, v_bounds.cycle_end)
  ON CONFLICT (client_id, cycle_start) DO UPDATE SET client_id = EXCLUDED.client_id
  RETURNING id INTO v_calendar_id;

  INSERT INTO public.calendar_publications (
    calendar_id, task_id, title, content_type, caption, publish_date, publish_time
  ) VALUES (
    v_calendar_id, NEW.id, NEW.title, public.pm_resolve_content_type(NEW.tags, NEW.post_type), NEW.caption, NEW.posting_date, NULLIF(NEW.posting_time, '')::time
  )
  ON CONFLICT (task_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

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

    -- the post is back with what it had: an empty publication that showed up for the same post meanwhile is redundant
    IF EXISTS (
      SELECT 1 FROM public.calendar_publications r
      WHERE r.task_id = new.id AND r.deleted_at IS NULL
        AND (r.publish_date IS NOT NULL OR r.publish_time IS NOT NULL OR COALESCE(r.caption, '') <> ''
             OR r.cover_attachment_id IS NOT NULL OR r.instagram_scheduled IS TRUE)
    ) THEN
      SELECT COALESCE(c.origin_task_id, c.id) INTO v_root
      FROM public.pm_tasks c WHERE c.id = COALESCE(new.parent_task_id, new.id);

      UPDATE public.calendar_publications x SET deleted_at = now()
      FROM public.pm_tasks t
      JOIN public.pm_tasks tc ON tc.id = COALESCE(t.parent_task_id, t.id)
      WHERE x.task_id = t.id
        AND x.deleted_at IS NULL
        AND t.id <> new.id
        AND t.deleted_at IS NULL
        AND t.client_id IS NOT DISTINCT FROM new.client_id
        AND t.title = new.title
        AND COALESCE(tc.origin_task_id, tc.id) = v_root
        AND x.publish_date IS NULL AND x.publish_time IS NULL AND COALESCE(x.caption, '') = ''
        AND x.cover_attachment_id IS NULL AND x.instagram_scheduled IS NOT TRUE
        AND x.instagram_status = 'not_published';
    END IF;
  END IF;
  RETURN new;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.pm_task_pdf_stage_to_calendar() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pm_task_soft_delete_cleanup_calendar() FROM public, anon, authenticated;
