-- Lets an agency admin resolve a user by e-mail ONLY inside their own agency (used by admin-generate-recovery-link,
-- which previously generated a password-reset link for any e-mail of any agency).
create or replace function public.my_agency_user_by_email(p_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select u.id
  from auth.users u
  join public.profiles p on p.user_id = u.id
  where lower(u.email) = lower(btrim(p_email))
    and p.agency_id is not null
    and p.agency_id = (select public.current_agency_id())
    and public.has_role((select auth.uid()), 'admin'::public.app_role)
$$;
revoke all on function public.my_agency_user_by_email(text) from public, anon;
grant execute on function public.my_agency_user_by_email(text) to authenticated;
