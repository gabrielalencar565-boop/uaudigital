update public.pm_projects set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.pm_subtasks set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.pm_comments set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.pm_attachments set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.pm_activity_log set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.pm_stage_flows set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.pm_cronograma_feedback set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.pm_tags set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
