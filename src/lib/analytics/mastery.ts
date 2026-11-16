import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { questions, skillMastery, userAttempts } from "@/lib/db/schema";

export type Readiness = { score: number; strongest: string | null; weakest: string | null; skills: Array<{ category: string; score: number }> };

/** More recent attempts receive a larger weight, making progress visible without hiding old mistakes. */
export async function recordAttempt(input: { userId: string; questionId: string; isCorrect: boolean; elapsedSeconds?: number }) {
  const db = getDb();
  if (!db) return null;
  const [question] = await db.select().from(questions).where(eq(questions.id, input.questionId)).limit(1);
  if (!question) throw new Error("السؤال غير موجود.");
  await db.insert(userAttempts).values({ ...input, isCorrect: input.isCorrect ? 1 : 0 });
  const attempts = await db.select({ isCorrect: userAttempts.isCorrect }).from(userAttempts).innerJoin(questions, eq(userAttempts.questionId, questions.id)).where(and(eq(userAttempts.userId, input.userId), eq(questions.category, question.category))).orderBy(desc(userAttempts.createdAt)).limit(30);
  const totalWeight = attempts.reduce((sum, _, index) => sum + Math.pow(.93, index), 0);
  const score = totalWeight ? Math.round(attempts.reduce((sum, attempt, index) => sum + attempt.isCorrect * Math.pow(.93, index), 0) / totalWeight * 100) : 0;
  const correctCount = attempts.filter((attempt) => attempt.isCorrect === 1).length;
  await db.insert(skillMastery).values({ userId: input.userId, category: question.category, attemptsCount: attempts.length, correctCount, masteryScore: score, lastPracticedAt: new Date() }).onConflictDoUpdate({ target: [skillMastery.userId, skillMastery.category], set: { attemptsCount: attempts.length, correctCount, masteryScore: score, lastPracticedAt: new Date() } });
  return { category: question.category, score };
}

export async function getReadiness(userId?: string): Promise<Readiness> {
  const db = getDb();
  if (!db || !userId) return { score: 0, strongest: null, weakest: null, skills: [] };
  const rows = await db.select({ category: skillMastery.category, score: skillMastery.masteryScore }).from(skillMastery).where(eq(skillMastery.userId, userId));
  const skills = rows.map((row) => ({ category: row.category, score: Math.round(row.score) }));
  const ordered = [...skills].sort((a, b) => a.score - b.score);
  return { score: skills.length ? Math.round(skills.reduce((sum, item) => sum + item.score, 0) / skills.length) : 0, strongest: ordered.at(-1)?.category ?? null, weakest: ordered[0]?.category ?? null, skills };
}
