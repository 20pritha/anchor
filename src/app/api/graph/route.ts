import { fetchGraph } from "@/lib/memory/neo4j";

export const runtime = "nodejs";

// Whole-graph snapshot for the memory dashboard graph viewer.
export async function GET(): Promise<Response> {
  try {
    const graph = await fetchGraph();
    return Response.json(graph);
  } catch (err) {
    console.error("[api/graph] failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Could not read the graph" },
      { status: 500 },
    );
  }
}
