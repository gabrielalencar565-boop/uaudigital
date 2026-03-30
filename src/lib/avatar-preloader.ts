/**
 * Global avatar preloader — prefetches all team avatar images into the browser
 * cache so they render instantly when Avatar components mount.
 *
 * Uses a simple in-memory Set to avoid duplicate loads across navigations.
 */

const loaded = new Set<string>();
const inflight = new Map<string, Promise<void>>();

/** Preload a single avatar URL into the browser image cache */
function preloadOne(url: string): Promise<void> {
  if (loaded.has(url)) return Promise.resolve();
  if (inflight.has(url)) return inflight.get(url)!;

  const p = new Promise<void>((resolve) => {
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.onload = () => { loaded.add(url); resolve(); };
    img.onerror = () => { resolve(); }; // don't block on failures
    img.src = url;
  });

  inflight.set(url, p);
  p.finally(() => inflight.delete(url));
  return p;
}

/** Check if a URL has already been successfully preloaded */
export function isAvatarCached(url: string | undefined | null): boolean {
  return !!url && loaded.has(url);
}

/**
 * Preload an array of avatar URLs in parallel.
 * Call this once after fetching team_members / profiles.
 */
export function preloadAvatars(urls: (string | null | undefined)[]): void {
  const valid = urls.filter((u): u is string => !!u && !loaded.has(u));
  if (!valid.length) return;
  // Fire all in parallel — don't await (background task)
  valid.forEach(preloadOne);
}
