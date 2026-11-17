-- Despesa recorrente encerrada: não aparece a partir deste mês (1-12) do ano dela. Os meses antes continuam como estavam. Null = sem fim.
alter table public.financial_expenses add column if not exists ends_at_month smallint;
