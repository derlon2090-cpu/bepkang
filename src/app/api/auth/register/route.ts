import { NextResponse } from "next/server";

/** Email/password registration was intentionally replaced by private access codes. */
export async function POST() {
  return NextResponse.json({ error: "التسجيل يتم عبر كود دخول خاص." }, { status: 410 });
}
