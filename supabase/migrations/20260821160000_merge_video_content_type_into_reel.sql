-- Instagram deprecated standalone feed "video" posts — everything non-carousel that's a
-- video is a Reels post now. This eliminates the separate "Vídeo" content_type/tag as a
-- distinct thing going forward, folding it into "reel" everywhere it's resolved.
--
-- The 'video' enum label itself is left in place (Postgres has no native DROP VALUE for
-- enums short of recreating the type, which isn't worth the risk here) — it just becomes
-- permanently unused: no code path assigns it anymore after this migration, and existing
-- rows are backfilled away from it below.

update calendar_publications set content_type = 'reel' where content_type = 'video';

create or replace function public.pm_resolve_content_type(p_tags text[], p_post_type text)
returns publication_content_type
language plpgsql
set search_path to 'public'
as $function$
DECLARE
  v_tag_name text;
  v_tag_content_type public.publication_content_type;
BEGIN
  v_tag_content_type := NULL;
  FOR v_tag_name IN SELECT split_part(unnest(p_tags), ':', 1) LOOP
    v_tag_content_type := CASE lower(v_tag_name)
      WHEN 'carrossel' THEN 'carrossel'::public.publication_content_type
      WHEN 'post' THEN 'post'::public.publication_content_type
      WHEN 'foto' THEN 'foto'::public.publication_content_type
      WHEN 'capa' THEN 'foto'::public.publication_content_type
      WHEN 'stories' THEN 'story'::public.publication_content_type
      WHEN 'story' THEN 'story'::public.publication_content_type
      WHEN 'vídeo curto' THEN 'reel'::public.publication_content_type
      WHEN 'video curto' THEN 'reel'::public.publication_content_type
      WHEN 'reels' THEN 'reel'::public.publication_content_type
      WHEN 'reel' THEN 'reel'::public.publication_content_type
      -- Tag "Vídeo" (purple) — every video format is Reels now, so this resolves the
      -- same as "Vídeo curto"/"Reels" instead of the old standalone 'video' type.
      WHEN 'vídeo' THEN 'reel'::public.publication_content_type
      WHEN 'video' THEN 'reel'::public.publication_content_type
      ELSE v_tag_content_type
    END;
    EXIT WHEN v_tag_content_type IS NOT NULL;
  END LOOP;

  IF v_tag_content_type IS NOT NULL THEN
    RETURN v_tag_content_type;
  END IF;

  -- p_post_type is the pipeline branch (design/planejamento/video), not a visual
  -- format, so only the 'video' pipeline branch maps unambiguously to a content_type on
  -- its own (as 'reel' now, same reasoning as the tag above); everything else needs a
  -- real tag (foto/post/carrossel/story/reel) to know what kind of post it actually is.
  RETURN CASE p_post_type
    WHEN 'reels' THEN 'reel'::public.publication_content_type
    WHEN 'carrossel' THEN 'carrossel'::public.publication_content_type
    WHEN 'post' THEN 'post'::public.publication_content_type
    WHEN 'foto' THEN 'foto'::public.publication_content_type
    WHEN 'video' THEN 'reel'::public.publication_content_type
    ELSE 'outro'::public.publication_content_type
  END;
END;
$function$;
