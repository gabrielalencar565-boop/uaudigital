import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { withBase } from "@/lib/base";

export async function POST() {
  return new Response(null, {
    status: 303,
    headers: {
      Location: withBase("/admin"),
      "Set-Cookie": `${ADMIN_COOKIE}=; Path=${withBase("/admin")}; Max-Age=0; HttpOnly; SameSite=Lax`,
    },
  });
}
