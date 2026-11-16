import dotenv from "dotenv";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getDb, closeDb } from "../src/lib/db";
import { referenceExamples, type VisualSolutionRecord } from "../src/lib/db/schema";
import { embedText } from "../src/lib/ai/reference-memory";
import { PLAYBOOK } from "../src/lib/ai/competition-playbook";
import { generateText } from "../src/lib/ai/provider-router";
dotenv.config({ path: ".env.local" });

const generatedPuzzleSchema = z.object({
  competition: z.enum(["BEBRAS", "KANGAROO"]),
  category: z.string().min(1),
  archetype: z.string().min(1),
  statement: z.string().min(30),
  layoutSpec: z.string().min(10),
  constraints: z.array(z.string().min(3)).min(1),
  intendedAnswer: z.string().min(1),
  solvingStrategy: z.string().min(20),
  trapWarning: z.string().min(5),
  socraticHints: z.array(z.string().min(3)).length(3),
});

const solverSchema = z.object({
  finalAnswer: z.string().min(1),
  verificationExplanation: z.string().min(20),
  constraintsVerified: z.boolean(),
  uniqueAnswer: z.boolean(),
});

type GeneratedPuzzle = z.infer<typeof generatedPuzzleSchema>;
const archetypes = Object.keys(PLAYBOOK);
const sleep = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
const isRateLimited = (error: unknown) => error instanceof Error && (error.message.includes("429") || error.message.includes("RESOURCE_EXHAUSTED"));

function normalizeAnswer(value: string) {
  return value.normalize("NFKC").replace(/[ـًٌٍَُِْ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function hashPuzzle(puzzle: GeneratedPuzzle, sourceType: string) {
  return createHash("sha256").update(sourceType + "\n" + puzzle.statement + "\n" + puzzle.intendedAnswer).digest("hex");
}

function toRecord(puzzle: GeneratedPuzzle, sourceType: string, verification: z.infer<typeof solverSchema>): VisualSolutionRecord {
  return {
    steps: [{ stepNumber: 1, actionBadge: "حلّل", instruction: puzzle.solvingStrategy, stateAfterMove: "الإجابة المتحققة: " + verification.finalAnswer, annotationType: "HIGHLIGHT_BOX", color: "#2563eb" }],
    socraticHints: puzzle.socraticHints,
    metadata: { sourceType, statement: puzzle.statement, layoutSpec: puzzle.layoutSpec, constraints: puzzle.constraints, intendedAnswer: puzzle.intendedAnswer, verification: verification.verificationExplanation },
  };
}

async function generate<T extends z.ZodType>(prompt: string, schema: T): Promise<z.infer<T>> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await sleep(4500);
    try {
      const parsed = JSON.parse(await generateText({ provider: "deepseek", prompt })) as unknown;
      const arrayPayload = Array.isArray(parsed) ? parsed : (parsed as { variations?: unknown; puzzles?: unknown; items?: unknown }).variations ?? (parsed as { puzzles?: unknown }).puzzles ?? (parsed as { items?: unknown }).items;
      return schema.parse(arrayPayload ?? parsed);
    } catch (error) {
      if (!isRateLimited(error) || attempt === 3) throw error;
      await sleep(4500 * 2 ** attempt);
    }
  }
  throw new Error("تعذر توليد استجابة صالحة.");
}

async function verify(puzzle: GeneratedPuzzle) {
  return generate([
    "أنت مراجع مستقل لألغاز بيبراس/كانجارو. حل اللغز التالي من الصفر.",
    "لا تعرف الإجابة التي اقترحها مولده. نفّذ محاكاة أو برهانًا رياضيًا داخليًا، وارفض اللغز إذا كان غامضًا أو له أكثر من إجابة.",
    "أعد فقط JSON يوضح الإجابة، البرهان، وأن جميع القيود متحققة وأن الإجابة وحيدة.",
    "النص: " + puzzle.statement,
    "المخطط البصري: " + puzzle.layoutSpec,
    "القيود: " + puzzle.constraints.join(" | "),
  ].join("\n"), solverSchema);
}

async function saveVerified(puzzle: GeneratedPuzzle, sourceType: "AUGMENTED" | "SELF_INVENTED") {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL غير مضبوط.");
  if (!archetypes.includes(puzzle.archetype)) throw new Error("نمط غير معروف: " + puzzle.archetype);
  const checked = await verify(puzzle);
  if (!checked.constraintsVerified || !checked.uniqueAnswer || normalizeAnswer(checked.finalAnswer) !== normalizeAnswer(puzzle.intendedAnswer)) return false;
  const signature = puzzle.competition + " | " + puzzle.archetype + " | " + puzzle.statement;
  const embedding = await embedText(signature);
  const imageHash = hashPuzzle(puzzle, sourceType);
  await db.insert(referenceExamples).values({
    competition: puzzle.competition, category: puzzle.category, puzzlePatternDescription: puzzle.statement, solvingStrategy: puzzle.solvingStrategy,
    verifiedStepsJson: toRecord(puzzle, sourceType, checked), archetype: puzzle.archetype, structuralSignature: signature, trapWarning: puzzle.trapWarning,
    imageHash, embedding: embedding ?? undefined, sourceType,
  }).onConflictDoUpdate({ target: referenceExamples.imageHash, set: {
    category: puzzle.category, puzzlePatternDescription: puzzle.statement, solvingStrategy: puzzle.solvingStrategy, verifiedStepsJson: toRecord(puzzle, sourceType, checked),
    archetype: puzzle.archetype, structuralSignature: signature, trapWarning: puzzle.trapWarning, embedding: embedding ?? undefined, sourceType,
  } });
  return true;
}

function variationPrompt(example: { puzzlePatternDescription: string; solvingStrategy: string; archetype: string | null; trapWarning: string | null }) {
  return [
    "أنشئ ثلاثة ألغاز عربية مستقلة ومختلفة جذريًا انطلاقًا من المرجع التالي. لا تنسخ نصه أو إجابته حرفيًا.",
    "النسخة 1: غيّر القصة والموضوع والصياغة فقط مع الحفاظ على الخوارزمية.",
    "النسخة 2: غيّر الأرقام أو حجم الشبكة أو طول التسلسل، ثم احسب إجابة جديدة صحيحة.",
    "النسخة 3: صمّم نسخة عكسية أو فخًا تربويًا يختبر التحذير المذكور.",
    "كل لغز يجب أن يكون قابلاً للحل من النص/المخطط، له جواب وحيد، وأن يحتوي مواصفة مرئية نصية قابلة للرسم.",
    "أعد مصفوفة JSON فقط، وكل عنصر يطابق المخطط المطلوب.",
    "النمط: " + (example.archetype ?? "GRID_PATHFINDING"),
    "وصف المرجع: " + example.puzzlePatternDescription,
    "استراتيجيته: " + example.solvingStrategy,
    "تحذيره: " + (example.trapWarning ?? "تحقق من كل قيد."),
  ].join("\n");
}

function inventionPrompt(index: number, archetype: string) {
  return [
    "ابتكر لغزًا عربيًا جديدًا كليًا بأسلوب بيبراس أو كانجارو، صالحًا لطلاب المدارس.",
    "يجب أن يكون غير مرتبط بأي لغز محفوظ، وله جواب وحيد مثبت، ومواصفة تخطيط مرئي نصية قابلة للرسم، وقيود صريحة.",
    "حل اللغز داخليًا بمحاكاة أو برهان قبل إرجاع JSON. اختر BEBRAS أو KANGAROO بما يناسبه.",
    "النمط الإلزامي: " + archetype,
    "معرف التنويع: " + index,
  ].join("\n");
}

async function main() {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY مطلوب للتدريب الذاتي.");
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL مطلوب للتدريب الذاتي.");
  const augment = process.argv.includes("--augment");
  const inventIndex = process.argv.indexOf("--invent");
  const inventCount = inventIndex >= 0 ? Number(process.argv[inventIndex + 1] ?? "10") : 0;
  if (!augment && !inventCount) throw new Error("الاستخدام: npm run train:self -- --augment | --invent <count>");
  if (!Number.isInteger(inventCount) || inventCount < 0) throw new Error("عدد --invent يجب أن يكون عددًا صحيحًا موجبًا.");
  let accepted = 0; let discarded = 0;
  try {
    if (augment) {
      const examples = await db.select({
        puzzlePatternDescription: referenceExamples.puzzlePatternDescription, solvingStrategy: referenceExamples.solvingStrategy,
        archetype: referenceExamples.archetype, trapWarning: referenceExamples.trapWarning,
      }).from(referenceExamples);
      for (const [index, example] of examples.entries()) {
        try {
          const variations = z.array(generatedPuzzleSchema).length(3).parse(await generate(variationPrompt(example), z.array(generatedPuzzleSchema).length(3)));
          for (const variation of variations) (await saveVerified(variation, "AUGMENTED")) ? accepted += 1 : discarded += 1;
          console.log("عولج مرجع " + (index + 1) + "/" + examples.length);
        } catch (error) { discarded += 3; console.warn("تعذر تعزيز مرجع " + (index + 1), error); }
      }
    }
    for (let index = 0; index < inventCount; index += 1) {
      try {
        const archetype = archetypes[index % archetypes.length];
        const puzzle = await generate(inventionPrompt(index + 1, archetype), generatedPuzzleSchema);
        (await saveVerified(puzzle, "SELF_INVENTED")) ? accepted += 1 : discarded += 1;
      } catch (error) { discarded += 1; console.warn("رُفض لغز مولّد " + (index + 1), error); }
    }
  } finally { await closeDb(); }
  console.log("اكتمل التدريب الذاتي: " + accepted + " محفوظ، " + discarded + " مرفوض.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
