import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { solvePuzzle, visualSolutionSchema } from "@/lib/ai/gemini-solver";
import { getDb } from "@/lib/db";
import { solvedPuzzlesCache } from "@/lib/db/schema";
import { normalizePuzzleImage } from "@/lib/image/processor";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");
    if (!(file instanceof File) || !file.type.startsWith("image/")) return NextResponse.json({ error: "ارفع ملف صورة صالحًا." }, { status: 400 });
    if (file.size > 4.5 * 1024 * 1024) return NextResponse.json({ error: "حجم الصورة أكبر من 4.5 ميغابايت، يرجى ضغطها ثم المحاولة." }, { status: 413 });
    const normalized = await normalizePuzzleImage(Buffer.from(await file.arrayBuffer()));
    const imageHash = createHash("sha256").update(normalized.buffer).digest("hex");
    const image = { base64: normalized.base64, mimeType: normalized.mimeType, width: normalized.width, height: normalized.height };
    const db = getDb();
    if (db) try {
      const cached = await db.select().from(solvedPuzzlesCache).where(eq(solvedPuzzlesCache.imageHash, imageHash)).limit(1);
      if (cached[0]) {
        const validated = visualSolutionSchema.safeParse(cached[0].solutionJson);
        if (validated.success) {
          void db.update(solvedPuzzlesCache).set({ hitCount: sql`${solvedPuzzlesCache.hitCount} + 1` }).where(eq(solvedPuzzlesCache.id, cached[0].id)).catch(() => undefined);
          return NextResponse.json({ image, solution: validated.data, cached: true });
        }
        // Schema evolved: remove the stale payload so it cannot crash the current UI.
        await db.delete(solvedPuzzlesCache).where(eq(solvedPuzzlesCache.id, cached[0].id));
      }
    } catch (cacheError) { console.warn("Cache lookup unavailable; continuing with Gemini", cacheError); }
    const solution = await solvePuzzle(normalized);
    if (db) try {
      await db.insert(solvedPuzzlesCache).values({ imageHash, competition: solution.competition, ageGroup: null, category: solution.category, naturalWidth: normalized.width, naturalHeight: normalized.height, solutionJson: solution }).onConflictDoUpdate({ target: solvedPuzzlesCache.imageHash, set: { competition: solution.competition, category: solution.category, naturalWidth: normalized.width, naturalHeight: normalized.height, solutionJson: solution } });
    } catch (cacheError) { console.warn("Could not persist solution cache", cacheError); }
    return NextResponse.json({ image, solution, cached: false });
  } catch (error) {
    console.error("Puzzle solve failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تحليل الصورة." }, { status: 500 });
  }
}
