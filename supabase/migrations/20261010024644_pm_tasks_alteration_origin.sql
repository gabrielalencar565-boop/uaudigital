-- De onde veio uma alteração: planejamento, design ou vídeo. Gravado quando a tarefa entra em "alteracoes" e nunca adivinhado
-- depois a partir do título ou das tags (era assim que uma alteração de design às vezes virava alteração de vídeo).
alter table public.pm_tasks add column if not exists alteration_origin text;
alter table public.pm_tasks drop constraint if exists pm_tasks_alteration_origin_check;
alter table public.pm_tasks add constraint pm_tasks_alteration_origin_check check (alteration_origin is null or alteration_origin in ('planejamento', 'design', 'video'));
