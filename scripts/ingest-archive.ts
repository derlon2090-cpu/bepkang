import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, parse } from "node:path";
import { createHash } from "node:crypto";
import { normalizePuzzleImage } from "../src/lib/image/processor";
import { solvePuzzle, visualSolutionSchema } from "../src/lib/ai/gemini-solver";
import { embedText } from "../src/lib/ai/reference-memory";
import { inferArchetype, PLAYBOOK } from "../src/lib/ai/competition-playbook";
import { getDb, closeDb } from "../src/lib/db";
import { referenceExamples } from "../src/lib/db/schema";

async function walk(dir: string): Promise<string[]> { const entries = await readdir(dir, { withFileTypes: true }); return (await Promise.all(entries.map((entry) => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]))).flat(); }
async function main() {
  const folder = process.argv[2]; if (!folder) throw new Error("الاستخدام: npm run train:ingest -- ./training-data"); const db = getDb(); if (!db) throw new Error("DATABASE_URL غير مضبوط.");
  const images = (await walk(folder)).filter((file) => [".png", ".jpg", ".jpeg", ".webp"].includes(extname(file).toLowerCase()));
  for (const [index, file] of images.entries()) {
    const normalized = await normalizePuzzleImage(await readFile(file)); const jsonPath = join(parse(file).dir, `${parse(file).name}.json`); let solution;
    try { solution = visualSolutionSchema.parse(JSON.parse(await readFile(jsonPath, "utf8"))); } catch { solution = await solvePuzzle(normalized); }
    const signature = `${solution.competition}: ${solution.category}. ${solution.problemSummary}`; const archetype = inferArchetype(signature); const embedding = await embedText(signature); const imageHash = createHash("sha256").update(normalized.buffer).digest("hex");
    await db.insert(referenceExamples).values({ competition: solution.competition, category: solution.category, puzzlePatternDescription: solution.problemSummary, solvingStrategy: solution.verificationExplanation, thumbnailBase64: normalized.base64, verifiedStepsJson: solution, archetype, structuralSignature: signature, trapWarning: PLAYBOOK[archetype].traps, imageHash, embedding: embedding ?? undefined }).onConflictDoUpdate({ target: referenceExamples.imageHash, set: { verifiedStepsJson: solution, structuralSignature: signature, trapWarning: PLAYBOOK[archetype].traps, embedding: embedding ?? undefined } });
    console.log(`[${index + 1}/${images.length}] ${parse(file).base}`);
  }
  await closeDb(); console.log(`تم استيراد ${images.length} مرجعًا.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
