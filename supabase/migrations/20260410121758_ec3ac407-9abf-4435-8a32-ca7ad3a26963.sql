-- Drop the old 3-param overload that doesn't do per-subtask distribution
DROP FUNCTION IF EXISTS public.pm_sync_stage_completion(uuid, text, uuid);