export interface LinkPreviewData {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string;
  site_name: string | null;
  platform: string | null;
}

const cache = new Map<string, LinkPreviewData | null>();

/** Extracts a YouTube video ID from any common URL shape (watch/shorts/youtu.be/embed). */
function getYoutubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const match = u.pathname.match(/^\/(shorts|embed|live)\/([^/]+)/);
      if (match) return match[2];
    }
  } catch { /* noop */ }
  return null;
}

/** YouTube's thumbnail CDN is far more reliable than scraping OG tags off the video page. */
function getYoutubeThumbnail(url: string): string | null {
  const id = getYoutubeVideoId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

/** Fetches OG metadata for a URL via the shared `link-preview` edge function (cached in-memory). */
export async function fetchLinkPreview(url: string): Promise<LinkPreviewData | null> {
  if (cache.has(url)) return cache.get(url) ?? null;
  const ytThumb = getYoutubeThumbnail(url);
  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const fnUrl = `https://${projectId}.supabase.co/functions/v1/link-preview?url=${encodeURIComponent(url)}`;
    const response = await fetch(fnUrl, { headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey } });
    if (!response.ok) throw new Error(`link-preview ${response.status}`);
    const data = (await response.json()) as LinkPreviewData;
    if (ytThumb && !data.image) data.image = ytThumb;
    if (!data.title && !data.image) { cache.set(url, null); return null; }
    cache.set(url, data);
    return data;
  } catch {
    // The page couldn't be scraped (blocked, timed out, etc.) — for YouTube we can still
    // show a thumbnail from its predictable CDN instead of no preview at all.
    if (ytThumb) {
      const fallback: LinkPreviewData = { title: null, description: null, image: ytThumb, url, site_name: "YouTube", platform: "youtube" };
      cache.set(url, fallback);
      return fallback;
    }
    cache.set(url, null);
    return null;
  }
}

export interface PlatformInfo {
  key: string;
  label: string;
}

/** Simple line-icon shape per platform (lucide-style, viewBox 0 0 24 24) — shared by every
 * place that renders a link pill, so raw-DOM builders and React components draw the same icon. */
export type IconChild = { tag: "path" | "circle" | "rect" | "polygon" | "text"; attrs: Record<string, string>; text?: string };

export const PLATFORM_ICON_PATHS: Record<string, IconChild[]> = {
  instagram: [
    { tag: "rect", attrs: { x: "3", y: "3", width: "18", height: "18", rx: "5" } },
    { tag: "circle", attrs: { cx: "12", cy: "12", r: "4" } },
    { tag: "circle", attrs: { cx: "17.3", cy: "6.7", r: "1.2", fill: "currentColor", stroke: "none" } },
  ],
  youtube: [
    { tag: "rect", attrs: { x: "2", y: "5", width: "20", height: "14", rx: "4" } },
    { tag: "polygon", attrs: { points: "10,9 16,12 10,15", fill: "currentColor", stroke: "none" } },
  ],
  twitter: [
    { tag: "path", attrs: { d: "M4 4l16 16" } },
    { tag: "path", attrs: { d: "M20 4 4 20" } },
  ],
  tiktok: [
    { tag: "circle", attrs: { cx: "7", cy: "17", r: "3" } },
    { tag: "path", attrs: { d: "M10 17V4l8 3v3" } },
  ],
  linkedin: [
    { tag: "rect", attrs: { x: "3", y: "3", width: "18", height: "18", rx: "4" } },
    { tag: "text", attrs: { x: "12", y: "16.5", "text-anchor": "middle", "font-size": "10", "font-weight": "700", fill: "currentColor", stroke: "none" }, text: "in" },
  ],
  "google-drive": [
    { tag: "path", attrs: { d: "M12 3 22 20H2Z" } },
  ],
  web: [
    { tag: "circle", attrs: { cx: "12", cy: "12", r: "9" } },
    { tag: "path", attrs: { d: "M3 12h18" } },
    { tag: "path", attrs: { d: "M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.5-4-9s1.5-6.5 4-9z" } },
  ],
};

const PLATFORMS: { test: RegExp; info: PlatformInfo }[] = [
  { test: /instagram\.com$/, info: { key: "instagram", label: "Instagram" } },
  { test: /(youtube\.com|youtu\.be)$/, info: { key: "youtube", label: "YouTube" } },
  { test: /(twitter\.com|x\.com)$/, info: { key: "twitter", label: "X" } },
  { test: /tiktok\.com$/, info: { key: "tiktok", label: "TikTok" } },
  { test: /linkedin\.com$/, info: { key: "linkedin", label: "LinkedIn" } },
  { test: /(drive|docs)\.google\.com$/, info: { key: "google-drive", label: "Google Drive" } },
];

/** Detects a well-known platform from a URL's hostname (no network call). */
export function detectPlatform(url: string): PlatformInfo {
  let hostname = "";
  try { hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { /* noop */ }
  const found = PLATFORMS.find((p) => p.test.test(hostname));
  if (found) return found.info;
  return { key: "web", label: hostname || url };
}

/** Strips the protocol/www for compact display, e.g. in an inline link chip. */
export function shortenUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/i, "");
}
