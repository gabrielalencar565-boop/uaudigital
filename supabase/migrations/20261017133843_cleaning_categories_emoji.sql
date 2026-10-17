alter table public.cleaning_categories add column if not exists emoji text;
alter table public.cleaning_categories drop constraint if exists cleaning_categories_emoji_len;
alter table public.cleaning_categories add constraint cleaning_categories_emoji_len check (emoji is null or char_length(emoji) <= 16);
