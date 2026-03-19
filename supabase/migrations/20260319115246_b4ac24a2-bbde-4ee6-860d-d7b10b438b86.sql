UPDATE tasks 
SET deleted_at = now(), deleted_by = assigned_user_id 
WHERE id = '27d35dda-e601-438b-8bc1-97754969dcc5' 
  AND deleted_at IS NULL;