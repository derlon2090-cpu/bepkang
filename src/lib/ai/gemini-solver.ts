import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { referenceExamples } from "@/lib/db/schema";
import { describeStructure, retrieveReferences } from "./reference-memory";
import { playbookContext } from "./competition-playbook";

const point = z.object({ x: z.number().min(0).max(1000), y: z.number().min(0).max(1000) });
const box = z.object({ ymin: z.number().min(0).max(1000), xmin: z.number().min(0).max(1000), ymax: z.number().min(0).max(1000), xmax: z.number().min(0).max(1000) });
export const visualSolutionSchema = z.object({
  competition: z.enum(["BEBRAS", "KANGAROO"]), category: z.string().min(1), problemSummary: z.string().min(1),
  socraticHints: z.array(z.string()).min(3).max(3),
  steps: z.array(z.object({
    stepNumber: z.number().int().positive(),
    actionBadge: z.string().min(1).max(24),
    instruction: z.string().min(1),
    stateAfterMove: z.string().min(1),
    annotationType: z.enum(["ARROW", "CIRCLE", "HIGHLIGHT_BOX", "SWAP"]),
    fromPoint: point.optional(),
    toPoint: point.optional(),
    box: box.optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })).min(1),
  constraintsVerification: z.array(z.object({
    rule: z.string().min(1),
    satisfied: z.boolean(),
    proof: z.string().min(1),
  })).min(1),
  finalAnswer: z.string().min(1), verificationExplanation: z.string().min(1),
}).refine((solution) => solution.constraintsVerification.every((check) => check.satisfied), {
  message: "لا يمكن إرجاع حل قبل أن تكون كل شروط اللغز متحققة.",
  path: ["constraintsVerification"],
});
export type VisualSolution = z.infer<typeof visualSolutionSchema>;

const prompt = `حلّل لغز بيبراس أو كانجارو في الصورة. أجب بالعربية. لا تخمّن إن كانت الصورة غير واضحة. أعطِ 3 تلميحات سقراطية تدريجية لا تكشف الإجابة.

قاعدة المعايرة البصرية الإلزامية: استخدم نظام إحداثيات مُطبّعًا لا علاقة له باتجاه اللغة. نقطة الأصل (0, 0) هي أعلى يسار الصورة؛ (1000, 1000) هي أسفل يمينها. محور x يزيد من اليسار إلى اليمين، ومحور y يزيد من الأعلى إلى الأسفل. كل صندوق يجب أن يُعاد حصراً بهذه الصيغة: [ymin, xmin, ymax, xmax]، حيث ymin ≤ ymax وxmin ≤ xmax. لا تعكس محور x بسبب واجهة RTL. يجب أن تشير رؤوس الأسهم ومراكز الدوائر إلى العنصر المرئي نفسه لا إلى النص المحيط به.

هذه صورة تحليل خاصة: الشبكة A–J و1–10 مرجع داخلي فقط ولا تظهر للمتعلم. استعملها للتحقق من موضع العنصر، لكن أعد دائماً الإحداثيات المطبعة 0–1000، لا أسماء الخلايا.

بوابة تحقق إلزامية قبل أي JSON — نفّذ حلقة «حل ← محاكاة ← تحقق» كاملة داخل التفكير واستخدم أداة Code Execution المتاحة لك عند الحاجة:
1. استخرج صراحة كل قاعدة مرئية: الهدف، الحركات الممنوعة والمسموحة، الحدود/العوائق، حد الحركات، وشرط الفوز. لا تهمل أي نص أو رمز في الصورة.
2. مثّل الحالة الابتدائية ثم حاكي تسلسل الحركات المقترح حركةً بحركة كتحولات حالة رسمية أو ببرنامج Python. سجّل الحالة الناتجة بعد كل حركة وتحقق من قانونية الحركة قبل الانتقال للتالية.
3. بعد الوصول للنهاية، افحص كل قاعدة مستخرجة مقابل الحالة النهائية والمسار (الوصول للهدف، عدد الحركات، عدم عبور الممنوعات وكل القيود). إذا فشل فحص واحد، أو لم يمكن إثباته من الصورة، ارجع وابحث عن مسار صحيح؛ لا تُصدر إجابة تبدو مؤكدة.

أعد constraintsVerification لكل قاعدة مستخرجة. يجب أن تحتوي كل خانة على rule وproof ملموس يشرح نتيجة المحاكاة، وأن تكون satisfied دائماً true. هذا الحقل بوابة خروج: أي false يعني أن JSON مرفوض.

أنشئ خطوات قصيرة مرتبطة بعناصر الصورة. لكل خطوة أعد stepNumber متسلسلاً، وactionBadge عربي قصير مثل «انقل» أو «بدّل»، وinstruction للحركة، وstateAfterMove يصف الحالة فوراً بعد الحركة. استخدم SWAP فقط عند تبديل عنصرين وحدد fromPoint وtoPoint؛ سيكون السهم ثنائي الاتجاه. استخدم لون hex واضحاً ومتمايزاً لكل مرحلة.`;

async function fewShotGuidance() {
  const db = getDb();
  if (!db) return "";
  try {
    const examples = await db.select({ competition: referenceExamples.competition, category: referenceExamples.category, pattern: referenceExamples.puzzlePatternDescription, strategy: referenceExamples.solvingStrategy, steps: referenceExamples.verifiedStepsJson })
      .from(referenceExamples).orderBy(desc(referenceExamples.createdAt)).limit(3);
    if (!examples.length) return "";
    return `\n\nأمثلة مرجعية موثّقة من المالك (استعمل المنهج الملائم فقط ولا تنسخ إجابة مثال إلى لغز مختلف):\n${examples.map((example, index) => `مثال ${index + 1} — ${example.competition}/${example.category}\nالنمط: ${example.pattern}\nالاستراتيجية: ${example.strategy}\nالخطوات الموثقة: ${JSON.stringify(example.steps)}`).join("\n\n")}`;
  } catch (error) {
    console.warn("Could not load training references", error);
    return "";
  }
}

export async function solvePuzzle(image: { base64: string; mimeType: string; analysisImage?: { base64: string; mimeType: string } }): Promise<VisualSolution> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("لم يتم ضبط GEMINI_API_KEY بعد. أضفه إلى ملف .env.local لتفعيل التحليل الحقيقي.");
  const client = new GoogleGenAI({ apiKey: key });
  const analysisImage = image.analysisImage ?? image;
  const structure = await describeStructure(analysisImage);
  const matched = await retrieveReferences(structure.signature, structure.archetype);
  const legacyReferences = matched.length ? "" : await fewShotGuidance();
  const references = matched.length ? `\n\nأمثلة موثقة قريبة بنيويًا:\n${matched.map((item, i) => `مرجع ${i + 1}: ${item.structuralSignature ?? item.puzzlePatternDescription}\nتحذير: ${item.trapWarning ?? "تحقق من كل قيد"}\nالحل: ${JSON.stringify(item.verifiedStepsJson)}`).join("\n\n")}` : legacyReferences;
  const enrichedPrompt = `${prompt}\n\nالبصمة البنيوية: ${structure.signature}\n${playbookContext(structure.archetype)}${references}`;
  const response = await client.models.generateContent({ model: "gemini-2.5-pro", contents: [{ role: "user", parts: [{ text: enrichedPrompt }, { inlineData: { mimeType: analysisImage.mimeType, data: analysisImage.base64 } }] }], config: { tools: [{ codeExecution: {} }], responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(visualSolutionSchema), thinkingConfig: { thinkingBudget: 8192 } } });
  return visualSolutionSchema.parse(JSON.parse(response.text ?? "{}"));
}
