alter table public.cargos
  add column agency_id uuid references public.agencies(id) default public.current_agency_id();

update public.cargos
set agency_id = (select id from public.agencies where slug = 'uau-digital')
where agency_id is null;

drop policy "cargos_admin_write" on public.cargos;
create policy "cargos_admin_write" on public.cargos
  for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role) and agency_id = public.current_agency_id())
  with check (has_role(auth.uid(), 'admin'::app_role) and agency_id = public.current_agency_id());

drop policy "cargos_select_authenticated" on public.cargos;
create policy "cargos_select_authenticated" on public.cargos
  for select to authenticated
  using (agency_id = public.current_agency_id());
