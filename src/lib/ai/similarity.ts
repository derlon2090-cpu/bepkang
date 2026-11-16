/** Exact cosine similarity for JSONB-stored embeddings. */
export function cosineSimilarity(left: readonly number[], right: readonly number[]) {
  if (!left.length || left.length !== right.length) return -1;
  let dot = 0; let leftMagnitude = 0; let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index]; const b = right[index];
    if (!Number.isFinite(a) || !Number.isFinite(b)) return -1;
    dot += a * b; leftMagnitude += a * a; rightMagnitude += b * b;
  }
  return leftMagnitude && rightMagnitude ? dot / Math.sqrt(leftMagnitude * rightMagnitude) : -1;
}

export function rankByCosine<T extends { embedding: number[] | null }>(items: readonly T[], query: readonly number[], limit = 3) {
  return items
    .map((item) => ({ item, score: item.embedding ? cosineSimilarity(item.embedding, query) : -1 }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item);
}
