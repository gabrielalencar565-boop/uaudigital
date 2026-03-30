/**
 * Global avatar preloader — warms all avatar images once per session and
 * exposes a tiny in-memory store so Avatar components can render instantly
 * across navigations without duplicate network work.
 */

export type AvatarCacheStatus = "idle" | "loading" | "loaded" | "error";

const loaded = new Set<string>();
const failed = new Set<string>();
const inflight = new Map<string, Promise<string | undefined>>();
const resolvedSrc = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();

function notify(url: string) {
  listeners.get(url)?.forEach((listener) => listener());
}

function setResolved(url: string, src: string) {
  resolvedSrc.set(url, src);
  loaded.add(url);
  failed.delete(url);
  notify(url);
}

function setFailed(url: string) {
  failed.add(url);
  notify(url);
}

async function preloadViaFetch(url: string): Promise<string> {
  const response = await fetch(url, { cache: "force-cache", mode: "cors" });
  if (!response.ok) throw new Error(`Avatar preload failed: ${response.status}`);

  const blob = await response.blob();
  if (!blob.size) throw new Error("Avatar preload returned empty blob");

  return URL.createObjectURL(blob);
}

function preloadViaImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.decoding = "async";
    img.onload = () => resolve(url);
    img.onerror = () => reject(new Error("Avatar image preload failed"));
    img.src = url;
  });
}

/** Preload a single avatar URL into the shared cache */
export function preloadAvatar(url: string | null | undefined): Promise<string | undefined> {
  if (!url) return Promise.resolve(undefined);
  if (loaded.has(url)) return Promise.resolve(resolvedSrc.get(url) ?? url);
  if (inflight.has(url)) return inflight.get(url)!;

  notify(url);

  const request = (async () => {
    try {
      const cachedSrc = await preloadViaFetch(url).catch(() => preloadViaImage(url));
      setResolved(url, cachedSrc);
      return cachedSrc;
    } catch {
      setFailed(url);
      return undefined;
    }
  })();

  inflight.set(url, request);
  request.finally(() => {
    inflight.delete(url);
    notify(url);
  });

  return request;
}

/** Check if a URL has already been successfully preloaded */
export function isAvatarCached(url: string | undefined | null): boolean {
  return !!url && loaded.has(url);
}

export function getCachedAvatarSrc(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  return resolvedSrc.get(url);
}

export function getAvatarCacheStatus(url: string | undefined | null): AvatarCacheStatus {
  if (!url) return "idle";
  if (loaded.has(url)) return "loaded";
  if (failed.has(url)) return "error";
  if (inflight.has(url)) return "loading";
  return "idle";
}

export function subscribeToAvatar(url: string | undefined | null, listener: () => void) {
  if (!url) return () => {};

  const current = listeners.get(url) ?? new Set<() => void>();
  current.add(listener);
  listeners.set(url, current);

  return () => {
    const next = listeners.get(url);
    if (!next) return;
    next.delete(listener);
    if (next.size === 0) listeners.delete(url);
  };
}

/**
 * Preload avatar URLs in parallel.
 * Call this once after fetching team_members / profiles.
 */
export async function preloadAvatars(urls: (string | null | undefined)[]): Promise<void> {
  const unique = [...new Set(urls.filter((u): u is string => !!u))];
  if (!unique.length) return;
  await Promise.all(unique.map((url) => preloadAvatar(url)));
}
