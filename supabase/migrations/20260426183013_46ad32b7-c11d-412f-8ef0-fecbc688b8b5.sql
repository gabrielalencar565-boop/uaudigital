-- Inferir post_type para children PDF que estão NULL
UPDATE public.pm_tasks
SET post_type = CASE
  WHEN lower(title) ~ '\m(video|vídeo|reel|clip|edição de vídeo)\M' THEN 'video'
  ELSE 'design'
END
WHERE parent_task_id IS NOT NULL
  AND stage_current = 'pdf'
  AND deleted_at IS NULL
  AND post_type IS NULL
  AND parent_task_id IN (
    SELECT id FROM public.pm_tasks
    WHERE stage_current='pdf' AND parent_task_id IS NULL
      AND deleted_at IS NULL AND is_extra_demand=false
  );