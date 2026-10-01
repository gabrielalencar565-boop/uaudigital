drop policy "fin_clients_admin_all" on public.financial_clients;
create policy "fin_clients_admin_all" on public.financial_clients
  for all to public
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "fin_revenues_admin_all" on public.financial_revenues;
create policy "fin_revenues_admin_all" on public.financial_revenues
  for all to public
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "fin_expenses_admin_all" on public.financial_expenses;
create policy "fin_expenses_admin_all" on public.financial_expenses
  for all to public
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "fin_transactions_admin_all" on public.financial_transactions;
create policy "fin_transactions_admin_all" on public.financial_transactions
  for all to public
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "fin_goals_admin_all" on public.financial_goals;
create policy "fin_goals_admin_all" on public.financial_goals
  for all to public
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "fin_cards_admin_all" on public.financial_credit_cards;
create policy "fin_cards_admin_all" on public.financial_credit_cards
  for all to public
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "fin_opening_balance_admin_all" on public.financial_opening_balances;
create policy "fin_opening_balance_admin_all" on public.financial_opening_balances
  for all to public
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "mrr_movements_admin_all" on public.mrr_movements;
create policy "mrr_movements_admin_all" on public.mrr_movements
  for all to public
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));
