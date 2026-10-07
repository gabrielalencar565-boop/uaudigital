-- list_users_admin shows requests that never got an agency to the platform owner, but the only UPDATE policy required
-- agency_id = current_agency_id(), so approving/rejecting them silently changed nothing. Let the platform owner decide them.
create policy "Platform admin can decide legacy access requests"
  on public.access_requests
  for update
  to authenticated
  using ((select public.is_platform_admin()) and agency_id is null)
  with check ((select public.is_platform_admin()) and agency_id is null);
