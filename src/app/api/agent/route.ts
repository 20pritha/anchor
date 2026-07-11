import { runMemoryAgent } from "@/lib/agent/loop";
import { dispatchDeterministic } from "@/lib/agent/dispatch";
import { resolveRouteForText } from "@/lib/router";

export const runtime = "nodejs";

interface AgentRequestBody {
  message?: string;
  /** "deterministic" bypasses Gemma tool-calling entirely — see doc 10 B2. */
  mode?: "tool-calling" | "deterministic";
}

async function fallbackToDeterministic(message: string): Promise<Response> {
  try {
    const answer = await dispatchDeterministic(message);
    return Response.json({ answer, fallback: true });
  } catch (fallbackErr) {
    console.error("[api/agent] deterministic fallback also failed:", fallbackErr);
    return Response.json({ error: "Local model is unreachable. Is Ollama running?" }, { status: 503 });
  }
}

export async function POST(req: Request): Promise<Response> {
  let body: AgentRequestBody;
  try {
    body = (await req.json()) as AgentRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return Response.json({ error: "`message` is required" }, { status: 400 });
  }

  const route = await resolveRouteForText(message);
  if (route === "cloud") {
    return Response.json(
      { error: "This question needs the cloud path — trigger the camera/live session from the UI." },
      { status: 501 },
    );
  }

  if (body.mode === "deterministic") {
    return fallbackToDeterministic(message);
  }

  try {
    const streamed = await runMemoryAgent(message);
    if (streamed) return streamed;
    console.warn("[api/agent] tool-calling path produced no output, falling back to deterministic dispatch");
  } catch (err) {
    console.error("[api/agent] tool-calling path failed, falling back to deterministic dispatch:", err);
  }

  return fallbackToDeterministic(message);
}
