alter table public.app_settings
  add column magic_number_day integer not null default 27 check (magic_number_day between 1 and 28),
  add column magic_number_label text not null default 'Magic Number';

create or replace function public.current_magic_number_day()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select magic_number_day from public.app_settings where agency_id = public.current_agency_id()),
    27
  );
$$;

revoke execute on function public.current_magic_number_day() from anon;
grant execute on function public.current_magic_number_day() to authenticated;
