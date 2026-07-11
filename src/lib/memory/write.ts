import { after } from "next/server";
import { randomUUID } from "node:crypto";
import { piiFilter } from "@/lib/pii";
import { createEpisodeNode } from "@/lib/memory/neo4j";
import { tryEmbedText } from "@/lib/memory/embed";
import { upsertEpisodeVector } from "@/lib/memory/chroma";
import { inferNamespace } from "@/lib/memory/query";
import type { EpisodeNamespace, EpisodeSource } from "@/lib/types";

export interface WriteEpisodeInput {
  text: string;
  entityRefs?: string[];
  namespace?: EpisodeNamespace;
  source?: EpisodeSource;
  importance?: number;
}

async function writeEpisodeNow(input: WriteEpisodeInput): Promise<void> {
  const clean = await piiFilter(input.text);
  const namespace = input.namespace ?? inferNamespace(clean);
  const episode = {
    id: randomUUID(),
    text: clean,
    timestamp: Date.now(),
    importance: input.importance ?? 0.5,
    source: input.source ?? "voice_note",
    piiFiltered: true,
    entityRefs: input.entityRefs,
  };

  await createEpisodeNode(episode);

  const embedding = await tryEmbedText(clean);
  if (embedding) {
    await upsertEpisodeVector({ ...episode, namespace }, embedding);
  } else {
    console.warn(
      `[memory write] embedding unavailable — episode ${episode.id} stored in Neo4j only, ` +
        "not searchable via vector recall until embeddings are backfilled.",
    );
  }
}

/**
 * Fire-and-forget memory write, scheduled via Next.js `after()` so it
 * survives past the point the streamed response finishes (doc 10 B8 — a
 * bare `setTimeout` can be torn down with the request/response cycle).
 */
export function scheduleMemoryWrite(input: WriteEpisodeInput): void {
  after(() =>
    writeEpisodeNow(input).catch((err) => {
      console.error("[memory write] failed:", err);
    }),
  );
}

// Exported for the seed script and tests, where we want to await completion
// synchronously rather than schedule it for after a response.
export { writeEpisodeNow };
