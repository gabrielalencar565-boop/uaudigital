create table public.personal_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index personal_notes_user_id_updated_at_idx on public.personal_notes (user_id, updated_at desc);

alter table public.personal_notes enable row level security;

-- Purely personal scratch space (like the iPhone Notes app) — every policy is scoped to
-- the owner only, no team-wide visibility at all, unlike everything else in this app.
create policy "Users manage their own notes"
  on public.personal_notes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_personal_notes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger personal_notes_set_updated_at
  before update on public.personal_notes
  for each row execute function public.set_personal_notes_updated_at();
