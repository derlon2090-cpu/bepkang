import "dotenv/config";
import sharp from "sharp";
import { closeDb, getDb } from "../src/lib/db";
import { accessCodes, questions } from "../src/lib/db/schema";
import { normalizePuzzleImage } from "../src/lib/image/processor";

async function main() {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL غير مضبوط.");
  const [code] = await db.select({ code: accessCodes.code }).from(accessCodes).limit(1);
  const [question] = await db.select({ id: questions.id }).from(questions).limit(1);
  if (!code || !question) throw new Error("لم تُزرع الأكواد أو الأسئلة بعد.");
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY غير مضبوط.");
  const input = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#6657e8" } }).png().toBuffer();
  const image = await normalizePuzzleImage(input);
  if (image.mimeType !== "image/webp" || !image.buffer.length) throw new Error("فشل اختبار معالجة الصورة.");
  await closeDb();
  console.log(`تم التحقق: ${code.code}، سؤال موجود، وSharp يعمل (${image.width}×${image.height}).`);
}

main().catch(async (error) => { await closeDb(); console.error(error); process.exitCode = 1; });
