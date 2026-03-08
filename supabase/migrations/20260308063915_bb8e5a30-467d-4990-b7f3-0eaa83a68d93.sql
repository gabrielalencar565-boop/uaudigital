
CREATE TABLE public.client_squads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, squad_id)
);

ALTER TABLE public.client_squads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_squads_admin_all" ON public.client_squads
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "client_squads_select_auth" ON public.client_squads
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
