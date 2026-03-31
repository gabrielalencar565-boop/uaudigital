CREATE OR REPLACE FUNCTION public.snapshot_unscored_tasks()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.tasks t
  SET point_value = (
    COALESCE(sc.base_points, 1)
    * CASE WHEN COALESCE(sc.uses_quantity, false) THEN COALESCE(t.quantity, 1) ELSE 1 END
    * CASE WHEN t.is_extra_demand AND COALESCE(sc.uses_quantity, false) 
           THEN COALESCE(sc.extra_demand_multiplier, 1.5) ELSE 1 END
  )
  FROM public.scoring_config sc
  WHERE sc.stage = t.stage::text
    AND t.status = 'concluido'
    AND t.deleted_at IS NULL
    AND t.point_value IS NULL
    AND t.completed_at IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;