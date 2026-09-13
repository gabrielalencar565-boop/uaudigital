-- Cor principal da marca, configurável em Aparência — substitui o roxo #6932c9 hardcoded
-- que estava espalhado pelo sidebar, mobile bottom nav, avatar ring e botões "brand".
alter table public.app_settings add column brand_color text not null default '#6932c9';
