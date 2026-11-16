import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 30;
const requestSchema = z.object({ image: z.object({ base64: z.string().min(1), mimeType: z.string().min(1) }), solution: z.record(z.string(), z.unknown()), history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(3000) })).max(12), question: z.string().min(1).max(1000) });
export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json()); const key = process.env.GEMINI_API_KEY;
    if (!key) return NextResponse.json({ error: "خدمة الشات غير مفعلة." }, { status: 503 });
    const client = new GoogleGenAI({ apiKey: key });
    const context = `أنت مساعد ألغاز عربي. أجب بدقة واختصار اعتمادًا فقط على الصورة والحل الموثق. إذا سأل المستخدم عن خطوة، اربط شرحك بإحداثيات وعناصر الصورة. الحل: ${JSON.stringify(body.solution)}\nالمحادثة: ${body.history.map((m) => `${m.role}: ${m.content}`).join("\n")}\nالسؤال: ${body.question}`;
    const response = await client.models.generateContent({ model: "gemini-2.5-flash", contents: [{ role: "user", parts: [{ text: context }, { inlineData: { data: body.image.base64, mimeType: body.image.mimeType } }] }], config: { thinkingConfig: { thinkingBudget: 2048 } } });
    return NextResponse.json({ answer: response.text ?? "تعذر تكوين إجابة الآن." });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر إرسال السؤال." }, { status: 400 }); }
}
