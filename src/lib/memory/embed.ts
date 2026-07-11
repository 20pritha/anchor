import { embed, embedMany } from "ai";
import { embeddingModel } from "@/lib/ollama";

// One embedder for both writes and read-queries (doc 10 B1) — embeddinggemma
// via Ollama, kept entirely local so episodic vector search never depends on
// the network. Never mix these vectors with a cloud embedder's output space.

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({ model: embeddingModel, value: text });
  return embedding;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const { embeddings } = await embedMany({ model: embeddingModel, values: texts });
  return embeddings;
}

/**
 * Graceful variant for paths that must degrade to graph-only results rather
 * than fail outright when Ollama is unreachable (doc 10 G5 fallback philosophy,
 * and what lets the memory-read/write paths keep working without a live model
 * — e.g. during development on a machine that doesn't run Ollama).
 */
export async function tryEmbedText(text: string): Promise<number[] | null> {
  try {
    return await embedText(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[embed] local embedding unavailable, degrading to graph-only: ${message}`);
    return null;
  }
}
