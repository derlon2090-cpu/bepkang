import "dotenv/config";
import { closeDb, getDb } from ".";
import { accessCodes, questions } from "./schema";

export const sampleQuestions = [
  ["BEBRAS", "G3_4", "الأنماط", "يكمل الروبوت النمط: أحمر، أزرق، أحمر، أزرق، ؟", "أحمر"], ["BEBRAS", "G5_6", "تتبع الخوارزميات", "يبدأ السهم شرقًا، ينعطف يمينًا مرتين ثم يسير خطوة. إلى أين يشير؟", "غربًا"], ["BEBRAS", "G7_8", "الشبكات", "ما أقل عدد من الوصلات لربط أربع جزر دون عزل أي جزيرة؟", "3 وصلات"], ["BEBRAS", "G9_10", "الترميز", "إذا استبدلنا كل حرف بالحرف التالي، فما ترميز ب؟", "ت"], ["BEBRAS", "G11_12", "الخوارزميات", "أي بنية بيانات تناسب آخر داخل أول خارج؟", "المكدس"],
  ["KANGAROO", "G3_4", "العد المنطقي", "لدى سارة 3 كرات ثم أعطاها أخوها كرتين. كم أصبحت؟", "5"], ["KANGAROO", "G5_6", "الهندسة", "كم ضلعًا لمضلع خماسي؟", "5"], ["KANGAROO", "G7_8", "الأنماط العددية", "ما العدد التالي: 2، 5، 8، 11، ؟", "14"], ["KANGAROO", "G9_10", "التوافقيات", "كم طريقة لاختيار طالبين من أربعة؟", "6"], ["KANGAROO", "G11_12", "الجبر", "إذا كان 2س + 4 = 12، فما س؟", "4"],
] as const;

/** Run after db:push. The unique indexes make repeated runs safe. */
export async function seedDatabase() {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL مطلوب لتشغيل البذر.");
  await db.insert(questions).values(sampleQuestions.map(([competition, ageGroup, category, prompt, answer]) => ({ competition, ageGroup, category, prompt, answer }))).onConflictDoNothing();
  const code = process.env.ACCESS_CODE;
  if (!code) throw new Error("ACCESS_CODE مطلوب لتشغيل البذر.");
  await db.insert(accessCodes).values({ code, label: "كود الدخول الرئيسي", maxUses: 1 }).onConflictDoNothing({ target: accessCodes.code });
  await closeDb();
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("src/lib/db/seed.ts")) {
  seedDatabase().then(() => console.log("تم بذر بنك الأسئلة وكود الدخول بنجاح.")).catch((error) => { console.error(error); process.exitCode = 1; });
}
