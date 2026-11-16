import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { bootstrapDatabase } from "@/lib/db/bootstrap";

export const runtime = "nodejs";
function validSecret(value: string | null, secret: string | undefined) {
  if (!value || !secret) return false;
  const supplied = Buffer.from(value); const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

/** One-time recovery endpoint. Delete or disable it after the first successful call. */
export async function POST(request: Request) {
  if (!validSecret(request.headers.get("x-admin-secret"), process.env.ADMIN_SECRET)) return NextResponse.json({ error: "غير مصرح." }, { status: 401 });
  try { await bootstrapDatabase(); return NextResponse.json({ ok: true, message: "تمت مزامنة قاعدة البيانات وبذر البيانات الأساسية." }); }
  catch (error) { console.error("Bootstrap failed", error); return NextResponse.json({ error: error instanceof Error ? error.message : "فشلت التهيئة." }, { status: 500 }); }
}
