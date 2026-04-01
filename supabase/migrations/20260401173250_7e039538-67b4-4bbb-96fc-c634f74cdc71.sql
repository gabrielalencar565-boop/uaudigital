
ALTER TABLE public.pm_comments
  ADD COLUMN image_url TEXT,
  ADD COLUMN image_description TEXT,
  ADD COLUMN link_url TEXT,
  ADD COLUMN link_title TEXT,
  ADD COLUMN link_image TEXT;
