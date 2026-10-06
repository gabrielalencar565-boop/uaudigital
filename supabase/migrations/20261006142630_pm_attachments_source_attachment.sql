-- A feed/story photo is cropped to the Instagram format before it is published. The uncropped original is kept as its own
-- attachment (category "material") and linked here, so "Ajustar" can re-frame from the original instead of from the
-- already-cropped file.
alter table public.pm_attachments
  add column if not exists source_attachment_id uuid references public.pm_attachments(id) on delete set null;
create index if not exists pm_attachments_source_attachment_idx on public.pm_attachments (source_attachment_id) where source_attachment_id is not null;
