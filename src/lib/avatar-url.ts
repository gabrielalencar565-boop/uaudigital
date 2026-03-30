const STORAGE_SIGN_SEGMENT = "/storage/v1/object/sign/";
const STORAGE_PUBLIC_SEGMENT = "/storage/v1/object/public/";
const AVATAR_WIDTH = 96;
const AVATAR_HEIGHT = 96;

function removeTokenParam(url: string) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("token");
    return parsed.toString();
  } catch {
    return url.replace(/([?&])token=[^&]*&?/i, "$1").replace(/[?&]$/, "");
  }
}

export function normalizeAvatarUrl(rawUrl: string | null | undefined): string | undefined {
  if (!rawUrl) return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;

  if (trimmed.includes(STORAGE_SIGN_SEGMENT)) {
    return removeTokenParam(trimmed.replace(STORAGE_SIGN_SEGMENT, STORAGE_PUBLIC_SEGMENT));
  }

  return trimmed;
}

export function optimizeAvatarUrl(rawUrl: string | null | undefined): string | undefined {
  const normalized = normalizeAvatarUrl(rawUrl);
  if (!normalized) return undefined;

  try {
    const parsed = new URL(normalized);
    if (parsed.pathname.includes(STORAGE_PUBLIC_SEGMENT)) {
      if (!parsed.searchParams.has("width")) parsed.searchParams.set("width", String(AVATAR_WIDTH));
      if (!parsed.searchParams.has("height")) parsed.searchParams.set("height", String(AVATAR_HEIGHT));
      if (!parsed.searchParams.has("quality")) parsed.searchParams.set("quality", "80");
      if (!parsed.searchParams.has("resize")) parsed.searchParams.set("resize", "cover");
    }
    return parsed.toString();
  } catch {
    return normalized;
  }
}

export function withAvatarCacheBuster(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("avatarcb", String(Date.now()));
    return parsed.toString();
  } catch {
    const joiner = url.includes("?") ? "&" : "?";
    return `${url}${joiner}avatarcb=${Date.now()}`;
  }
}
