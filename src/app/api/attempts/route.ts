import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAttempt } from "@/lib/analytics/mastery";
import { auth } from "@/auth";

const payloadSchema = z.object({ questionId: z.string().uuid(), isCorrect: z.boolean(), elapsedSeconds: z.number().int().nonnegative().optional() });

/** Auth middleware should derive userId from the session before exposing this route publicly. */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "سجّل الدخول لحفظ تقدمك." }, { status: 401 });
    const payload = payloadSchema.parse(await request.json());
    const result = await recordAttempt({ ...payload, userId: session.user.id });
    if (!result) return NextResponse.json({ error: "حفظ النتائج غير مفعّل حتى يتم ضبط DATABASE_URL." }, { status: 503 });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر حفظ المحاولة." }, { status: 400 });
  }
}
