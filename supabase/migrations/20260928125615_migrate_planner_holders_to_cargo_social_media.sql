-- Os 4 usuários com o papel 'planner' hoje (Ayrton Lemos, Bruna Felix, Izadora Torres,
-- Teste) são todos cargo "Social Media". Adiciona esse cargo aos allowed_cargos das 5
-- permissões que hoje dependem de allowed_roles={planner}, preservando exatamente o
-- acesso de hoje antes de remover o papel 'planner' dessas pessoas.
update public.feature_permissions
set allowed_cargos = array(select distinct unnest(allowed_cargos || array['Social Media']))
where key in (
  'action_manage_tasks', 'action_manage_publications', 'action_manage_projects',
  'action_manage_tags', 'action_manage_appeals'
);
