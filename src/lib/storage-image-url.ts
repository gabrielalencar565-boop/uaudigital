// Routes a Supabase Storage public URL through the image-transform endpoint
// (/render/image/public/) instead of the plain object endpoint (/object/public/).
//
// This exists because of a real incident: a batch of Storage objects (task covers, post
// thumbnails, etc.) ended up with the wrong stored content-type (a migration artifact —
// see git history around 2026-09), and Supabase's edge CDN cached the resulting bad
// response on the object endpoint for a long time, ignoring the object's own
// Cache-Control header. The underlying content-type has since been corrected in Storage
// metadata, but the object endpoint's cache stayed poisoned — the render endpoint is a
// separate cache that already reflects the fix. Same fix as optimizeAvatarUrl in
// avatar-url.ts, generalized for non-avatar images (task covers, post thumbnails).
const STORAGE_PUBLIC_SEGMENT = "/storage/v1/object/public/";
const STORAGE_RENDER_SEGMENT = "/storage/v1/render/image/public/";

export function toStorageRenderUrl(rawUrl: string | null | undefined): string | undefined {
  if (!rawUrl) return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;
  if (!trimmed.includes(STORAGE_PUBLIC_SEGMENT)) return trimmed;

  try {
    const parsed = new URL(trimmed);
    parsed.pathname = parsed.pathname.replace(STORAGE_PUBLIC_SEGMENT, STORAGE_RENDER_SEGMENT);
    // A width cap keeps the transform endpoint from being invoked with no resize at all
    // (some Supabase plans reject/ignore a transform request with no params) — 1600 is
    // comfortably above every thumbnail/card use in this app, so it's a no-op for quality.
    if (!parsed.searchParams.has("width")) parsed.searchParams.set("width", "1600");
    // Without an explicit resize mode, Supabase's transform only resizes the width and
    // leaves height at the ORIGINAL pixel value instead of scaling it proportionally —
    // a 1080x1080 source with just `?width=480` comes back 480x1080, stretched/cropped
    // wherever it's displayed (reported as thumbnails looking "zoomed in"). `contain`
    // scales both dimensions to fit the width while preserving the source's aspect ratio.
    if (!parsed.searchParams.has("resize")) parsed.searchParams.set("resize", "contain");
    return parsed.toString();
  } catch {
    return trimmed;
  }
}
