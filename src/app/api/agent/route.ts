import { runMemoryAgent } from "@/lib/agent/loop";
import { dispatchDeterministic, directSemanticAnswer } from "@/lib/agent/dispatch";
import { resolveRouteForText } from "@/lib/router";

export const runtime = "nodejs";

interface AgentRequestBody {
  message?: string;
  /** "deterministic" bypasses Gemma tool-calling entirely — see doc 10 B2. */
  mode?: "tool-calling" | "deterministic";
}

// If the local model hasn't produced a first token within this budget,
// stop waiting on it and answer straight from vector/graph search instead
// (item #5) — a caregiver companion shouldn't leave someone staring at a
// blank screen for a slow model.
const TOOL_CALLING_TIMEOUT_MS = 15_000;
const TIMED_OUT = Symbol("timed-out");

function timeoutAfter(ms: number): Promise<typeof TIMED_OUT> {
  return new Promise((resolve) => setTimeout(() => resolve(TIMED_OUT), ms));
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

async function fallbackToSemanticSearch(message: string): Promise<Response> {
  try {
    const answer = await directSemanticAnswer(message);
    return Response.json({ answer, fallback: "semantic-search" });
  } catch (fallbackErr) {
    console.error("[api/agent] semantic-search fallback also failed:", fallbackErr);
    return Response.json({ error: "Local memory search is unavailable right now." }, { status: 503 });
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
    const streamed = await Promise.race([runMemoryAgent(message), timeoutAfter(TOOL_CALLING_TIMEOUT_MS)]);
    if (streamed === TIMED_OUT) {
      console.warn(`[api/agent] tool-calling path exceeded ${TOOL_CALLING_TIMEOUT_MS}ms, using direct semantic search`);
      return fallbackToSemanticSearch(message);
    }
    if (streamed) return streamed;
    console.warn("[api/agent] tool-calling path produced no output, falling back to deterministic dispatch");
  } catch (err) {
    console.error("[api/agent] tool-calling path failed, falling back to deterministic dispatch:", err);
  }

  return fallbackToDeterministic(message);
}
