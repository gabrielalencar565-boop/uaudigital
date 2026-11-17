-- Post agendado que ficou atrasado enquanto o Instagram do cliente estava desconectado: ao reconectar, fica "em espera" (o cron não publica)
-- até alguém escolher publicar, reagendar ou cancelar.
alter table public.calendar_publications add column if not exists instagram_hold boolean not null default false;
