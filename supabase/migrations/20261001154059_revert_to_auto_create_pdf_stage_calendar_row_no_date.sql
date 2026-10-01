-- Reworked per explicit feedback: no more "escolha o mês" step at all. A task reaching the
-- PDF stage ALWAYS gets its calendar_publications row immediately (restoring the original
-- unconditional creation), but with publish_date left NULL unless a human already gave it an
-- explicit date (e.g. via QuickAddPublicationDialog, which seeds posting_date for a specific
-- day on purpose). It shows up as "sem data" — now a cross-cycle concept, see
-- useUnscheduledPublicationsForClient on the frontend — until someone drags it onto a day or
-- picks a date in PublicationPreviewPanel. calendar_id still has to point at *some* cycle
-- (NOT NULL FK) even with no date yet; today's cycle is just a holding spot — it stops
-- mattering once a real date (and its correct calendar_id, via ensure_publication_calendar)
-- gets set later.
CREATE OR REPLACE FUNCTION public.pm_task_pdf_stage_to_calendar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bounds record;
  v_calendar_id uuid;
BEGIN
  IF NEW.stage_current IS DISTINCT FROM 'pdf' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.calendar_publications WHERE task_id = NEW.id) THEN
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

-- Lets the frontend assign a real date to a "sem data" publication (which may currently be
-- filed under a different/arbitrary cycle's calendar_id as just a holding spot) without
-- duplicating the cycle-bounds-and-upsert logic client-side, and without it drifting from the
-- trigger above's own math. Mirrors that trigger's calendar upsert exactly.
CREATE OR REPLACE FUNCTION public.ensure_publication_calendar(p_client_id uuid, p_date date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bounds record;
  v_calendar_id uuid;
BEGIN
  SELECT * INTO v_bounds FROM public.calendar_cycle_bounds(p_date);

  INSERT INTO public.publication_calendars (client_id, cycle_start, cycle_end)
  VALUES (p_client_id, v_bounds.cycle_start, v_bounds.cycle_end)
  ON CONFLICT (client_id, cycle_start) DO UPDATE SET client_id = EXCLUDED.client_id
  RETURNING id INTO v_calendar_id;

  RETURN v_calendar_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_publication_calendar(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_publication_calendar(uuid, date) TO authenticated;
