import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const point = z.object({ x: z.number().min(0).max(1000), y: z.number().min(0).max(1000) });
const box = z.object({ ymin: z.number().min(0).max(1000), xmin: z.number().min(0).max(1000), ymax: z.number().min(0).max(1000), xmax: z.number().min(0).max(1000) });
export const visualSolutionSchema = z.object({
  competition: z.enum(["BEBRAS", "KANGAROO"]), category: z.string().min(1), problemSummary: z.string().min(1),
  socraticHints: z.array(z.string()).min(3).max(3),
  steps: z.array(z.object({ stepNumber: z.number().int().positive(), instruction: z.string().min(1), annotationType: z.enum(["ARROW", "CIRCLE", "HIGHLIGHT_BOX", "PATH"]), fromPoint: point.optional(), toPoint: point.optional(), box: box.optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) })).min(1),
  finalAnswer: z.string().min(1), verificationExplanation: z.string().min(1),
});
export type VisualSolution = z.infer<typeof visualSolutionSchema>;

const prompt = `حلّل لغز بيبراس أو كانجارو في الصورة. أجب بالعربية. لا تخمّن إن كانت الصورة غير واضحة. أعطِ 3 تلميحات سقراطية تدريجية لا تكشف الإجابة.

قاعدة المعايرة البصرية الإلزامية: استخدم نظام إحداثيات مُطبّعًا لا علاقة له باتجاه اللغة. نقطة الأصل (0, 0) هي أعلى يسار الصورة؛ (1000, 1000) هي أسفل يمينها. محور x يزيد من اليسار إلى اليمين، ومحور y يزيد من الأعلى إلى الأسفل. كل صندوق يجب أن يُعاد حصراً بهذه الصيغة: [ymin, xmin, ymax, xmax]، حيث ymin ≤ ymax وxmin ≤ xmax. لا تعكس محور x بسبب واجهة RTL. يجب أن تشير رؤوس الأسهم ومراكز الدوائر إلى العنصر المرئي نفسه لا إلى النص المحيط به.

أنشئ خطوات قصيرة مرتبطة بعناصر الصورة؛ استخدم لون hex واضحًا لكل خطوة.`;

export async function solvePuzzle(image: { base64: string; mimeType: string }): Promise<VisualSolution> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("لم يتم ضبط GEMINI_API_KEY بعد. أضفه إلى ملف .env.local لتفعيل التحليل الحقيقي.");
  const client = new GoogleGenAI({ apiKey: key });
  const response = await client.models.generateContent({ model: "gemini-2.5-pro", contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: image.mimeType, data: image.base64 } }] }], config: { responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(visualSolutionSchema), thinkingConfig: { thinkingBudget: 8192 } } });
  return visualSolutionSchema.parse(JSON.parse(response.text ?? "{}"));
}
