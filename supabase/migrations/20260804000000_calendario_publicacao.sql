-- Calendário de Publicação: calendários de aprovação por cliente/ciclo,
-- gerados automaticamente quando uma tarefa de planejamento chega à etapa
-- "pdf". Fase 1 (fundação + tela interna) — sem link público ainda.

CREATE TYPE public.calendar_status AS ENUM (
  'em_montagem',
  'em_revisao_interna',
  'pronto_para_envio',
  'enviado_ao_cliente',
  'alteracoes_solicitadas',
  'aprovado',
  'arquivado'
);

CREATE TYPE public.publication_status AS ENUM (
  'rascunho',
  'aguardando_aprovacao',
  'aprovada',
  'alteracao_solicitada',
  'atualizada',
  'cancelada'
);

CREATE TYPE public.publication_content_type AS ENUM (
  'imagem',
  'carrossel',
  'reel',
  'video',
  'story',
  'outro'
);

CREATE TABLE public.publication_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  cycle_start date NOT NULL,
  cycle_end date NOT NULL,
  status public.calendar_status NOT NULL DEFAULT 'em_montagem',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, cycle_start)
);

CREATE TABLE public.calendar_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id uuid NOT NULL REFERENCES public.publication_calendars(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  content_type public.publication_content_type NOT NULL DEFAULT 'outro',
  caption text,
  publish_date date,
  publish_time time,
  status public.publication_status NOT NULL DEFAULT 'rascunho',
  internal_note text,
  client_note text,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id)
);

CREATE INDEX calendar_publications_calendar_id_idx ON public.calendar_publications (calendar_id);
CREATE INDEX publication_calendars_client_id_idx ON public.publication_calendars (client_id);

ALTER TABLE public.publication_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_publications ENABLE ROW LEVEL SECURITY;

-- Same visibility/permission shape as pm_tasks: any authenticated user can
-- read and update, only admin/planner can create — fine-grained restriction
-- (e.g. hiding the screen from collaborators) happens in the UI, matching
-- how the rest of the PM module is already modeled.
CREATE POLICY "publication_calendars_select" ON public.publication_calendars
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "publication_calendars_admin_all" ON public.publication_calendars
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "publication_calendars_planner_insert" ON public.publication_calendars
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'planner'::public.app_role));
CREATE POLICY "publication_calendars_update_auth" ON public.publication_calendars
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "calendar_publications_select" ON public.calendar_publications
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "calendar_publications_admin_all" ON public.calendar_publications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "calendar_publications_planner_insert" ON public.calendar_publications
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'planner'::public.app_role));
CREATE POLICY "calendar_publications_update_auth" ON public.calendar_publications
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER publication_calendars_updated_at BEFORE UPDATE ON public.publication_calendars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER calendar_publications_updated_at BEFORE UPDATE ON public.calendar_publications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- A "ciclo" runs from the 28th of a month through the 27th of the next
-- (same rule already used by the Pauta view's ciclo selector).
CREATE OR REPLACE FUNCTION public.calendar_cycle_bounds(_ref date)
RETURNS TABLE (cycle_start date, cycle_end date)
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT
    CASE WHEN EXTRACT(DAY FROM _ref) >= 28
      THEN date_trunc('month', _ref)::date + INTERVAL '27 days'
      ELSE (date_trunc('month', _ref) - INTERVAL '1 month')::date + INTERVAL '27 days'
    END AS cycle_start,
    CASE WHEN EXTRACT(DAY FROM _ref) >= 28
      THEN (date_trunc('month', _ref) + INTERVAL '1 month')::date + INTERVAL '26 days'
      ELSE date_trunc('month', _ref)::date + INTERVAL '26 days'
    END AS cycle_end;
$function$;

-- Auto-creates (once) a calendar_publications row — and its parent
-- publication_calendars row, if needed — the first time a pm_tasks row
-- reaches stage_current = 'pdf'. Intentionally one-shot: after that, the
-- team edits the calendar item independently (Fase 1 scope; no continued
-- bidirectional sync yet).
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
BEGIN
  IF NEW.stage_current IS DISTINCT FROM 'pdf' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.stage_current = 'pdf' THEN
    RETURN NEW; -- already handled when it first entered 'pdf'
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

CREATE TRIGGER pm_tasks_pdf_stage_to_calendar
  AFTER INSERT OR UPDATE OF stage_current ON public.pm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.pm_task_pdf_stage_to_calendar();
