import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "raiox_admin";

/** Token derivado da senha: trocar a ADMIN_PASSWORD derruba as sessões antigas. */
export function adminToken(): string | null {
  const pwd = process.env.ADMIN_PASSWORD;
  if (!pwd) return null;
  return createHmac("sha256", pwd).update("raiox-admin-v1").digest("hex");
}

export function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function isAdmin(): Promise<boolean> {
  const token = adminToken();
  if (!token) return false;
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  return !!value && safeEqual(value, token);
}
