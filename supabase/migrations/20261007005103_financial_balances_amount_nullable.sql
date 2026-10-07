-- O saldo inicial passa a poder ficar em branco (mês com só o saldo final informado); null = não informado.
alter table public.financial_opening_balances alter column amount drop not null;
alter table public.financial_opening_balances alter column amount drop default;
