
-- Update snapshot due_dates for pm task dd7b3c72 from April to May
UPDATE tasks
SET due_date = '2026-05-01'
WHERE description LIKE 'pm:dd7b3c72-6b41-4e96-9ea3-6c0c18a7caf9:%'
AND deleted_at IS NULL;

-- Recompute scores for the affected user in both April and May
SELECT recompute_metas_prazos('c3502238-6b61-41a5-a7f1-364cb65e580e'::uuid, 2026, 4);
SELECT recompute_metas_prazos('c3502238-6b61-41a5-a7f1-364cb65e580e'::uuid, 2026, 5);
