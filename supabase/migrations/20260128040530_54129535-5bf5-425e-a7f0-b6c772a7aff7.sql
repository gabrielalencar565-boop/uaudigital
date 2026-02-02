-- 1) Restrict detailed performance visibility (collaborator sees only own rows)
DO $$ BEGIN
  -- ignore errors if already enabled
  EXECUTE 'ALTER TABLE public.performance_scores ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN others THEN
  NULL;
END $$;

DROP POLICY IF EXISTS "Performance readable by authenticated" ON public.performance_scores;

CREATE POLICY "Admins can read performance"
ON public.performance_scores
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users can read own performance"
ON public.performance_scores
FOR SELECT
USING (auth.uid() = user_id);

-- 2) Public (aggregated) ranking endpoints (do not expose criteria columns)
CREATE OR REPLACE FUNCTION public.get_performance_month_totals(_year integer)
RETURNS TABLE (
  user_id uuid,
  month integer,
  total integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ps.user_id,
    ps.month,
    (ps.aprendizado_continuo + ps.padrao_qualidade_uau + ps.metas_prazos + ps.ambiente_organizado + ps.comprometimento) AS total
  FROM public.performance_scores ps
  WHERE ps.year = _year
  ORDER BY ps.month ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_performance_year_summary(_year integer)
RETURNS TABLE (
  user_id uuid,
  total_year integer,
  avg_month numeric,
  high_months integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH month_totals AS (
    SELECT
      ps.user_id,
      ps.month,
      (ps.aprendizado_continuo + ps.padrao_qualidade_uau + ps.metas_prazos + ps.ambiente_organizado + ps.comprometimento) AS total
    FROM public.performance_scores ps
    WHERE ps.year = _year
  )
  SELECT
    mt.user_id,
    COALESCE(SUM(mt.total), 0)::int AS total_year,
    COALESCE(AVG(mt.total), 0) AS avg_month,
    COALESCE(SUM(CASE WHEN mt.total >= 7 THEN 1 ELSE 0 END), 0)::int AS high_months
  FROM month_totals mt
  GROUP BY mt.user_id
  ORDER BY total_year DESC;
$$;

-- 3) Avatars storage bucket (public) + policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Public read (bucket is public), but keep explicit policy for clarity
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

-- Upload/update/delete: owner folder or admin
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'avatars'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);
