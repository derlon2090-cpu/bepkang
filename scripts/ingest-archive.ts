import "dotenv/config";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, parse } from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { normalizePuzzleImage } from "../src/lib/image/processor";
import { solvePuzzle, visualSolutionSchema } from "../src/lib/ai/gemini-solver";
import { embedText } from "../src/lib/ai/reference-memory";
import { inferArchetype, PLAYBOOK } from "../src/lib/ai/competition-playbook";
import { getDb, closeDb } from "../src/lib/db";
import { referenceExamples } from "../src/lib/db/schema";

async function walk(dir: string): Promise<string[]> { const entries = await readdir(dir, { withFileTypes: true }); return (await Promise.all(entries.map((entry) => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]))).flat(); }
const execFileAsync = promisify(execFile);
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);

/** Renders PDFs to isolated PNG pages so PDFs and image-only folders share one ingestion path. */
async function renderPdf(pdf: string): Promise<{ folder: string; images: string[] }> {
  const folder = await mkdtemp(join(tmpdir(), "bebras-pdf-"));
  const prefix = join(folder, "page");
  try {
    await execFileAsync(process.env.PDFTOPPM_PATH ?? "pdftoppm", ["-png", "-r", "160", pdf, prefix]);
  } catch (error) {
    await rm(folder, { recursive: true, force: true });
    throw new Error(`تعذر تحويل PDF (${parse(pdf).base}). ثبّت Poppler أو عيّن PDFTOPPM_PATH. ${error instanceof Error ? error.message : String(error)}`);
  }
  return { folder, images: (await walk(folder)).filter((file) => extname(file).toLowerCase() === ".png").sort() };
}
async function main() {
  const folder = process.argv[2] ?? "./training-data"; const db = getDb(); if (!db) throw new Error("DATABASE_URL غير مضبوط.");
  const files = await walk(folder);
  const tempFolders: string[] = [];
  const images = files.filter((file) => imageExtensions.has(extname(file).toLowerCase()));
  for (const pdf of files.filter((file) => extname(file).toLowerCase() === ".pdf")) { const rendered = await renderPdf(pdf); tempFolders.push(rendered.folder); images.push(...rendered.images); }
  if (!images.length) { await closeDb(); console.log("لم يُعثر على صور أو ملفات PDF للاستيراد."); return; }
  try { for (const [index, file] of images.entries()) {
    const normalized = await normalizePuzzleImage(await readFile(file)); const jsonPath = join(parse(file).dir, `${parse(file).name}.json`); let solution;
    try { solution = visualSolutionSchema.parse(JSON.parse(await readFile(jsonPath, "utf8"))); } catch { solution = await solvePuzzle(normalized); }
    const signature = `${solution.competition}: ${solution.category}. ${solution.problemSummary}`; const archetype = inferArchetype(signature); const embedding = await embedText(signature); const imageHash = createHash("sha256").update(normalized.buffer).digest("hex");
    await db.insert(referenceExamples).values({ competition: solution.competition, category: solution.category, puzzlePatternDescription: solution.problemSummary, solvingStrategy: solution.verificationExplanation, thumbnailBase64: normalized.base64, verifiedStepsJson: solution, archetype, structuralSignature: signature, trapWarning: PLAYBOOK[archetype].traps, imageHash, embedding: embedding ?? undefined }).onConflictDoUpdate({ target: referenceExamples.imageHash, set: { verifiedStepsJson: solution, structuralSignature: signature, trapWarning: PLAYBOOK[archetype].traps, embedding: embedding ?? undefined } });
    console.log(`[${index + 1}/${images.length}] ${parse(file).base}`);
  } } finally { await Promise.all(tempFolders.map((dir) => rm(dir, { recursive: true, force: true }))); await closeDb(); }
  console.log(`تم استيراد ${images.length} مرجعًا.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
