-- Mais de uma pessoa por freela: lista de {user_id, nome, valor}. operacional_valor continua sendo a soma (a parte da Uau é total - operacional_valor).
alter table public.financial_freelas add column if not exists operacionais jsonb not null default '[]'::jsonb;
update public.financial_freelas
set operacionais = jsonb_build_array(jsonb_build_object('user_id', operacional_user_id, 'nome', operacional_nome, 'valor', operacional_valor))
where operacionais = '[]'::jsonb and (operacional_user_id is not null or operacional_nome is not null or operacional_valor > 0);
