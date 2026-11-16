import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { referenceExamples } from "@/lib/db/schema";
import { inferArchetype, type Archetype } from "./competition-playbook";
import { rankByCosine } from "./similarity";
import { embedWithOpenAI } from "./provider-router";

export async function embedText(text: string) {
  if (process.env.OPENAI_API_KEY) return embedWithOpenAI(text);
  return null;
}

export async function describeStructure(_image: { base64: string; mimeType: string }) {
  const signature = "لغز بصري يحتاج تحليل بنيوي";
  return { signature, archetype: inferArchetype(signature) };
}

export async function retrieveReferences(signature: string, archetype: Archetype) {
  const db = getDb(); if (!db) return [];
  try {
    const embedding = await embedText(signature);
    if (embedding) {
      const references = await db.select().from(referenceExamples);
      const ranked = rankByCosine(references, embedding);
      if (ranked.length) return ranked;
    }
  } catch (error) { console.warn("Embedding retrieval unavailable; using archetype fallback", error); }
  try { return await db.select().from(referenceExamples).where(eq(referenceExamples.archetype, archetype)).limit(3); } catch { return []; }
}
