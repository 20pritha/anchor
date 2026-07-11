import {
  findMedicationsForPeriod,
  locateObjectByLabel,
  listUpcomingRoutines,
  queryEntityByLabelOrName,
} from "@/lib/memory/neo4j";
import { tryEmbedText } from "@/lib/memory/embed";
import { queryEpisodicVectors } from "@/lib/memory/chroma";
import type {
  BlendedMemoryResult,
  EpisodeNamespace,
  MedicationPeriod,
  MedicationStatus,
} from "@/lib/types";

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Cheap keyword heuristic to scope vector search to the right namespace. */
export function inferNamespace(intent: string): EpisodeNamespace {
  const t = intent.toLowerCase();
  if (/\bpill|medicat|dose|tablet\b/.test(t)) return "episodic/medical";
  if (/\bkey|umbrella|glasses|object|where.*(is|are)\b/.test(t)) return "episodic/objects";
  if (/\bwho|visit|call|came over|daughter|neighbor|doctor\b/.test(t)) return "episodic/people";
  return "episodic/daily";
}

function windowToSince(window?: string): number | undefined {
  if (window === "today") return startOfToday();
  return undefined;
}

export async function queryMemory(
  intent: string,
  entity?: string,
  window?: string,
): Promise<BlendedMemoryResult> {
  const parts: string[] = [];

  let graph: BlendedMemoryResult["graph"];
  if (entity) {
    const graphSummary = await queryEntityByLabelOrName(entity);
    if (graphSummary) {
      graph = { summary: graphSummary };
      parts.push(`Graph data: ${graphSummary}`);
    }
  }

  const embedding = await tryEmbedText(intent);
  const episodes = embedding
    ? await queryEpisodicVectors({
        embedding,
        namespace: inferNamespace(intent),
        sinceEpochMs: windowToSince(window),
        nResults: 5,
      })
    : [];

  if (episodes.length > 0) {
    parts.push(`Relevant memories:\n${episodes.map((e) => `- ${e.text}`).join("\n")}`);
  }

  return {
    graph,
    episodes,
    blendedContext: parts.join("\n\n") || "No relevant information found in memory.",
  };
}

export async function getMedicationStatus(period: MedicationPeriod): Promise<MedicationStatus> {
  const [medications, embedding] = await Promise.all([
    findMedicationsForPeriod(period),
    tryEmbedText(`took ${period} medication`),
  ]);

  const recentEpisodes = embedding
    ? await queryEpisodicVectors({
        embedding,
        namespace: "episodic/medical",
        sinceEpochMs: startOfToday(),
        nResults: 3,
      })
    : [];

  return { medications, recentEpisodes };
}

export async function locateObject(
  label: string,
): Promise<{ place: string | null; lastSeen: string | null; recentEpisodes: string[] }> {
  const [graphResult, embedding] = await Promise.all([
    locateObjectByLabel(label),
    tryEmbedText(`where is my ${label}`),
  ]);

  const episodes = embedding
    ? await queryEpisodicVectors({ embedding, namespace: "episodic/objects", nResults: 3 })
    : [];

  return {
    place: graphResult?.place ?? null,
    lastSeen: graphResult?.lastSeen ?? null,
    recentEpisodes: episodes.map((e) => e.text),
  };
}

export async function listUpcoming(
  window: "today" | "tomorrow" | "this week",
): Promise<Array<{ label: string; nextOccurrence: string }>> {
  return listUpcomingRoutines(window);
}
