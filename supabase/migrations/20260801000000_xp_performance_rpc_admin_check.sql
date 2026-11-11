-- These 6 SECURITY DEFINER functions had EXECUTE granted to anon with no
-- caller check, so any unauthenticated request could trigger score/XP
-- recalculation for arbitrary users and months via the public REST API.
--
-- Two call patterns exist here, so two different guards are used:
--
-- 1) recompute_all_scores / recompute_metas_prazos are called by any
--    authenticated user as a side effect of editing a task assigned to
--    someone else (due date change, checklist toggle), not just admins.
--    They only recompute from real task data, so the guard just requires
--    an authenticated caller (blocks anon, keeps the existing UX).
--
-- 2) xp_apply_monthly_rankings / xp_apply_squad_destaque /
--    xp_apply_task_late_penalties / xp_process_previous_month grant XP and
--    are meant to be admin-only (XPAutomationPanel) or pg_cron-only
--    (xp-daily-late-penalties, xp-monthly-rank-squad). pg_cron runs these
--    directly as the postgres role, where auth.uid() is NULL, so the guard
--    only enforces has_role(...) when auth.uid() IS NOT NULL (i.e. the call
--    came in through PostgREST as `authenticated`) — cron keeps working,
--    non-admin authenticated users and anon get rejected.
--
-- Bonus finding while auditing this batch: xp_apply_video_destaque already
-- has the correct has_role() check in its body (unconditional — it has no
-- cron caller), but still had EXECUTE granted to anon/PUBLIC. Not
-- separately exploitable since the body already rejects anon, but the
-- dangling grant is tightened here to match the other 7 functions.

CREATE OR REPLACE FUNCTION public.recompute_all_scores(_user_id uuid, _year integer, _month integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  metas_prazos_pts numeric := 0;
  v_use_old boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _year < 2000 OR _year > 2100 OR _month < 1 OR _month > 12 THEN
    RAISE EXCEPTION 'Invalid year or month';
  END IF;

  v_use_old := (_year < 2026 OR (_year = 2026 AND _month < 3));

  IF v_use_old THEN
    SELECT COALESCE(
      SUM(
        COALESCE(
          o.override_points::numeric,
          CASE
            WHEN t.completed_at IS NULL THEN 0
            WHEN t.stage::text IN ('pdf', 'agendamento') THEN 0
            WHEN ((t.completed_at AT TIME ZONE 'America/Sao_Paulo')::date <= t.due_date) THEN 1
            ELSE -1
          END
        )
      ),
      0
    )
    INTO metas_prazos_pts
    FROM public.tasks t
    LEFT JOIN public.task_deadline_overrides o ON o.task_id = t.id
    WHERE t.status = 'concluido'
      AND t.deleted_at IS NULL
      AND date_trunc('month', t.due_date::timestamp) = make_date(_year, _month, 1)::timestamp
      AND (
        t.assigned_user_id = _user_id
        OR EXISTS (
          SELECT 1 FROM public.task_assignees ta
          WHERE ta.task_id = t.id AND ta.user_id = _user_id
        )
      );
  ELSE
    SELECT COALESCE(
      SUM(
        COALESCE(
          o.override_points::numeric,
          CASE
            WHEN t.completed_at IS NULL THEN 0
            WHEN ((t.completed_at AT TIME ZONE 'America/Sao_Paulo')::date <= t.due_date) THEN
              CASE
                WHEN t.point_value IS NOT NULL THEN t.point_value
                ELSE
                  COALESCE(sc.base_points, 1) *
                  CASE WHEN COALESCE(sc.uses_quantity, false) THEN COALESCE(t.quantity, 1) ELSE 1 END *
                  CASE WHEN t.is_extra_demand AND COALESCE(sc.uses_quantity, false) THEN COALESCE(sc.extra_demand_multiplier, 1.5) ELSE 1 END
              END
            ELSE
              COALESCE(sc.late_penalty, -1) + COALESCE((
                SELECT SUM(sc2.late_penalty)
                FROM public.pm_tasks pt
                CROSS JOIN LATERAL unnest(pt.tags) AS tag_val
                JOIN public.scoring_config sc2 ON sc2.stage = 'tag_' || lower(replace(split_part(tag_val, ':', 1), ' ', '_'))
                WHERE t.description LIKE 'pm:%'
                  AND pt.id = split_part(t.description, ':', 2)::uuid
              ), 0)
          END
        )
      ),
      0
    )
    INTO metas_prazos_pts
    FROM public.tasks t
    LEFT JOIN public.task_deadline_overrides o ON o.task_id = t.id
    LEFT JOIN LATERAL (
      SELECT CASE
        WHEN t.description LIKE 'pm:%' AND split_part(t.description, ':', 3) LIKE 'custom_%'
          THEN split_part(t.description, ':', 3)
        ELSE t.stage::text
      END AS effective_stage
    ) es ON true
    LEFT JOIN public.scoring_config sc ON sc.stage = es.effective_stage
    WHERE t.status = 'concluido'
      AND t.deleted_at IS NULL
      AND date_trunc('month', t.due_date::timestamp) = make_date(_year, _month, 1)::timestamp
      AND (
        t.assigned_user_id = _user_id
        OR EXISTS (
          SELECT 1 FROM public.task_assignees ta
          WHERE ta.task_id = t.id AND ta.user_id = _user_id
        )
      );
  END IF;

  INSERT INTO public.performance_scores (
    user_id, year, month,
    metas_prazos, aprendizado_continuo, padrao_qualidade_uau,
    ambiente_organizado, comprometimento, created_by
  ) VALUES (
    _user_id, _year, _month,
    metas_prazos_pts, 0, 0, 0, 0, _user_id
  )
  ON CONFLICT (user_id, year, month)
  DO UPDATE SET
    metas_prazos = EXCLUDED.metas_prazos,
    updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.recompute_metas_prazos(_user_id uuid, _year integer, _month integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _user_id IS NULL OR _year IS NULL OR _month IS NULL THEN
    RETURN;
  END IF;
  PERFORM public.recompute_all_scores(_user_id, _year, _month);
END;
$function$;

CREATE OR REPLACE FUNCTION public.xp_apply_monthly_rankings(_year integer, _month integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_settings record;
  v_first_user uuid;
  v_second_user uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.xp_apply_squad_destaque(_year integer, _month integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_settings record;
  v_winner_squad uuid;
  v_member uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.xp_apply_task_late_penalties()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_settings record;
  v_task record;
  v_count integer := 0;
  v_user uuid;
  v_w uuid;
  v_targets uuid[];
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.xp_process_previous_month()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prev date := (date_trunc('month', CURRENT_DATE) - INTERVAL '1 day')::date;
  v_year integer := EXTRACT(YEAR FROM v_prev)::integer;
  v_month integer := EXTRACT(MONTH FROM v_prev)::integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  PERFORM public.xp_apply_monthly_rankings(v_year, v_month);
  PERFORM public.xp_apply_squad_destaque(v_year, v_month);
END;
$function$;

-- CREATE OR REPLACE FUNCTION grants EXECUTE to PUBLIC by default, and anon
-- inherits from PUBLIC membership — revoking only FROM anon would leave
-- these reachable via the PUBLIC grant, so PUBLIC is revoked and
-- authenticated is re-granted explicitly (same pattern as list_users_admin).
REVOKE ALL ON FUNCTION public.recompute_all_scores(uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recompute_metas_prazos(uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.xp_apply_monthly_rankings(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.xp_apply_squad_destaque(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.xp_apply_task_late_penalties() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.xp_process_previous_month() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.recompute_all_scores(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_metas_prazos(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xp_apply_monthly_rankings(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xp_apply_squad_destaque(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xp_apply_task_late_penalties() TO authenticated;
GRANT EXECUTE ON FUNCTION public.xp_process_previous_month() TO authenticated;

REVOKE ALL ON FUNCTION public.xp_apply_video_destaque(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.xp_apply_video_destaque(uuid, integer, integer) TO authenticated;
