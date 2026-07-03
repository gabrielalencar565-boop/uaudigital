
-- Remove duplicate pm_comments (same author/task/content within 10s window), keep earliest
WITH ranked AS (
  SELECT id, author_id, task_id, content, created_at,
    LAG(created_at) OVER (PARTITION BY author_id, task_id, content ORDER BY created_at) AS prev_ts,
    LAG(id) OVER (PARTITION BY author_id, task_id, content ORDER BY created_at) AS prev_id
  FROM pm_comments
),
dupes AS (
  SELECT id FROM ranked
  WHERE prev_ts IS NOT NULL AND created_at - prev_ts < interval '10 seconds'
)
DELETE FROM pm_comments WHERE id IN (SELECT id FROM dupes);
