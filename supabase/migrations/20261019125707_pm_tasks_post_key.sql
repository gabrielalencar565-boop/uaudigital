-- Liga as cópias de um mesmo post: quando uma etapa avança, a subtarefa é clonada para a próxima etapa. As cópias passam a guardar a chave
-- do post (o id da primeira cópia), para que um arquivo final colocado, trocado ou apagado numa etapa valha para todas as cópias.
-- Posts antigos ficam sem chave (null); a ligação vale daqui para frente.
alter table public.pm_tasks add column if not exists post_key uuid;
create index if not exists pm_tasks_post_key_idx on public.pm_tasks (post_key) where post_key is not null;
