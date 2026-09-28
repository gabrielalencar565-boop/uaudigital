-- Reforça no banco o que a UI já vai garantir (dropdown fechado): qualquer escrita de
-- role_title (inclusive fora da UI — import em massa, script, etc.) precisa bater com um
-- cargo ativo cadastrado. Null é permitido (perfil ainda sem cargo definido).
create or replace function public.validate_role_title()
returns trigger
language plpgsql
security definer
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

create trigger validate_profiles_role_title
  before insert or update of role_title on public.profiles
  for each row execute function public.validate_role_title();

create trigger validate_team_members_role_title
  before insert or update of role_title on public.team_members
  for each row execute function public.validate_role_title();

-- Corrige o único cadastro divergente encontrado ("Videomaker") antes da trigger acima
-- passar a exigir que role_title bata com a lista oficial de cargos.
update public.team_members set role_title = 'Editor de Vídeo' where role_title = 'Videomaker';
update public.profiles set role_title = 'Editor de Vídeo' where role_title = 'Videomaker';
