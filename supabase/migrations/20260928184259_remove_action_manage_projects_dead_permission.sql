-- "Criar projetos" (action_manage_projects) não está ligada a nenhuma tela real: pm_projects
-- tem 0 linhas e nenhum código (frontend, edge function ou trigger) grava nela hoje --
-- sobrou da migração inicial do sistema de permissões, nunca ganhou uma tela de verdade.
-- Remove daqui pra não confundir; a política de RLS em pm_projects continua usando
-- has_feature_permission() e simplesmente volta a barrar todo mundo menos admin (mesmo
-- efeito de antes, sem precisar mexer na política -- é só um insert que ninguém dispara).
delete from public.feature_permissions where key = 'action_manage_projects';
