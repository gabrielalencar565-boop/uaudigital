
-- Allow all authenticated users to read all profiles (needed for showing avatars/names across dashboards)
CREATE POLICY "All authenticated can read profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);
