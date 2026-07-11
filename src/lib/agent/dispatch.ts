import { generateText } from "ai-sdk-ollama";
import { gemmaModel } from "@/lib/ollama";
import { queryMemory, getMedicationStatus, locateObject, listUpcoming } from "@/lib/memory/query";
import type { MedicationPeriod } from "@/lib/types";

const ANSWER_PROMPT = `You are Anchor, a calm and supportive memory companion for someone with mild cognitive impairment. Answer the user's question in one or two short sentences using ONLY the context provided below. Never sound clinical or corrective. If the context doesn't answer the question, say gently that you don't have a record of it yet.`;

async function composeAnswer(question: string, context: string): Promise<string> {
  const { text } = await generateText({
    model: gemmaModel,
    system: ANSWER_PROMPT,
    prompt: `Question: ${question}\n\nContext:\n${context}`,
    temperature: 0.3,
  });
  return text.trim();
}

function medicationPeriodFrom(q: string): MedicationPeriod {
  if (/\bmorning\b/.test(q)) return "morning";
  if (/\bafternoon\b/.test(q)) return "afternoon";
  if (/\bevening|night\b/.test(q)) return "evening";
  return "today";
}

/**
 * Deterministic fallback path (doc 10 B2): resolves the query with plain
 * pattern matching plus direct memory-function calls instead of Gemma's tool
 * calling loop, then asks Gemma only to phrase the final sentence from the
 * retrieved context. Used when `lib/agent/loop.ts`'s tool-calling path proves
 * unreliable (day-0 gate) or is disabled.
 */
export async function dispatchDeterministic(question: string): Promise<string> {
  const q = question.toLowerCase();

  if (/\bpill|medicat|dose|tablet\b/.test(q)) {
    const status = await getMedicationStatus(medicationPeriodFrom(q));
    const context = [
      `Medications: ${status.medications.map((m) => `${m.name} (${m.dose})`).join(", ") || "none on file"}`,
      `Recent episodes: ${status.recentEpisodes.map((e) => e.text).join("; ") || "none found"}`,
    ].join("\n");
    return composeAnswer(question, context);
  }

  const objectMatch = q.match(/\bwhere\s+(?:is|are)\s+my\s+([a-z\s]+?)(\?|$)/);
  if (objectMatch?.[1]) {
    const label = objectMatch[1].trim();
    const result = await locateObject(label);
    const context = [
      result.place ? `Last known location: ${result.place}` : "No known location on file.",
      `Recent episodes: ${result.recentEpisodes.join("; ") || "none found"}`,
    ].join("\n");
    return composeAnswer(question, context);
  }

  if (/\bupcoming|today|tomorrow|this week|schedule|plan\b/.test(q)) {
    const window = /\btomorrow\b/.test(q) ? "tomorrow" : /\bweek\b/.test(q) ? "this week" : "today";
    const upcoming = await listUpcoming(window);
    const context = upcoming.length
      ? upcoming.map((u) => `${u.label} at ${new Date(u.nextOccurrence).toLocaleString()}`).join("\n")
      : "Nothing scheduled in that window.";
    return composeAnswer(question, context);
  }

  const result = await queryMemory(question);
  return composeAnswer(question, result.blendedContext);
}
