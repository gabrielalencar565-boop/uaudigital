-- profiles.role_title agora também é editável pelo admin em Gestão de usuários (AdminPanel.tsx),
-- não só pela própria pessoa em Configurações. A política de UPDATE só liberava a própria
-- linha, então um admin editando o cargo de outra pessoa silenciosamente afetava 0 linhas
-- (Supabase não retorna erro quando um UPDATE bate 0 linhas por causa de RLS). team_members já
-- tinha esse mesmo "OR has_role(admin)" na sua política de UPDATE -- só faltava espelhar aqui.
alter policy "Users can update their own profile" on public.profiles
  using (((select auth.uid()) = user_id) or has_role((select auth.uid()), 'admin'::app_role));
