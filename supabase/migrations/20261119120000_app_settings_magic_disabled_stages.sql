-- Etapas do Magic Number que a agência deixou de contar (ex.: 'alteracoes'). Nada é apagado: as linhas de cada ciclo continuam
-- guardadas e voltam a contar quando a etapa é religada.
alter table public.app_settings add column if not exists magic_number_disabled_stages text[] not null default '{}';
