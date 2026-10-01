alter table public.scoring_config
  add column agency_id uuid references public.agencies(id) default public.current_agency_id();

update public.scoring_config
set agency_id = (select id from public.agencies where slug = 'uau-digital')
where agency_id is null;

drop policy "scoring_config_admin_all_delete" on public.scoring_config;
create policy "scoring_config_admin_all_delete" on public.scoring_config
  for delete to public
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = public.current_agency_id());

drop policy "scoring_config_admin_all_insert" on public.scoring_config;
create policy "scoring_config_admin_all_insert" on public.scoring_config
  for insert to public
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = public.current_agency_id());

drop policy "scoring_config_select_combined" on public.scoring_config;
create policy "scoring_config_select_combined" on public.scoring_config
  for select to public
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = public.current_agency_id());

drop policy "scoring_config_admin_all_update" on public.scoring_config;
create policy "scoring_config_admin_all_update" on public.scoring_config
  for update to public
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = public.current_agency_id())
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = public.current_agency_id());
