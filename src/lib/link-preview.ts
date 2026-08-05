export interface LinkPreviewData {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string;
  site_name: string | null;
  platform: string | null;
}

const cache = new Map<string, LinkPreviewData | null>();

/** Fetches OG metadata for a URL via the shared `link-preview` edge function (cached in-memory). */
export async function fetchLinkPreview(url: string): Promise<LinkPreviewData | null> {
  if (cache.has(url)) return cache.get(url) ?? null;
  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const fnUrl = `https://${projectId}.supabase.co/functions/v1/link-preview?url=${encodeURIComponent(url)}`;
    const response = await fetch(fnUrl, { headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey } });
    if (!response.ok) { cache.set(url, null); return null; }
    const data = (await response.json()) as LinkPreviewData;
    if (!data.title && !data.image) { cache.set(url, null); return null; }
    cache.set(url, data);
    return data;
  } catch {
    cache.set(url, null);
    return null;
  }
}

export interface PlatformInfo {
  key: string;
  label: string;
  emoji: string;
}

const PLATFORMS: { test: RegExp; info: PlatformInfo }[] = [
  { test: /instagram\.com$/, info: { key: "instagram", label: "Instagram", emoji: "📷" } },
  { test: /(youtube\.com|youtu\.be)$/, info: { key: "youtube", label: "YouTube", emoji: "▶️" } },
  { test: /(twitter\.com|x\.com)$/, info: { key: "twitter", label: "X", emoji: "✕" } },
  { test: /tiktok\.com$/, info: { key: "tiktok", label: "TikTok", emoji: "🎵" } },
  { test: /linkedin\.com$/, info: { key: "linkedin", label: "LinkedIn", emoji: "in" } },
  { test: /(drive|docs)\.google\.com$/, info: { key: "google-drive", label: "Google Drive", emoji: "📁" } },
];

/** Detects a well-known platform from a URL's hostname (no network call). */
export function detectPlatform(url: string): PlatformInfo {
  let hostname = "";
  try { hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { /* noop */ }
  const found = PLATFORMS.find((p) => p.test.test(hostname));
  if (found) return found.info;
  return { key: "web", label: hostname || url, emoji: "🌐" };
}

/** Strips the protocol/www for compact display, e.g. in an inline link chip. */
export function shortenUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/i, "");
}
