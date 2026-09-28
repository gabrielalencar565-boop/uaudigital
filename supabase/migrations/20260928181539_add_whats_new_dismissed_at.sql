-- O "dispensar" do aviso "Novo!" no topo hoje só é salvo no localStorage do navegador --
-- frágil (modo privado, extensão limpando dados, troca de dispositivo faz reaparecer).
-- Move a fonte da verdade pro perfil da pessoa no banco, imune a essas variações e ainda
-- sincroniza entre dispositivos/navegadores da mesma conta.
alter table public.profiles add column whats_new_dismissed_at timestamptz null;
alter table public.team_members add column whats_new_dismissed_at timestamptz null;
