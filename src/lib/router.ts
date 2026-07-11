import { generateText } from "ai-sdk-ollama";
import { gemmaModel } from "@/lib/ollama";
import { env } from "@/lib/config";
import type { RouteDecision } from "@/lib/types";

// Routing is primarily by input channel, not an LLM call (doc 10 B4/B9/B15):
// the UI already knows whether this is typed text (-> memory), a camera
// still-frame button (-> /api/perception), or the live-camera toggle
// (-> ephemeral Live token, browser connects directly). This resolver only
// matters for the rare ambiguous-text case, and is a no-op unless explicitly
// enabled.
const INTENT_ROUTER_PROMPT = `You are an intent router for a memory companion app. The user sent a text message (no camera involved). Classify it into exactly one of:

- "memory" — answerable from the user's local memory: people, medications, routines, past events, object locations.
- "cloud" — the question requires reasoning clearly beyond a simple memory lookup.

Respond with ONLY the classification word: "memory" or "cloud".`;

export async function resolveRouteForText(text: string): Promise<RouteDecision> {
  if (!env.USE_LLM_ROUTER) return "memory";

  try {
    const { text: raw } = await generateText({
      model: gemmaModel,
      system: INTENT_ROUTER_PROMPT,
      prompt: text,
      temperature: 0,
    });
    return raw.trim().toLowerCase().startsWith("cloud") ? "cloud" : "memory";
  } catch (err) {
    console.warn("[router] classification failed, defaulting to memory:", err);
    return "memory";
  }
}
