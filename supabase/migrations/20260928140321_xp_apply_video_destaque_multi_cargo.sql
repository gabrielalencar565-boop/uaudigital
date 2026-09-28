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
  v_user_roles text[];
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

  -- Filter by configured roles -- elegível se QUALQUER cargo da pessoa bater com a lista
  -- configurada (operador && de sobreposição de array), preservando a semântica anterior
  -- de "sem cargo cadastrado = elegível" (v_user_roles vazio/nulo passa direto).
  FOREACH v_user IN ARRAY v_recipients LOOP
    SELECT role_titles INTO v_user_roles FROM public.team_members WHERE user_id = v_user;
    IF v_user_roles IS NULL OR array_length(v_user_roles, 1) IS NULL OR v_user_roles && v_settings.video_destaque_roles THEN
      INSERT INTO public.user_xp_events (user_id, amount, reason, source_type, source_id, created_by)
      VALUES (v_user, v_settings.video_destaque_xp, 'Vídeo Destaque do Mês', 'auto_video_destaque', _pm_task_id, auth.uid());
    END IF;
  END LOOP;

  INSERT INTO public.xp_video_destaque (year, month, pm_task_id, selected_by)
  VALUES (_year, _month, _pm_task_id, auth.uid());
END;
$$;
