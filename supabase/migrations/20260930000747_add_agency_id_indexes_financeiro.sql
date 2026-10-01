create index if not exists financial_clients_agency_id_idx on public.financial_clients (agency_id);
create index if not exists financial_revenues_agency_id_idx on public.financial_revenues (agency_id);
create index if not exists financial_expenses_agency_id_idx on public.financial_expenses (agency_id);
create index if not exists financial_transactions_agency_id_idx on public.financial_transactions (agency_id);
create index if not exists financial_goals_agency_id_idx on public.financial_goals (agency_id);
create index if not exists financial_credit_cards_agency_id_idx on public.financial_credit_cards (agency_id);
create index if not exists financial_opening_balances_agency_id_idx on public.financial_opening_balances (agency_id);
create index if not exists mrr_movements_agency_id_idx on public.mrr_movements (agency_id);
