import { NextResponse } from "next/server";
import { z } from "zod";
import { generateText } from "@/lib/ai/provider-router";

export const runtime = "nodejs";
export const maxDuration = 30;
const requestSchema = z.object({ image: z.object({ base64: z.string().min(1), mimeType: z.string().min(1) }), solution: z.record(z.string(), z.unknown()), history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(3000) })).max(12), question: z.string().min(1).max(1000) });
export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const context = `أنت مساعد ألغاز عربي. أجب بدقة واختصار اعتمادًا فقط على الصورة والحل الموثق. إذا سأل المستخدم عن خطوة، اربط شرحك بإحداثيات وعناصر الصورة. الحل: ${JSON.stringify(body.solution)}\nالمحادثة: ${body.history.map((m) => `${m.role}: ${m.content}`).join("\n")}\nالسؤال: ${body.question}`;
    const answer = await generateText({ prompt: context, image: body.image });
    return NextResponse.json({ answer: answer || "تعذر تكوين إجابة الآن." });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر إرسال السؤال." }, { status: 400 }); }
}
