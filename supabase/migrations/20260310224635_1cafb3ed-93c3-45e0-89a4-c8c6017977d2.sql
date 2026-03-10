
-- Global tags table
CREATE TABLE public.pm_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color_key text NOT NULL DEFAULT 'blue',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name)
);

ALTER TABLE public.pm_tags ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read tags
CREATE POLICY "pm_tags_select_auth" ON public.pm_tags
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- All authenticated users can create tags
CREATE POLICY "pm_tags_insert_auth" ON public.pm_tags
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Admin and planner can delete tags
CREATE POLICY "pm_tags_delete_admin" ON public.pm_tags
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'planner'::app_role));

-- Admin and planner can update tags
CREATE POLICY "pm_tags_update_admin" ON public.pm_tags
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'planner'::app_role));
