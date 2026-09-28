-- A trigger function não precisa de privilégio elevado (só seta NEW.updated_at/updated_by,
-- e quem pode disparar o UPDATE já é controlado pela policy feature_permissions_admin_write) —
-- SECURITY DEFINER aqui só expunha a função como RPC chamável direto por anon/authenticated
-- via /rest/v1/rpc/feature_permissions_set_audit sem necessidade nenhuma.
create or replace function public.feature_permissions_set_audit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

revoke execute on function public.feature_permissions_set_audit() from anon, authenticated;
