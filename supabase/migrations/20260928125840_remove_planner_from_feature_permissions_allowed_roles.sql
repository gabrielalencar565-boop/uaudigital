-- 'planner' não é mais atribuído a ninguém (migrado pro cargo "Social Media" +
-- user_roles limpo). Remove o valor morto de allowed_roles nas 5 permissões que o
-- carregavam -- o acesso continua idêntico, agora só via cargo.
update public.feature_permissions
set allowed_roles = array_remove(allowed_roles, 'planner')
where 'planner' = any(allowed_roles);
