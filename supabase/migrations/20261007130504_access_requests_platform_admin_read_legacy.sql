-- An UPDATE only touches rows the caller can also SELECT: the platform owner needs to see the agency-less requests too.
create policy "Platform admin can read legacy access requests"
  on public.access_requests
  for select
  to authenticated
  using ((select public.is_platform_admin()) and agency_id is null);
