-- Post que foi publicado e depois apagado direto no Instagram: guarda quando, para o Cronograma mostrar "apagado no Instagram" e deixar escolher nova data.
alter table public.calendar_publications add column if not exists instagram_deleted_at timestamptz;
