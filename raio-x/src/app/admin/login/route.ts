import { ADMIN_COOKIE, adminToken, safeEqual } from "@/lib/admin-auth";
import { withBase } from "@/lib/base";

/** Redireciona com caminho relativo, pra funcionar atrás do repasse da landing. */
const goTo = (path: string, cookie?: string) =>
  new Response(null, {
    status: 303,
    headers: { Location: withBase(path), ...(cookie ? { "Set-Cookie": cookie } : {}) },
  });

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const pwd = String(form?.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;
  const token = adminToken();
  if (!expected || !token || !safeEqual(pwd, expected)) {
    await new Promise((r) => setTimeout(r, 600)); // freia tentativa e erro
    return goTo("/admin?erro=1");
  }
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const cookie = `${ADMIN_COOKIE}=${token}; Path=${withBase("/admin")}; Max-Age=${60 * 60 * 12}; HttpOnly; SameSite=Lax${secure}`;
  return goTo("/admin", cookie);
}
