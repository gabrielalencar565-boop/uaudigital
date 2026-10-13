-- Instagram "collab" posts: up to 3 public usernames invited when the publication goes out (feed, carousel and Reels).
alter table public.calendar_publications
  add column collaborators text[] not null default '{}',
  add constraint calendar_publications_collaborators_check
    check (cardinality(collaborators) <= 3 and array_to_string(collaborators, ',') ~ '^([a-z0-9._]{1,30}(,[a-z0-9._]{1,30}){0,2})?$');
