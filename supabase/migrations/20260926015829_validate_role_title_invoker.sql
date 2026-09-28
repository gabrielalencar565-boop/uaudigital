-- Mesmo ajuste já feito em feature_permissions_set_audit(): a trigger só precisa ler
-- public.cargos (que já tem select liberado pra qualquer autenticado via RLS), então
-- SECURITY DEFINER aqui só expunha a função como RPC chamável direto sem necessidade.
create or replace function public.validate_role_title()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.role_title is not null and not exists (
    select 1 from public.cargos where label = new.role_title and is_active = true
  ) then
    raise exception 'role_title "%" não corresponde a um cargo ativo cadastrado', new.role_title;
  end if;
  return new;
end;
$$;

revoke execute on function public.validate_role_title() from anon, authenticated;
