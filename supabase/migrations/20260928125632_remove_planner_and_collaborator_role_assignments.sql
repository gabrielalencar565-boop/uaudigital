-- 'collaborator' nunca teve nenhuma política de RLS nem código no front dependendo dele
-- (confirmado por busca completa). 'planner' teve seu único uso real migrado pro cargo
-- "Social Media" na migration anterior. Remove as atribuições dessas duas linhas de todo
-- mundo -- ninguém perde acesso real (Ayrton continua admin; Bruna/Izadora/Teste mantêm
-- acesso via cargo).
delete from public.user_roles where role in ('planner', 'collaborator');
