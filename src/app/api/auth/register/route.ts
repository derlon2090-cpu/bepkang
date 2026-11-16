import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
const bodySchema = z.object({ name: z.string().min(2).max(80), email: z.string().email(), password: z.string().min(8).max(128) });
export async function POST(request: Request) { try { const body = bodySchema.parse(await request.json()); const db = getDb(); if (!db) return NextResponse.json({ error: "التسجيل غير متاح قبل ضبط قاعدة البيانات." }, { status: 503 }); await db.insert(users).values({ name: body.name, displayName: body.name, email: body.email.toLowerCase(), passwordHash: await hash(body.password, 12) }); return NextResponse.json({ ok: true }, { status: 201 }); } catch { return NextResponse.json({ error: "تعذر إنشاء الحساب. قد يكون البريد مستخدمًا بالفعل." }, { status: 400 }); } }
