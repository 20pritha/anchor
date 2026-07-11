import { fetchRecentEpisodes } from "@/lib/memory/neo4j";

export const runtime = "nodejs";

// Recent additions/changes to the knowledge base (newest episodes first).
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 30;

  try {
    const episodes = await fetchRecentEpisodes(limit);
    return Response.json({ episodes });
  } catch (err) {
    console.error("[api/recent] failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Could not read recent activity" },
      { status: 500 },
    );
  }
}
