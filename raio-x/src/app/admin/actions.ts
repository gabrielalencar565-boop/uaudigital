"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, adminToken, safeEqual } from "@/lib/admin-auth";

export async function login(formData: FormData) {
  const pwd = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;
  const token = adminToken();
  if (!expected || !token || !safeEqual(pwd, expected)) {
    await new Promise((r) => setTimeout(r, 600)); // freia tentativa e erro
    redirect("/admin?erro=1");
  }
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: 60 * 60 * 12,
  });
  redirect("/admin");
}

export async function logout() {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
  redirect("/admin");
}
