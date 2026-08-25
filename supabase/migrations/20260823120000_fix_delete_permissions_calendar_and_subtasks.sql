-- calendar_publications and pm_subtasks both already let any authenticated team member
-- SELECT and UPDATE (see calendar_publications_update_auth / pm_subtasks_update_combined) —
-- but DELETE was only reachable through the admin-only "_admin_all" policy, an outlier
-- inconsistent with every other permission on these two tables. In practice this meant a
-- non-admin clicking "Remover do calendário" (PublicationPreviewPanel) or deleting a subtask
-- silently did nothing — Postgres RLS filters a DELETE that matches zero rows without
-- raising an error, so the UI shows no failure and the row just reappears after refetch.
--
-- Brings DELETE in line with the SELECT/UPDATE policies already on these tables: any
-- authenticated team member, matching the app's existing baseline for day-to-day
-- content work (the same bar pm_tasks itself already uses for UPDATE).
create policy "calendar_publications_delete_auth" on calendar_publications
  for delete to authenticated
  using (auth.uid() is not null);

create policy "pm_subtasks_delete_auth" on pm_subtasks
  for delete to authenticated
  using (auth.uid() is not null);
