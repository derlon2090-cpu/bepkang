import { NextResponse } from "next/server";
import { getReadiness } from "@/lib/analytics/mastery";
import { auth } from "@/auth";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ score: 0, strongest: null, weakest: null, skills: [] });
  return NextResponse.json(await getReadiness(session.user.id));
}
