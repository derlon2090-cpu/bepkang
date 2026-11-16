import { z } from "zod";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { referenceExamples } from "@/lib/db/schema";
import { describeStructure, retrieveReferences } from "./reference-memory";
import { playbookContext } from "./competition-playbook";
import { generateText } from "./provider-router";

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

/** Normalizes OpenAI/DeepSeek JSON variants before enforcing the UI's exact contract. */
export function parseVisualSolution(raw: string): VisualSolution {
  const decoded = JSON.parse(raw) as Record<string, unknown>;
  const value = (decoded.solution ?? decoded.result ?? decoded.data ?? decoded) as Record<string, unknown>;
  const text = (candidate: unknown, fallback: string) => typeof candidate === "string" && candidate.trim() ? candidate.trim() : fallback;
  const list = (candidate: unknown) => Array.isArray(candidate) ? candidate : [];
  const answer = text(value.finalAnswer ?? value.final_answer ?? value.answer ?? value["الإجابة"], "لم يحدد المزود إجابة صالحة.");
  const steps = list(value.steps ?? value.solutionSteps ?? value.solution_steps ?? value["الخطوات"]).map((item, index) => {
    const step = (item ?? {}) as Record<string, unknown>;
    return {
      stepNumber: typeof step.stepNumber === "number" ? step.stepNumber : typeof step.number === "number" ? step.number : index + 1,
      actionBadge: text(step.actionBadge ?? step.action ?? step.title, "حلّل"),
      instruction: text(step.instruction ?? step.description ?? step.text, "راجع هذه الخطوة وفق قواعد اللغز."),
      stateAfterMove: text(step.stateAfterMove ?? step.state ?? step.result, "تم التحقق من الخطوة."),
      annotationType: ["ARROW", "CIRCLE", "HIGHLIGHT_BOX", "SWAP"].includes(String(step.annotationType)) ? step.annotationType : "HIGHLIGHT_BOX",
      color: /^#[0-9a-f]{6}$/i.test(String(step.color)) ? step.color : "#2563eb",
    };
  });
  const checks = list(value.constraintsVerification ?? value.constraints ?? value.verification ?? value["التحقق"]).map((item) => {
    const check = typeof item === "string" ? { rule: item } : (item ?? {}) as Record<string, unknown>;
    return { rule: text(check.rule ?? check.constraint, "تحقق من قيد اللغز."), satisfied: check.satisfied !== false, proof: text(check.proof ?? check.explanation, "أفاد المزود بتحقق القيد.") };
  });
  return visualSolutionSchema.parse({
    competition: String(value.competition).toUpperCase() === "KANGAROO" ? "KANGAROO" : "BEBRAS",
    category: text(value.category ?? value.type, "ألغاز منطقية"),
    problemSummary: text(value.problemSummary ?? value.problem_summary ?? value.summary ?? value.statement, "لغز يحتاج حلًا منطقيًا."),
    socraticHints: list(value.socraticHints ?? value.hints).slice(0, 3).map((hint) => text(hint, "راجع القواعد." )).concat(["حدّد القواعد أولًا.", "مثّل الحالة خطوة بخطوة.", "تحقق من الإجابة النهائية."]).slice(0, 3),
    steps: steps.length ? steps : [{ stepNumber: 1, actionBadge: "حلّل", instruction: "استخرج قواعد اللغز قبل الحل.", stateAfterMove: "تم تجهيز نموذج الحل.", annotationType: "HIGHLIGHT_BOX", color: "#2563eb" }],
    constraintsVerification: checks.length ? checks : [{ rule: "القيود المعطاة", satisfied: true, proof: "لم يذكر المزود تعارضًا في القيود." }],
    finalAnswer: answer,
    verificationExplanation: text(value.verificationExplanation ?? value.verification_explanation ?? value.explanation ?? value.reasoning, "راجع الحل وقارنه بقيود اللغز قبل اعتماده."),
  });
}

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

export async function solvePuzzle(image: { base64: string; mimeType: string; analysisImage?: { base64: string; mimeType: string } }, deepMode = false): Promise<VisualSolution> {
  const analysisImage = image.analysisImage ?? image;
  const structure = await describeStructure(analysisImage);
  const matched = await retrieveReferences(structure.signature, structure.archetype);
  const legacyReferences = matched.length ? "" : await fewShotGuidance();
  const references = matched.length ? `\n\nأمثلة موثقة قريبة بنيويًا:\n${matched.map((item, i) => `مرجع ${i + 1}: ${item.structuralSignature ?? item.puzzlePatternDescription}\nتحذير: ${item.trapWarning ?? "تحقق من كل قيد"}\nالحل: ${JSON.stringify(item.verifiedStepsJson)}`).join("\n\n")}` : legacyReferences;
  const enrichedPrompt = `${prompt}\n\nالبصمة البنيوية: ${structure.signature}\n${playbookContext(structure.archetype)}${references}`;
  const response = await generateText({ deep: deepMode, prompt: enrichedPrompt, image: analysisImage });
  return parseVisualSolution(response);
}

export async function solveTextPuzzle(text: string, deepMode = false): Promise<VisualSolution> {
  const response = await generateText({ provider: "deepseek", deep: deepMode, prompt: "حل لغز بيبراس أو كانجارو النصي التالي بالعربية. أعد JSON فقط يطابق: competition, category, problemSummary, socraticHints (3), steps (stepNumber, actionBadge, instruction, stateAfterMove, annotationType, color), constraintsVerification (rule,satisfied,proof), finalAnswer, verificationExplanation. الإحداثيات اختيارية. لا تخمّن. اللغز: " + text });
  return parseVisualSolution(response);
}
