import { NextResponse } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { auth } from "@/auth";
import { sampleQuestions } from "@/lib/db/seed";
import { questions, skillMastery, type AgeGroup } from "@/lib/db/schema";

const validTracks = { bebras: "BEBRAS", kangaroo: "KANGAROO" } as const;
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const track = searchParams.get("track") as keyof typeof validTracks;
  const ageGroup = (searchParams.get("ageGroup") ?? "G5_6") as AgeGroup;
  const session = await auth();
  const userId = session?.user?.id;
  if (!validTracks[track]) return NextResponse.json({ error: "المسار غير صالح." }, { status: 400 });
  const db = getDb();
  if (!db) {
    const questionsForTrack = sampleQuestions.filter(([competition, group]) => competition === validTracks[track] && group === ageGroup).map(([, , category, prompt, answer], index) => ({ id: `demo-${track}-${ageGroup}-${index}`, category, prompt, answer }));
    return NextResponse.json({ questions: questionsForTrack, demo: true });
  }
  const mastery = userId ? await db.select().from(skillMastery).where(eq(skillMastery.userId, userId)) : [];
  const weakCategories = mastery.filter((item) => item.masteryScore < 65).sort((a, b) => a.masteryScore - b.masteryScore).map((item) => item.category);
  const filters = [eq(questions.competition, validTracks[track]), eq(questions.ageGroup, ageGroup)];
  const prioritized = weakCategories.length ? await db.select().from(questions).where(and(...filters, inArray(questions.category, weakCategories))).orderBy(asc(questions.category)).limit(5) : [];
  const fallback = prioritized.length >= 5 ? [] : await db.select().from(questions).where(and(...filters)).limit(5 - prioritized.length);
  return NextResponse.json({ questions: [...prioritized, ...fallback], demo: false });
}
