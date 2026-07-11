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
export function getEpisodicCollection(): Promise<Collection> {
  if (!collectionPromise) {
    collectionPromise = getClient().getOrCreateCollection({
      name: CHROMA_COLLECTION,
      embeddingFunction: null,
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
