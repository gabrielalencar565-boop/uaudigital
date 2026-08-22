-- Byte-level cache for Drive-hosted media, so repeated views (any viewer, any session —
-- including the client opening the public approval link) skip Google Drive's own ~700ms-1s
-- per-request latency entirely after the first fetch. Complements drive_oauth_token_cache
-- (which only cut the auth round-trip, not the actual file-fetch latency).
--
-- Keyed by drive_file_id, which is immutable in this app's model: replacing an attachment's
-- media always deletes the row + Drive file and creates a new one with a new file id (see
-- deleteCoverImage / drive-delete), it never overwrites an existing file id's content — so
-- there's no cache-staleness risk from caching by this key indefinitely.
--
-- Private bucket, no RLS policies (default-deny for anon/authenticated) — only the
-- service-role client in drive-file-proxy/drive-delete should ever touch it, matching
-- drive_oauth_token_cache's security model.
insert into storage.buckets (id, name, public, file_size_limit)
values ('drive-media-cache', 'drive-media-cache', false, 209715200)
on conflict (id) do nothing;
