"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { referenceExamples } from "@/lib/db/schema";
import { visualSolutionSchema } from "@/lib/ai/gemini-solver";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function saveReferenceExample(form: FormData) {
  if (!await hasAdminSession()) redirect("/admin/codes");
  const db = getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة. أضف DATABASE_URL أولًا.");
  const competition = text(form, "competition");
  if (competition !== "BEBRAS" && competition !== "KANGAROO") throw new Error("اختر المسابقة.");
  const category = text(form, "category").slice(0, 120);
  const pattern = text(form, "pattern").slice(0, 2000);
  const strategy = text(form, "strategy").slice(0, 4000);
  if (!category || !pattern || !strategy) throw new Error("أكمل التصنيف والنمط والاستراتيجية.");
  let steps;
  try { steps = visualSolutionSchema.parse(JSON.parse(text(form, "verifiedSteps"))); }
  catch { throw new Error("صيغة JSON للخطوات غير صالحة أو لا تطابق مخطط الحل."); }
  const image = form.get("image");
  let thumbnailBase64: string | null = null;
  if (image instanceof File && image.size > 0) {
    if (!image.type.startsWith("image/") || image.size > 4.5 * 1024 * 1024) throw new Error("ارفع صورة صالحة بحجم أقل من 4.5 ميغابايت.");
    thumbnailBase64 = `data:${image.type};base64,${Buffer.from(await image.arrayBuffer()).toString("base64")}`;
  }
  await db.insert(referenceExamples).values({ competition, category, puzzlePatternDescription: pattern, solvingStrategy: strategy, thumbnailBase64, verifiedStepsJson: steps });
  revalidatePath("/admin/train-model");
}
