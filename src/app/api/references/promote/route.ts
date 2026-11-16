import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { visualSolutionSchema } from "@/lib/ai/gemini-solver";
import { embedText } from "@/lib/ai/reference-memory";
import { inferArchetype, PLAYBOOK } from "@/lib/ai/competition-playbook";
import { getDb } from "@/lib/db";
import { referenceExamples } from "@/lib/db/schema";
import { z } from "zod";

export const runtime = "nodejs";
const bodySchema = z.object({ imageBase64: z.string().min(1), solution: visualSolutionSchema });
export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json()); const db = getDb();
    if (!db) return NextResponse.json({ error: "قاعدة المعرفة غير متاحة." }, { status: 503 });
    const signature = `${body.solution.competition}: ${body.solution.category}. ${body.solution.problemSummary}`;
    const archetype = inferArchetype(signature); const embedding = await embedText(signature); const imageHash = createHash("sha256").update(Buffer.from(body.imageBase64, "base64")).digest("hex");
    await db.insert(referenceExamples).values({ competition: body.solution.competition, category: body.solution.category, puzzlePatternDescription: body.solution.problemSummary, solvingStrategy: body.solution.verificationExplanation, verifiedStepsJson: body.solution, archetype, structuralSignature: signature, trapWarning: PLAYBOOK[archetype].traps, imageHash, embedding: embedding ?? undefined }).onConflictDoUpdate({ target: referenceExamples.imageHash, set: { verifiedStepsJson: body.solution, structuralSignature: signature, trapWarning: PLAYBOOK[archetype].traps, embedding: embedding ?? undefined } });
    return NextResponse.json({ ok: true });
  } catch (error) { console.error("Reference promotion failed", error); return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر اعتماد المرجع." }, { status: 400 }); }
}
