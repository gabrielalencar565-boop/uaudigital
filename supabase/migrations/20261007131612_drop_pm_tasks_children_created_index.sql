-- Reverts idx_pm_tasks_children_created: with OFFSET pagination (what the app does today) the planner picked this index and read
-- ~9k rows in random heap order (late pages went from ~180 ms to ~2 s). The delta-sync fix in the app makes it unnecessary.
drop index if exists public.idx_pm_tasks_children_created;
