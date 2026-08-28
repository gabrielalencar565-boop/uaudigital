-- Cronograma grid/list/feed cards only ever show a cover at a few hundred px, but Drive-
-- hosted originals are full-resolution phone photos (multi-MB) — serving those for a tiny
-- thumbnail is the real cause of the reported lag on clients with lots of posts (e.g.
-- Atacarejo Goiás). A prior attempt to resize on-the-fly in drive-file-proxy crashed
-- (WORKER_RESOURCE_LIMIT) decoding a large real photo in the resource-constrained edge
-- runtime, so the fix instead generates a small thumbnail client-side (browser canvas,
-- same approach already used for video posters) at upload time and stores it here,
-- uploaded straight to Supabase Storage (pm-attachments bucket) — no proxy, no server-side
-- decode. Nullable and additive: existing rows keep working unchanged via public_url.
alter table public.pm_attachments add column if not exists thumbnail_url text;
