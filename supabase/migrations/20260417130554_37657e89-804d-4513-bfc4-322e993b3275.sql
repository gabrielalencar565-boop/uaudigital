DO $$
DECLARE
  v_pm_id uuid;
BEGIN
  FOR v_pm_id IN
    SELECT DISTINCT split_part(t.description, ':', 2)::uuid
    FROM public.tasks t
    WHERE t.description LIKE 'pm:%'
      AND t.deleted_at IS NULL
      AND t.status = 'concluido'
      AND t.stage IN ('design', 'edicao_videos')
  LOOP
    PERFORM public.pm_recalc_tag_points(v_pm_id);
  END LOOP;
END$$;