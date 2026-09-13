-- Consolida a personalização de logo em só 3 campos: sidebar_symbol_url (símbolo,
-- recolhido), sidebar_logo_url (tema claro) e sidebar_logo_dark_url (tema escuro). O campo
-- separado "logo_url" (tela de login) era redundante — a tela de login agora reaproveita
-- sidebar_logo_dark_url (seu painel é sempre escuro), e logo_shape nunca teve um controle
-- de verdade na UI viva do app (só existia num painel de configurações órfão).
alter table public.app_settings drop column if exists logo_url;
alter table public.app_settings drop column if exists logo_shape;
drop type if exists public.logo_shape_type;
