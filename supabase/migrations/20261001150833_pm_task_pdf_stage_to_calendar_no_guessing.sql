-- Stop auto-filing a PDF-stage task into a "guessed" month. The trigger used to fall
-- back to NEW.due_date (just the current stage's SLA deadline, unrelated to the
-- content's intended month) and then CURRENT_DATE, which is how content meant for one
-- month routinely ended up filed under the next. Now it only ever uses NEW.posting_date,
-- which is set exclusively by an explicit human action (SendToCronogramaButton's "Escolha
-- o mês", or QuickAddPublicationDialog) — if it's null, the task simply stays unscheduled
-- (no calendar_publications row), which is exactly what useUnscheduledClientTasks already
-- surfaces as the cross-month "sem mês definido" list.
CREATE OR REPLACE FUNCTION public.pm_task_pdf_stage_to_calendar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bounds record;
  v_calendar_id uuid;
  v_content_type public.publication_content_type;
BEGIN
  IF NEW.stage_current IS DISTINCT FROM 'pdf' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.stage_current = 'pdf' THEN
    RETURN NEW; -- already handled when it first entered 'pdf'
  END IF;
  IF NEW.posting_date IS NULL THEN
    RETURN NEW; -- no explicit month chosen yet — stays unscheduled
  END IF;
  IF EXISTS (SELECT 1 FROM public.calendar_publications WHERE task_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_bounds FROM public.calendar_cycle_bounds(NEW.posting_date);

  INSERT INTO public.publication_calendars (client_id, cycle_start, cycle_end)
  VALUES (NEW.client_id, v_bounds.cycle_start, v_bounds.cycle_end)
  ON CONFLICT (client_id, cycle_start) DO UPDATE SET client_id = EXCLUDED.client_id
  RETURNING id INTO v_calendar_id;

  v_content_type := CASE NEW.post_type
    WHEN 'reels' THEN 'reel'::public.publication_content_type
    WHEN 'carrossel' THEN 'carrossel'::public.publication_content_type
    WHEN 'post' THEN 'imagem'::public.publication_content_type
    WHEN 'foto' THEN 'imagem'::public.publication_content_type
    ELSE 'outro'::public.publication_content_type
  END;

  INSERT INTO public.calendar_publications (
    calendar_id, task_id, title, content_type, caption, publish_date, publish_time
  ) VALUES (
    v_calendar_id, NEW.id, NEW.title, v_content_type, NEW.caption, NEW.posting_date, NEW.posting_time
  )
  ON CONFLICT (task_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
