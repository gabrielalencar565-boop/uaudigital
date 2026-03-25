const STORAGE_SIGN_SEGMENT = "/storage/v1/object/sign/";
const STORAGE_PUBLIC_SEGMENT = "/storage/v1/object/public/";

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
