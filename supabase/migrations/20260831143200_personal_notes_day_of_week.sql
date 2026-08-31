alter table public.personal_notes
  add column day_of_week smallint check (day_of_week between 1 and 7);
comment on column public.personal_notes.day_of_week is 'ISO weekday (1=segunda .. 7=domingo) for the notes widget''s weekly kanban view. Null = not placed on any day (shows in the plain list).';
