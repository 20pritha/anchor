import { z } from "zod";
import { writeEpisodeNow } from "@/lib/memory/write";
import type { EpisodeSource } from "@/lib/types";

export const runtime = "nodejs";

const IngestSchema = z.object({
  text: z.string().min(1),
  /** "note" for a typed note, "upload" for file contents. */
  source: z.enum(["note", "upload"]).optional(),
  /** Optional label prepended to each chunk (e.g. a file name) for context. */
  title: z.string().optional(),
});

// Split free-form text into episode-sized chunks: paragraphs first, and long
// paragraphs further into sentences, so each stored memory is independently
// searchable. Empty/tiny fragments are dropped. Capped so one big paste can't
// spawn hundreds of (Gemma-filtered) writes.
const MAX_CHUNKS = 40;

function chunkText(text: string): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 3);

  const chunks: string[] = [];
  for (const para of paragraphs) {
    if (para.length <= 280) {
      chunks.push(para);
      continue;
    }
    const sentences = para.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) ?? [para];
    let buffer = "";
    for (const sentence of sentences) {
      if ((buffer + sentence).length > 280 && buffer) {
        chunks.push(buffer.trim());
        buffer = sentence;
      } else {
        buffer += sentence;
      }
    }
    if (buffer.trim()) chunks.push(buffer.trim());
  }
  return chunks.slice(0, MAX_CHUNKS);
}

// Unstructured-memory ingest for the memory dashboard: runs the same PII-filter
// + local-embed + Neo4j/Chroma write path as runtime notes, awaited so the UI
// can report how many memories were actually stored.
export async function POST(req: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = IngestSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  const { text, title } = parsed.data;
  const source: EpisodeSource = parsed.data.source ?? "note";
  const prefix = title?.trim() ? `[${title.trim()}] ` : "";
  const chunks = chunkText(text);

  if (chunks.length === 0) {
    return Response.json({ error: "No usable text found to store." }, { status: 400 });
  }

  let stored = 0;
  const errors: string[] = [];
  for (const chunk of chunks) {
    try {
      await writeEpisodeNow({ text: `${prefix}${chunk}`, source, importance: 0.5 });
      stored += 1;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "write failed");
    }
  }

  return Response.json({ ok: stored > 0, stored, total: chunks.length, errors });
}
