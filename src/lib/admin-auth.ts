import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "bebras_admin";

function signingKey() { return process.env.AUTH_SECRET ?? process.env.ADMIN_SECRET ?? ""; }
function signature(value: string) { return createHmac("sha256", signingKey()).update(value).digest("base64url"); }

export function isAdminSecret(value: string) {
  const expected = process.env.ADMIN_SECRET;
  if (!expected || !value) return false;
  const left = Buffer.from(expected); const right = Buffer.from(value);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function hasAdminSession() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value || !signingKey()) return false;
  const [payload, digest] = value.split(".");
  if (!payload || !digest) return false;
  const expected = signature(payload);
  const left = Buffer.from(digest); const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  return payload === "admin";
}

export async function createAdminSession() {
  (await cookies()).set(COOKIE, `admin.${signature("admin")}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
}
