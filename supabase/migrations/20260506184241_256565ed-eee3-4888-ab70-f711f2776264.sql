-- Fix: reset incorrectly-completed task for Reis Construções (PM task is still in backlog)
UPDATE tasks SET status = 'em_andamento', completed_at = NULL WHERE id = '9ddca26d-c099-44eb-ad54-e77840c87158';

-- Fix: soft-delete orphan task for Arco Íris Da Gih (PM task no longer exists)
UPDATE tasks SET deleted_at = now() WHERE id = '1efd65e4-2036-4754-8f5a-76d8d4c2b8b9';
