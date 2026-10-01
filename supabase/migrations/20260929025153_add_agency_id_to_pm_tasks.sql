alter table public.pm_tasks
  add column agency_id uuid references public.agencies(id) default public.current_agency_id();

update public.pm_tasks
set agency_id = (select id from public.agencies where slug = 'uau-digital')
where agency_id is null;
