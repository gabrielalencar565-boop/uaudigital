-- Fix task 374b8f61: should be REV/PLAN (post_type planejamento), not REV/DSG
UPDATE pm_tasks
SET post_type = 'planejamento'
WHERE id = '374b8f61-2326-4e47-8ae7-1d926b1f6b59';

-- Soft-delete duplicate video revision task (keep f7008aed as the valid one)
UPDATE pm_tasks
SET deleted_at = now()
WHERE id = 'e175586e-6599-4922-806c-b5a54e5ba875';