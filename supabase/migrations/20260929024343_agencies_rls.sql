alter table public.agencies enable row level security;

revoke all on public.agencies from anon, authenticated;
grant select on public.agencies to authenticated;

create policy "members_can_view_own_agency"
on public.agencies
for select
to authenticated
using (id = public.current_agency_id());
