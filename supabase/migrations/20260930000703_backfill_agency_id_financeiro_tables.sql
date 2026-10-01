update public.financial_clients set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.financial_revenues set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.financial_expenses set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.financial_transactions set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.financial_goals set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.financial_credit_cards set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.financial_opening_balances set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.mrr_movements set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
