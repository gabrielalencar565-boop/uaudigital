-- The client-side insert into access_requests right after supabase.auth.signUp() used to
-- silently fail whenever "Confirm email" left the new user with no active session yet
-- (auth.uid() was null, so the RLS insert policy rejected the row) — the signup would
-- succeed but never show up in the admin approval list. Moving the insert into a
-- SECURITY DEFINER trigger makes it happen server-side, unconditionally, regardless of
-- session state.
create or replace function public.handle_new_user_access_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.access_requests (user_id, note, status)
  values (new.id, new.email, 'pending')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_access_request on auth.users;
create trigger on_auth_user_created_access_request
  after insert on auth.users
  for each row execute function public.handle_new_user_access_request();
