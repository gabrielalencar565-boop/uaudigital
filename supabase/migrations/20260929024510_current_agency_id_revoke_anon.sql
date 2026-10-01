revoke execute on function public.current_agency_id() from anon;
revoke execute on function public.current_agency_id() from public;
grant execute on function public.current_agency_id() to authenticated;
