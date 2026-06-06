
-- Extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============ 1. xp_settings (singleton) ============
CREATE TABLE IF NOT EXISTS public.xp_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  rank_1_xp integer NOT NULL DEFAULT 100,
  rank_2_xp integer NOT NULL DEFAULT 70,
  squad_destaque_xp integer NOT NULL DEFAULT 60,
  video_destaque_xp integer NOT NULL DEFAULT 60,
  task_late_penalty integer NOT NULL DEFAULT -10,
  video_destaque_roles text[] NOT NULL DEFAULT ARRAY['Social Media','Designer','Editor de Vídeo']::text[],
  late_penalize_all_assignees boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.xp_settings TO authenticated;
GRANT ALL ON public.xp_settings TO service_role;
ALTER TABLE public.xp_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp_settings_read_auth" ON public.xp_settings FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "xp_settings_admin_write" ON public.xp_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
INSERT INTO public.xp_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- ============ 2. xp_monthly_processing ============
CREATE TABLE IF NOT EXISTS public.xp_monthly_processing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL,
  criterion text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  processed_by uuid,
  UNIQUE (year, month, criterion)
);
GRANT SELECT ON public.xp_monthly_processing TO authenticated;
GRANT ALL ON public.xp_monthly_processing TO service_role;
ALTER TABLE public.xp_monthly_processing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp_monthly_processing_read" ON public.xp_monthly_processing FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "xp_monthly_processing_admin" ON public.xp_monthly_processing FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

-- ============ 3. xp_task_penalties ============
CREATE TABLE IF NOT EXISTS public.xp_task_penalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pm_task_id uuid NOT NULL,
  user_id uuid NOT NULL,
  xp_deducted integer NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pm_task_id, user_id)
);
GRANT SELECT ON public.xp_task_penalties TO authenticated;
GRANT ALL ON public.xp_task_penalties TO service_role;
ALTER TABLE public.xp_task_penalties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp_task_penalties_read" ON public.xp_task_penalties FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "xp_task_penalties_admin" ON public.xp_task_penalties FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

-- ============ 4. xp_video_destaque ============
CREATE TABLE IF NOT EXISTS public.xp_video_destaque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL,
  pm_task_id uuid NOT NULL,
  selected_by uuid,
  selected_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, month)
);
GRANT SELECT ON public.xp_video_destaque TO authenticated;
GRANT ALL ON public.xp_video_destaque TO service_role;
ALTER TABLE public.xp_video_destaque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp_video_destaque_read" ON public.xp_video_destaque FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "xp_video_destaque_admin" ON public.xp_video_destaque FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

-- ============ FUNCTION: Apply monthly ranking ============
CREATE OR REPLACE FUNCTION public.xp_apply_monthly_rankings(_year integer, _month integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings record;
  v_first_user uuid;
  v_second_user uuid;
BEGIN
  SELECT * INTO v_settings FROM public.xp_settings WHERE id = true;

  -- Build ranking with tiebreakers
  WITH base AS (
    SELECT
      ps.user_id,
      (ps.aprendizado_continuo + ps.padrao_qualidade_uau + ps.metas_prazos + ps.ambiente_organizado + ps.comprometimento + ps.video_destaque + ps.squad_destaque) AS total,
      COALESCE((SELECT COUNT(*) FROM public.pm_tasks pt
        WHERE pt.assignee_id = ps.user_id AND pt.status_global = 'concluido'
          AND pt.deleted_at IS NULL
          AND date_trunc('month', pt.due_date::timestamp) = make_date(_year,_month,1)::timestamp
      ), 0) AS completed,
      COALESCE((SELECT COUNT(*) FROM public.pm_tasks pt
        WHERE pt.assignee_id = ps.user_id AND pt.deleted_at IS NULL
          AND date_trunc('month', pt.due_date::timestamp) = make_date(_year,_month,1)::timestamp
          AND ((pt.status_global = 'concluido' AND pt.updated_at::date > pt.due_date)
               OR (pt.status_global <> 'concluido' AND pt.due_date < CURRENT_DATE))
      ), 0) AS lates
    FROM public.performance_scores ps
    WHERE ps.year = _year AND ps.month = _month
  ),
  ranked AS (
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY total DESC, completed DESC, lates ASC) AS rk
    FROM base
  )
  SELECT
    (SELECT user_id FROM ranked WHERE rk = 1),
    (SELECT user_id FROM ranked WHERE rk = 2)
  INTO v_first_user, v_second_user;

  -- 1st place
  IF v_first_user IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.xp_monthly_processing
    WHERE year=_year AND month=_month AND criterion='rank_1'
  ) THEN
    INSERT INTO public.user_xp_events (user_id, amount, reason, source_type)
    VALUES (v_first_user, v_settings.rank_1_xp, '1º Lugar no Ranking Mensal', 'auto_rank_1');
    INSERT INTO public.xp_monthly_processing (year, month, criterion) VALUES (_year,_month,'rank_1');
  END IF;

  -- 2nd place
  IF v_second_user IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.xp_monthly_processing
    WHERE year=_year AND month=_month AND criterion='rank_2'
  ) THEN
    INSERT INTO public.user_xp_events (user_id, amount, reason, source_type)
    VALUES (v_second_user, v_settings.rank_2_xp, '2º Lugar no Ranking Mensal', 'auto_rank_2');
    INSERT INTO public.xp_monthly_processing (year, month, criterion) VALUES (_year,_month,'rank_2');
  END IF;
END;
$$;

-- ============ FUNCTION: Apply squad destaque ============
CREATE OR REPLACE FUNCTION public.xp_apply_squad_destaque(_year integer, _month integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings record;
  v_winner_squad uuid;
  v_member uuid;
BEGIN
  SELECT * INTO v_settings FROM public.xp_settings WHERE id = true;

  IF EXISTS (
    SELECT 1 FROM public.xp_monthly_processing
    WHERE year=_year AND month=_month AND criterion='squad_destaque'
  ) THEN
    RETURN;
  END IF;

  WITH squad_totals AS (
    SELECT
      sm.squad_id,
      AVG(COALESCE(ps.aprendizado_continuo + ps.padrao_qualidade_uau + ps.metas_prazos + ps.ambiente_organizado + ps.comprometimento + ps.video_destaque + ps.squad_destaque, 0)) AS avg_score
    FROM public.squad_members sm
    LEFT JOIN public.performance_scores ps
      ON ps.user_id = sm.user_id AND ps.year = _year AND ps.month = _month
    GROUP BY sm.squad_id
  )
  SELECT squad_id INTO v_winner_squad
  FROM squad_totals
  ORDER BY avg_score DESC NULLS LAST
  LIMIT 1;

  IF v_winner_squad IS NULL THEN RETURN; END IF;

  FOR v_member IN
    SELECT user_id FROM public.squad_members WHERE squad_id = v_winner_squad
  LOOP
    INSERT INTO public.user_xp_events (user_id, amount, reason, source_type, source_id)
    VALUES (v_member, v_settings.squad_destaque_xp, 'Squad Destaque do Mês', 'auto_squad', v_winner_squad);
  END LOOP;

  INSERT INTO public.xp_monthly_processing (year, month, criterion) VALUES (_year,_month,'squad_destaque');
END;
$$;

-- ============ FUNCTION: Apply video destaque ============
CREATE OR REPLACE FUNCTION public.xp_apply_video_destaque(_pm_task_id uuid, _year integer, _month integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings record;
  v_assignee uuid;
  v_watchers uuid[];
  v_w uuid;
  v_recipients uuid[] := ARRAY[]::uuid[];
  v_user uuid;
  v_user_role text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;

  SELECT * INTO v_settings FROM public.xp_settings WHERE id = true;

  -- Replace existing selection for this month (revoke prior XP)
  IF EXISTS (SELECT 1 FROM public.xp_video_destaque WHERE year=_year AND month=_month) THEN
    DELETE FROM public.user_xp_events
    WHERE source_type='auto_video_destaque'
      AND source_id = (SELECT pm_task_id FROM public.xp_video_destaque WHERE year=_year AND month=_month);
    DELETE FROM public.xp_video_destaque WHERE year=_year AND month=_month;
  END IF;

  SELECT assignee_id, watchers INTO v_assignee, v_watchers
  FROM public.pm_tasks WHERE id = _pm_task_id;

  IF v_assignee IS NOT NULL THEN v_recipients := v_recipients || v_assignee; END IF;
  IF v_watchers IS NOT NULL THEN
    FOREACH v_w IN ARRAY v_watchers LOOP
      IF v_w IS NOT NULL AND NOT (v_w = ANY(v_recipients)) THEN
        v_recipients := v_recipients || v_w;
      END IF;
    END LOOP;
  END IF;

  -- Filter by configured roles
  FOREACH v_user IN ARRAY v_recipients LOOP
    SELECT role_title INTO v_user_role FROM public.team_members WHERE user_id = v_user;
    IF v_user_role IS NULL OR v_user_role = ANY(v_settings.video_destaque_roles) THEN
      INSERT INTO public.user_xp_events (user_id, amount, reason, source_type, source_id, created_by)
      VALUES (v_user, v_settings.video_destaque_xp, 'Vídeo Destaque do Mês', 'auto_video_destaque', _pm_task_id, auth.uid());
    END IF;
  END LOOP;

  INSERT INTO public.xp_video_destaque (year, month, pm_task_id, selected_by)
  VALUES (_year, _month, _pm_task_id, auth.uid());
END;
$$;

-- ============ FUNCTION: Apply late task penalties ============
CREATE OR REPLACE FUNCTION public.xp_apply_task_late_penalties()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings record;
  v_task record;
  v_count integer := 0;
  v_user uuid;
  v_w uuid;
  v_targets uuid[];
BEGIN
  SELECT * INTO v_settings FROM public.xp_settings WHERE id = true;

  FOR v_task IN
    SELECT pt.id, pt.title, pt.assignee_id, pt.watchers
    FROM public.pm_tasks pt
    WHERE pt.deleted_at IS NULL
      AND pt.due_date IS NOT NULL
      AND pt.due_date < CURRENT_DATE
      AND pt.status_global <> 'concluido'
      AND pt.assignee_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.xp_task_penalties p WHERE p.pm_task_id = pt.id)
  LOOP
    v_targets := ARRAY[v_task.assignee_id];
    IF v_settings.late_penalize_all_assignees AND v_task.watchers IS NOT NULL THEN
      FOREACH v_w IN ARRAY v_task.watchers LOOP
        IF v_w IS NOT NULL AND NOT (v_w = ANY(v_targets)) THEN
          v_targets := v_targets || v_w;
        END IF;
      END LOOP;
    END IF;

    FOREACH v_user IN ARRAY v_targets LOOP
      INSERT INTO public.xp_task_penalties (pm_task_id, user_id, xp_deducted)
      VALUES (v_task.id, v_user, v_settings.task_late_penalty)
      ON CONFLICT (pm_task_id, user_id) DO NOTHING;

      IF FOUND THEN
        INSERT INTO public.user_xp_events (user_id, amount, reason, source_type, source_id)
        VALUES (v_user, v_settings.task_late_penalty, 'Atraso em Tarefa: ' || COALESCE(v_task.title,''), 'auto_task_late', v_task.id);
        v_count := v_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============ Wrapper: process previous month ============
CREATE OR REPLACE FUNCTION public.xp_process_previous_month()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev date := (date_trunc('month', CURRENT_DATE) - INTERVAL '1 day')::date;
  v_year integer := EXTRACT(YEAR FROM v_prev)::integer;
  v_month integer := EXTRACT(MONTH FROM v_prev)::integer;
BEGIN
  PERFORM public.xp_apply_monthly_rankings(v_year, v_month);
  PERFORM public.xp_apply_squad_destaque(v_year, v_month);
END;
$$;

GRANT EXECUTE ON FUNCTION public.xp_apply_monthly_rankings(integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xp_apply_squad_destaque(integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xp_apply_video_destaque(uuid,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xp_apply_task_late_penalties() TO authenticated;
GRANT EXECUTE ON FUNCTION public.xp_process_previous_month() TO authenticated;
