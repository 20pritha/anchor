import { ChromaClient, type Collection, type Metadata, type Where } from "chromadb";
import { env, parseChromaUrl, CHROMA_COLLECTION } from "@/lib/config";
import type { Episode, EpisodeNamespace, EpisodicMatch } from "@/lib/types";

let client: ChromaClient | undefined;
let collectionPromise: Promise<Collection> | undefined;

function getClient(): ChromaClient {
  if (!client) {
    client = new ChromaClient(parseChromaUrl(env.CHROMA_URL));
  }
  return client;
}

// `embeddingFunction: null` explicitly disables Chroma's default embedder
// (which would otherwise try to download @chroma-core/default-embed) — we
// always supply our own vectors from the local embeddinggemma model.
export async function getEpisodicCollection(): Promise<Collection> {
  if (!collectionPromise) {
    // A Promise is truthy even when it later rejects, so a naive
    // `if (!collectionPromise)` cache would permanently poison itself on the
    // first transient ChromaDB failure (e.g. right after `docker compose up
    // -d`) — every later call would keep awaiting the same dead rejection
    // instead of retrying. Clear the cache on failure so the next call retries.
    collectionPromise = getClient()
      .getOrCreateCollection({ name: CHROMA_COLLECTION, embeddingFunction: null })
      .catch((err) => {
        collectionPromise = undefined;
        throw err;
      });
  }
  return collectionPromise;
}

/** Drops and recreates the episodic collection so re-seeding is idempotent (doc 08 M5). */
export async function resetEpisodicCollection(): Promise<void> {
  try {
    await getClient().deleteCollection({ name: CHROMA_COLLECTION });
  } catch {
    // Collection may not exist yet on a fresh ChromaDB instance — fine.
  }
  collectionPromise = undefined;
}

export interface EpisodeMetadata extends Metadata {
  namespace: EpisodeNamespace;
  timestamp: number;
  importance: number;
  source: string;
  piiFiltered: boolean;
  entityRefs: string[];
}

export async function upsertEpisodeVector(
  episode: Pick<Episode, "id" | "text" | "namespace" | "timestamp" | "importance" | "source" | "piiFiltered"> & {
    entityRefs?: string[];
  },
  embedding: number[],
): Promise<void> {
  const collection = await getEpisodicCollection();
  const metadata: EpisodeMetadata = {
    namespace: episode.namespace,
    timestamp: episode.timestamp,
    importance: episode.importance,
    source: episode.source,
    piiFiltered: episode.piiFiltered,
    entityRefs: episode.entityRefs ?? [],
  };
  await collection.upsert({
    ids: [episode.id],
    embeddings: [embedding],
    documents: [episode.text],
    metadatas: [metadata],
  });
}

export async function queryEpisodicVectors(opts: {
  embedding: number[];
  namespace?: EpisodeNamespace;
  sinceEpochMs?: number;
  nResults?: number;
}): Promise<EpisodicMatch[]> {
  const collection = await getEpisodicCollection();

  const clauses: Where[] = [];
  if (opts.namespace) clauses.push({ namespace: { $eq: opts.namespace } });
  if (opts.sinceEpochMs !== undefined) clauses.push({ timestamp: { $gte: opts.sinceEpochMs } });

  const where: Where | undefined =
    clauses.length === 0 ? undefined : clauses.length === 1 ? clauses[0] : { $and: clauses };

  const result = await collection.query({
    queryEmbeddings: [opts.embedding],
    nResults: opts.nResults ?? 5,
    where,
    include: ["metadatas", "documents", "distances"],
  });

  const rows = result.rows()[0] ?? [];
  return rows.map((row) => ({
    id: row.id,
    text: row.document ?? "",
    timestamp: (row.metadata as EpisodeMetadata | null)?.timestamp ?? 0,
    distance: row.distance ?? null,
    namespace: ((row.metadata as EpisodeMetadata | null)?.namespace ?? "episodic/daily") as EpisodeNamespace,
  }));
}

/**
 * Graceful variant that degrades to graph-only results on a ChromaDB outage,
 * mirroring lib/memory/embed.ts's tryEmbedText(). Without this, a Chroma
 * failure (distinct from an Ollama failure) propagates uncaught out of
 * queryMemory/getMedicationStatus/locateObject and gets misreported upstream
 * as "Local model is unreachable. Is Ollama running?" when the real cause is
 * ChromaDB.
 */
export async function tryQueryEpisodicVectors(
  opts: Parameters<typeof queryEpisodicVectors>[0],
): Promise<EpisodicMatch[]> {
  try {
    return await queryEpisodicVectors(opts);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[chroma] vector query unavailable, degrading to graph-only: ${message}`);
    return [];
  }
}
