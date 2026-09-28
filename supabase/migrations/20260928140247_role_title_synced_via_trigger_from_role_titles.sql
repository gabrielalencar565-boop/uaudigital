-- Remove os triggers/função antigos de validação de coluna única.
drop trigger if exists validate_profiles_role_title on public.profiles;
drop trigger if exists validate_team_members_role_title on public.team_members;
drop function if exists public.validate_role_title();

-- role_title continua sendo uma coluna de verdade (não pode ser "generated always" porque
-- array_to_string() não é IMMUTABLE no Postgres), mas passa a ser sincronizada
-- automaticamente por trigger a partir de role_titles, em vez de depender do código do
-- app escrever nas duas colunas em lockstep (como fazia até agora). Isso é o que evita
-- ter que tocar nos ~15 lugares do front que só exibem o cargo -- eles continuam lendo
-- role_title como string e passam a ver, ex, "Social Media, Designer" automaticamente.
-- Também valida aqui: cada elemento de role_titles precisa bater com um cargo ativo
-- cadastrado (mesmo padrão de segurança do validate_role_title() antigo: security
-- invoker, sem execute pra anon/authenticated, já que só lê public.cargos, que tem
-- select liberado por RLS pra qualquer autenticado).
create or replace function public.sync_and_validate_role_titles()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.role_titles is not null and exists (
    select 1 from unnest(new.role_titles) rt
    where not exists (select 1 from public.cargos where label = rt and is_active = true)
  ) then
    raise exception 'role_titles contém um cargo que não corresponde a um cargo ativo cadastrado';
  end if;

  new.role_title := array_to_string(coalesce(new.role_titles, '{}'::text[]), ', ');
  return new;
end;
$$;

revoke execute on function public.sync_and_validate_role_titles() from anon, authenticated;

create trigger sync_profiles_role_titles
  before insert or update of role_titles on public.profiles
  for each row execute function public.sync_and_validate_role_titles();

create trigger sync_team_members_role_titles
  before insert or update of role_titles on public.team_members
  for each row execute function public.sync_and_validate_role_titles();

-- Backfill único: garante que role_title já reflita role_titles pras linhas existentes
-- (o trigger só dispara em INSERT/UPDATE futuros).
update public.profiles set role_title = array_to_string(role_titles, ', ');
update public.team_members set role_title = array_to_string(role_titles, ', ');
