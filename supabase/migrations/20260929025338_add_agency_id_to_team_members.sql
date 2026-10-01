alter table public.team_members
  add column agency_id uuid references public.agencies(id) default public.current_agency_id();

update public.team_members
set agency_id = (select id from public.agencies where slug = 'uau-digital')
where agency_id is null;
