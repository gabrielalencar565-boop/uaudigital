-- pg_trgm first
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- pm_tasks indexes
CREATE INDEX IF NOT EXISTS idx_pm_tasks_parent_created
  ON public.pm_tasks (parent_task_id, created_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pm_tasks_root_created
  ON public.pm_tasks (created_at DESC)
  WHERE parent_task_id IS NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pm_tasks_assignee_due
  ON public.pm_tasks (assignee_id, due_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pm_tasks_assignee_status
  ON public.pm_tasks (assignee_id, status_global)
  WHERE deleted_at IS NULL AND parent_task_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_pm_tasks_due_status
  ON public.pm_tasks (due_date, status_global)
  WHERE deleted_at IS NULL AND parent_task_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_pm_activity_log_entity_created
  ON public.pm_activity_log (entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pm_comments_task_created
  ON public.pm_comments (task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pm_comments_content_trgm
  ON public.pm_comments USING gin (content extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pm_attachments_task_created
  ON public.pm_attachments (task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_status
  ON public.tasks (assigned_user_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_due_status
  ON public.tasks (due_date, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_description_btree
  ON public.tasks (description)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_key_created
  ON public.whatsapp_messages (contact_phone_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created
  ON public.chat_messages (conversation_id, created_at DESC);

-- Remove tabelas estáticas da publicação
DO $$
DECLARE
  t text;
  drop_list text[] := ARRAY[
    'app_settings','scoring_config','pm_pdf_settings','pm_stage_flows','pm_tags',
    'pm_projects','pm_cronograma_feedback','internal_dates',
    'cleaning_categories','cleaning_schedules','cleaning_completions',
    'health_scores','health_score_tokens',
    'magic2_clients','magic2_client_links','magic2_cycles','magic2_cycle_stages',
    'financial_clients','financial_expenses','financial_revenues','financial_goals',
    'financial_transactions','financial_credit_cards','mrr_movements',
    'squads','squad_members','client_squads',
    'client_cycles','client_cycle_stages','client_stages',
    'access_requests','chat_presence','chat_message_attachments',
    'pm_attachments','pm_activity_log','task_activity_log','task_deadline_overrides',
    'performance_scores','whatsapp_contacts','whatsapp_outbox'
  ];
BEGIN
  FOREACH t IN ARRAY drop_list LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    EXCEPTION WHEN others THEN NULL;
    END;
  END LOOP;
END $$;
