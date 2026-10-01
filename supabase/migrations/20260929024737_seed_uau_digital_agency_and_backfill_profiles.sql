insert into public.agencies (name, slug, status)
values ('Uau Digital', 'uau-digital', 'active');

update public.profiles
set agency_id = (select id from public.agencies where slug = 'uau-digital')
where agency_id is null;
