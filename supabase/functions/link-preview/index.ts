import { corsHeaders } from "@supabase/supabase-js/cors";

// Simple in-memory cache (1h TTL)
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1h

function sanitizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function extractMeta(html: string, url: string) {
  const get = (property: string): string | null => {
    // Try og: first, then twitter:, then generic meta
    for (const attr of ["property", "name"]) {
      const re = new RegExp(
        `<meta[^>]+${attr}=["']${property}["'][^>]+content=["']([^"']+)["']`,
        "i"
      );
      const match = html.match(re);
      if (match) return match[1];
      // Also try reversed order (content before property)
      const re2 = new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${property}["']`,
        "i"
      );
      const match2 = html.match(re2);
      if (match2) return match2[1];
    }
    return null;
  };

  const title =
    get("og:title") ||
    get("twitter:title") ||
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
    null;

  const description =
    get("og:description") ||
    get("twitter:description") ||
    get("description") ||
    null;

  const image =
    get("og:image") ||
    get("twitter:image") ||
    null;

  const siteName = get("og:site_name") || null;

  const ogUrl = get("og:url") || url;

  // Detect platform
  let platform: string | null = null;
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname.includes("instagram.com")) platform = "instagram";
  else if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) platform = "youtube";
  else if (hostname.includes("twitter.com") || hostname.includes("x.com")) platform = "twitter";
  else if (hostname.includes("linkedin.com")) platform = "linkedin";
  else if (hostname.includes("tiktok.com")) platform = "tiktok";

  return {
    title: title?.trim() || null,
    description: description?.trim() || null,
    image: image || null,
    url: ogUrl,
    site_name: siteName,
    platform,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const reqUrl = new URL(req.url);
    const targetUrl = reqUrl.searchParams.get("url");

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: "Missing ?url= parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sanitized = sanitizeUrl(targetUrl);
    if (!sanitized) {
      return new Response(
        JSON.stringify({ error: "Invalid URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check cache
    const cached = cache.get(sanitized);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the page with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(sanitized, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LinkPreviewBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch URL", status: response.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return new Response(
        JSON.stringify({ error: "Not an HTML page" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Read only first 50KB to avoid memory issues
    const reader = response.body?.getReader();
    let html = "";
    const decoder = new TextDecoder();
    if (reader) {
      let totalBytes = 0;
      const MAX_BYTES = 50 * 1024;
      while (totalBytes < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        totalBytes += value.length;
      }
      reader.cancel();
    }

    const meta = extractMeta(html, sanitized);

    // Don't cache if no useful data
    if (meta.title || meta.image) {
      cache.set(sanitized, { data: meta, ts: Date.now() });
    }

    // Prune old cache entries periodically
    if (cache.size > 500) {
      const now = Date.now();
      for (const [key, val] of cache) {
        if (now - val.ts > CACHE_TTL) cache.delete(key);
      }
    }

    return new Response(JSON.stringify(meta), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
