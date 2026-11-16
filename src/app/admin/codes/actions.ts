"use server";

import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminSession, hasAdminSession, isAdminSecret } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { accessCodes } from "@/lib/db/schema";

async function requireAdmin() { if (!await hasAdminSession()) redirect("/admin/codes"); }
const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function unlockAdmin(form: FormData) {
  if (!isAdminSecret(value(form, "secret"))) redirect("/admin/codes?error=invalid-secret");
  await createAdminSession(); redirect("/admin/codes");
}

export async function createCodes(form: FormData) {
  await requireAdmin();
  const db = getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة.");
  const label = value(form, "label").slice(0, 160) || null;
  const maxUses = Math.max(1, Math.min(10_000, Number(value(form, "maxUses")) || 1));
  const quantity = Math.max(1, Math.min(100, Number(value(form, "quantity")) || 1));
  const prefix = (value(form, "prefix") || "BEBRAS").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32);
  const rows = Array.from({ length: quantity }, () => ({ code: `${prefix}-${randomBytes(4).toString("hex").toUpperCase()}`, label, maxUses }));
  await db.insert(accessCodes).values(rows);
  revalidatePath("/admin/codes");
}

export async function toggleCode(form: FormData) {
  await requireAdmin();
  const id = value(form, "id"); const isActive = value(form, "isActive") === "true";
  const db = getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة.");
  await db.update(accessCodes).set({ isActive }).where(and(eq(accessCodes.id, id)));
  revalidatePath("/admin/codes");
}
