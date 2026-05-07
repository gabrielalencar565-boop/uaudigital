UPDATE pm_tasks 
SET assignee_id = 'c3502238-6b61-41a5-a7f1-364cb65e580e'
WHERE parent_task_id = 'f09dcd23-3d9f-4331-b9d9-1585671aa565'
  AND deleted_at IS NULL;