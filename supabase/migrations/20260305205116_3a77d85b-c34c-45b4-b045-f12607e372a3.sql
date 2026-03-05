
-- Enums
CREATE TYPE public.pm_priority AS ENUM ('baixa', 'media', 'alta', 'urgente');
CREATE TYPE public.pm_status AS ENUM ('backlog', 'em_andamento', 'em_aprovacao', 'concluido', 'pausado', 'cancelado');
CREATE TYPE public.pm_stage AS ENUM ('planejamento', 'roteiro', 'captacao', 'edicao', 'design', 'revisao', 'entrega');
CREATE TYPE public.pm_subtask_status AS ENUM ('nao_iniciado', 'em_producao', 'aguardando', 'em_revisao', 'aprovado', 'concluido', 'bloqueado');

-- Projects
CREATE TABLE public.pm_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  month_ref text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tasks (ClickUp-style)
CREATE TABLE public.pm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  priority public.pm_priority NOT NULL DEFAULT 'media',
  status_global public.pm_status NOT NULL DEFAULT 'backlog',
  stage_current public.pm_stage NOT NULL DEFAULT 'planejamento',
  start_date date,
  due_date date,
  created_by uuid NOT NULL,
  assignee_id uuid,
  watchers uuid[] DEFAULT '{}',
  tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Subtasks
CREATE TABLE public.pm_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  stage public.pm_stage NOT NULL DEFAULT 'planejamento',
  status public.pm_subtask_status NOT NULL DEFAULT 'nao_iniciado',
  assignee_id uuid,
  due_date date,
  order_index int NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Comments
CREATE TABLE public.pm_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  subtask_id uuid REFERENCES public.pm_subtasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Attachments
CREATE TABLE public.pm_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  subtask_id uuid REFERENCES public.pm_subtasks(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size bigint,
  storage_path text NOT NULL,
  public_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Activity Log
CREATE TABLE public.pm_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.pm_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_activity_log ENABLE ROW LEVEL SECURITY;

-- pm_projects policies
CREATE POLICY "pm_projects_select" ON public.pm_projects FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "pm_projects_admin_all" ON public.pm_projects FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "pm_projects_planner_insert" ON public.pm_projects FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'planner'::public.app_role));

-- pm_tasks policies
CREATE POLICY "pm_tasks_select" ON public.pm_tasks FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "pm_tasks_admin_all" ON public.pm_tasks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "pm_tasks_planner_insert" ON public.pm_tasks FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'planner'::public.app_role));
CREATE POLICY "pm_tasks_update_auth" ON public.pm_tasks FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

-- pm_subtasks policies
CREATE POLICY "pm_subtasks_select" ON public.pm_subtasks FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "pm_subtasks_admin_all" ON public.pm_subtasks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "pm_subtasks_update_auth" ON public.pm_subtasks FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "pm_subtasks_insert_auth" ON public.pm_subtasks FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- pm_comments policies
CREATE POLICY "pm_comments_select" ON public.pm_comments FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "pm_comments_insert_auth" ON public.pm_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "pm_comments_delete" ON public.pm_comments FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- pm_attachments policies
CREATE POLICY "pm_attachments_select" ON public.pm_attachments FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "pm_attachments_insert_auth" ON public.pm_attachments FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "pm_attachments_delete" ON public.pm_attachments FOR DELETE TO authenticated USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- pm_activity_log policies
CREATE POLICY "pm_activity_log_select" ON public.pm_activity_log FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "pm_activity_log_insert_auth" ON public.pm_activity_log FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('pm-attachments', 'pm-attachments', true) ON CONFLICT DO NOTHING;

-- Storage policies
CREATE POLICY "pm_att_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'pm-attachments');
CREATE POLICY "pm_att_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'pm-attachments');
CREATE POLICY "pm_att_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'pm-attachments' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'::public.app_role)));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pm_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pm_subtasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pm_comments;

-- Updated_at triggers
CREATE TRIGGER pm_projects_updated_at BEFORE UPDATE ON public.pm_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER pm_tasks_updated_at BEFORE UPDATE ON public.pm_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER pm_subtasks_updated_at BEFORE UPDATE ON public.pm_subtasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
