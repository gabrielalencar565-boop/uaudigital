-- Novas chaves de feature_permissions que substituem o gate hardcoded em 'planner' por
-- algo configurável na tela Admin -> Permissões (por papel OU por cargo). Nascem com
-- allowed_roles={planner} e allowed_cargos={} para preservar exatamente o acesso de hoje;
-- o admin ajusta os cargos depois pela própria tela.
insert into public.feature_permissions (key, label, area, allowed_roles, allowed_cargos) values
  ('action_manage_tasks', 'Gerenciar tarefas da Agenda', 'Ações', '{planner}', '{}'),
  ('action_manage_publications', 'Criar publicações e calendários', 'Ações', '{planner}', '{}'),
  ('action_manage_projects', 'Criar projetos', 'Ações', '{planner}', '{}'),
  ('action_manage_tags', 'Editar/apagar tags', 'Ações', '{planner}', '{}'),
  ('action_manage_appeals', 'Ver/gerenciar recursos de tarefa', 'Ações', '{planner}', '{}')
on conflict (key) do nothing;
