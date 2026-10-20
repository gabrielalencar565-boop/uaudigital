-- Horário opcional de entrega da tarefa (a data continua em due_date). Sem valor, a tarefa vale o dia inteiro.
alter table public.pm_tasks add column if not exists due_time time;
