import { executeLiveFunctionCall } from "@/lib/agent/liveToolExecutor";

export const runtime = "nodejs";

interface LiveToolCallBody {
  name?: string;
  args?: Record<string, unknown>;
}

// Called from components/LiveSession.ts (browser) when a Gemini Live session
// requests a function call — the browser can't import Node-only memory
// modules directly, so it forwards the call here and sends the result back
// over the Live session via session.sendToolResponse().
export async function POST(req: Request): Promise<Response> {
  let body: LiveToolCallBody;
  try {
    body = (await req.json()) as LiveToolCallBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name) {
    return Response.json({ error: "`name` is required" }, { status: 400 });
  }

  try {
    const response = await executeLiveFunctionCall(body.name, body.args ?? {});
    return Response.json({ response });
  } catch (err) {
    console.error("[api/live-tool-call] failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Tool execution failed" },
      { status: 500 },
    );
  }
}
