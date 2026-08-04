-- 1) Container tasks (tasks that have their own subtasks) should not become a
--    publication themselves — each subtask reaching "pdf" already creates its
--    own row independently, so the parent's row was pure noise in "Publicações
--    sem data".
-- 2) Infer content_type from the task's tags (Carrossel/Post/Stories/Vídeo/...)
--    before falling back to post_type, so it's already correct when a task
--    reaches "pdf" instead of always landing on "Outro".
CREATE OR REPLACE FUNCTION public.pm_task_pdf_stage_to_calendar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ref date;
  v_bounds record;
  v_calendar_id uuid;
  v_content_type public.publication_content_type;
  v_publish_time time;
  v_tag_name text;
  v_tag_content_type public.publication_content_type;
BEGIN
  IF NEW.stage_current IS DISTINCT FROM 'pdf' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.stage_current = 'pdf' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.calendar_publications WHERE task_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_ref := COALESCE(NEW.posting_date, NEW.due_date, CURRENT_DATE);
  SELECT * INTO v_bounds FROM public.calendar_cycle_bounds(v_ref);

  INSERT INTO public.publication_calendars (client_id, cycle_start, cycle_end)
  VALUES (NEW.client_id, v_bounds.cycle_start, v_bounds.cycle_end)
  ON CONFLICT (client_id, cycle_start) DO UPDATE SET client_id = EXCLUDED.client_id
  RETURNING id INTO v_calendar_id;

  IF EXISTS (SELECT 1 FROM public.pm_tasks child WHERE child.parent_task_id = NEW.id AND child.deleted_at IS NULL) THEN
    RETURN NEW;
  END IF;

  v_tag_content_type := NULL;
  FOR v_tag_name IN SELECT split_part(unnest(NEW.tags), ':', 1) LOOP
    v_tag_content_type := CASE lower(v_tag_name)
      WHEN 'carrossel' THEN 'carrossel'::public.publication_content_type
      WHEN 'post' THEN 'imagem'::public.publication_content_type
      WHEN 'capa' THEN 'imagem'::public.publication_content_type
      WHEN 'stories' THEN 'story'::public.publication_content_type
      WHEN 'story' THEN 'story'::public.publication_content_type
      WHEN 'vídeo curto' THEN 'reel'::public.publication_content_type
      WHEN 'video curto' THEN 'reel'::public.publication_content_type
      WHEN 'reels' THEN 'reel'::public.publication_content_type
      WHEN 'reel' THEN 'reel'::public.publication_content_type
      WHEN 'vídeo' THEN 'video'::public.publication_content_type
      WHEN 'video' THEN 'video'::public.publication_content_type
      ELSE v_tag_content_type
    END;
    EXIT WHEN v_tag_content_type IS NOT NULL;
  END LOOP;

  IF v_tag_content_type IS NOT NULL THEN
    v_content_type := v_tag_content_type;
  ELSE
    v_content_type := CASE NEW.post_type
      WHEN 'reels' THEN 'reel'::public.publication_content_type
      WHEN 'carrossel' THEN 'carrossel'::public.publication_content_type
      WHEN 'post' THEN 'imagem'::public.publication_content_type
      WHEN 'foto' THEN 'imagem'::public.publication_content_type
      ELSE 'outro'::public.publication_content_type
    END;
  END IF;

  BEGIN
    v_publish_time := NEW.posting_time::time;
  EXCEPTION WHEN OTHERS THEN
    v_publish_time := NULL;
  END;

  INSERT INTO public.calendar_publications (
    calendar_id, task_id, title, content_type, caption, publish_date, publish_time
  ) VALUES (
    v_calendar_id, NEW.id, NEW.title, v_content_type, NEW.caption, NEW.posting_date, v_publish_time
  )
  ON CONFLICT (task_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.pm_task_pdf_stage_to_calendar() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pm_task_pdf_stage_to_calendar() FROM anon;
REVOKE EXECUTE ON FUNCTION public.pm_task_pdf_stage_to_calendar() FROM authenticated;

-- Data fix: remove already-created publications for tasks that turned out to
-- be containers (have subtasks) — same rule as the trigger now enforces.
DELETE FROM public.calendar_publications cp
WHERE EXISTS (
  SELECT 1 FROM public.pm_tasks child
  WHERE child.parent_task_id = cp.task_id AND child.deleted_at IS NULL
);

-- Data fix: re-run the tag-based content_type inference for existing rows
-- that landed on the "outro" fallback, so already-created publications pick
-- up the correct type retroactively instead of only new ones going forward.
DO $$
DECLARE
  r record;
  v_tag text;
  v_ct public.publication_content_type;
BEGIN
  FOR r IN
    SELECT cp.id, t.tags
    FROM public.calendar_publications cp
    JOIN public.pm_tasks t ON t.id = cp.task_id
    WHERE cp.content_type = 'outro'
  LOOP
    v_ct := NULL;
    FOR v_tag IN SELECT split_part(unnest(r.tags), ':', 1) LOOP
      v_ct := CASE lower(v_tag)
        WHEN 'carrossel' THEN 'carrossel'::public.publication_content_type
        WHEN 'post' THEN 'imagem'::public.publication_content_type
        WHEN 'capa' THEN 'imagem'::public.publication_content_type
        WHEN 'stories' THEN 'story'::public.publication_content_type
        WHEN 'story' THEN 'story'::public.publication_content_type
        WHEN 'vídeo curto' THEN 'reel'::public.publication_content_type
        WHEN 'video curto' THEN 'reel'::public.publication_content_type
        WHEN 'reels' THEN 'reel'::public.publication_content_type
        WHEN 'reel' THEN 'reel'::public.publication_content_type
        WHEN 'vídeo' THEN 'video'::public.publication_content_type
        WHEN 'video' THEN 'video'::public.publication_content_type
        ELSE v_ct
      END;
      EXIT WHEN v_ct IS NOT NULL;
    END LOOP;
    IF v_ct IS NOT NULL THEN
      UPDATE public.calendar_publications SET content_type = v_ct WHERE id = r.id;
    END IF;
  END LOOP;
END $$;
