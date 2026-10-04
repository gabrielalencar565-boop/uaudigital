alter table public.instagram_report_links drop constraint instagram_report_links_period_days_check;
alter table public.instagram_report_links
  add constraint instagram_report_links_period_days_check check (period_days in (7, 15, 30, 60, 90));
