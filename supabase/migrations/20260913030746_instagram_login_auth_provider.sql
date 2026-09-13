-- Migração dos clientes existentes é "aos poucos": toda linha atual de instagram_connections
-- foi conectada via Facebook Login + Página, então vira 'facebook_login' por padrão. Só as
-- conexões novas (via botão "Conectar" a partir de agora) usam 'instagram_login', que não
-- tem Página do Facebook nenhuma envolvida.
alter table public.instagram_connections
  add column auth_provider text not null default 'facebook_login';

alter table public.instagram_connections
  add constraint instagram_connections_auth_provider_check
  check (auth_provider in ('facebook_login', 'instagram_login'));

-- Conexões via Instagram Login não têm Página do Facebook.
alter table public.instagram_connections
  alter column facebook_page_id drop not null;

alter table public.instagram_oauth_states
  add column provider text not null default 'facebook_login';

alter table public.instagram_oauth_states
  add constraint instagram_oauth_states_provider_check
  check (provider in ('facebook_login', 'instagram_login'));
