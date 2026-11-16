import { GoogleGenAI } from "@google/genai";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { referenceExamples } from "@/lib/db/schema";
import { inferArchetype, type Archetype } from "./competition-playbook";

export async function embedText(text: string) {
  const key = process.env.GEMINI_API_KEY; if (!key) return null;
  const response = await new GoogleGenAI({ apiKey: key }).models.embedContent({ model: "text-embedding-004", contents: text, config: { outputDimensionality: 768 } });
  return response.embeddings?.[0]?.values ?? null;
}

export async function describeStructure(image: { base64: string; mimeType: string }) {
  const key = process.env.GEMINI_API_KEY; if (!key) return { archetype: "GRID_PATHFINDING" as Archetype, signature: "لغز بصري غير مصنف" };
  const response = await new GoogleGenAI({ apiKey: key }).models.generateContent({ model: "gemini-2.5-flash", contents: [{ role: "user", parts: [{ text: "صف بنية اللغز في سطر عربي واحد: نوع الشبكة/العناصر/العلاقات/الهدف، دون حل." }, { inlineData: image }] }] });
  const signature = response.text?.trim() || "لغز بصري غير مصنف";
  return { signature, archetype: inferArchetype(signature) };
}

export async function retrieveReferences(signature: string, archetype: Archetype) {
  const db = getDb(); if (!db) return [];
  try {
    const embedding = await embedText(signature);
    if (embedding) return await db.select().from(referenceExamples).orderBy(sql`${referenceExamples.embedding} <=> ${JSON.stringify(embedding)}::vector`).limit(3);
  } catch (error) { console.warn("Vector retrieval unavailable; using archetype fallback", error); }
  try { return await db.select().from(referenceExamples).where(sql`${referenceExamples.archetype} = ${archetype}`).limit(3); } catch { return []; }
}
