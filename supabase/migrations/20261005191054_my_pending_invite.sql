-- An invited person who logs in before opening the invite link must not be sent to "create an agency":
-- the onboarding page asks for their open invite (matched by the e-mail of the signed-in account) and redirects.
create or replace function public.my_pending_invite() returns text
language sql stable security definer set search_path = '' as $$
  select i.token
  from public.agency_invites i
  join auth.users u on lower(u.email) = lower(i.email)
  where u.id = (select auth.uid()) and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
  order by i.created_at desc limit 1
$$;
revoke all on function public.my_pending_invite() from public, anon;
grant execute on function public.my_pending_invite() to authenticated;
