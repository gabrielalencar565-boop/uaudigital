drop policy "members_can_view_own_agency" on public.agencies;
create policy "members_can_view_own_agency" on public.agencies
  for select to authenticated
  using (id = (select public.current_agency_id()));
