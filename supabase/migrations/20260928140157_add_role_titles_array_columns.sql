-- Nova coluna array em ambas as tabelas -- vai virar a fonte da verdade pro cargo de
-- cada pessoa, permitindo mais de um cargo (role_title, hoje texto único, vira uma
-- coluna gerada derivada dela no próximo passo, mantendo os ~15 lugares que só exibem
-- o cargo funcionando sem nenhuma mudança de código).
alter table public.profiles add column role_titles text[] not null default '{}';
alter table public.team_members add column role_titles text[] not null default '{}';

update public.profiles
set role_titles = case when role_title is not null and role_title <> '' then array[role_title] else '{}'::text[] end;

update public.team_members
set role_titles = case when role_title is not null and role_title <> '' then array[role_title] else '{}'::text[] end;
