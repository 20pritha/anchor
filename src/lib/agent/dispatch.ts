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
  if (/\b(evening|night)\b/.test(q)) return "evening";
  return "today";
}

// Matches letters, digits, apostrophes, and hyphens so labels like "iphone
// 12" or "step-counter" aren't silently dropped by an overly narrow class.
const OBJECT_QUERY_RE = /\bwhere\s+(?:is|are)\s+my\s+([a-z0-9'-]+(?:\s+[a-z0-9'-]+)*)(\?|$)/;

function matchObjectLabel(q: string): string | null {
  return OBJECT_QUERY_RE.exec(q)?.[1]?.trim() ?? null;
}

function scheduleWindowFrom(q: string): "today" | "tomorrow" | "this week" {
  if (/\btomorrow\b/.test(q)) return "tomorrow";
  if (/\bweek\b/.test(q)) return "this week";
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

  const label = matchObjectLabel(q);
  if (label) {
    const result = await locateObject(label);
    const context = [
      result.place ? `Last known location: ${result.place}` : "No known location on file.",
      `Recent episodes: ${result.recentEpisodes.join("; ") || "none found"}`,
    ].join("\n");
    return composeAnswer(question, context);
  }

  if (/\bupcoming|today|tomorrow|this week|schedule|plan\b/.test(q)) {
    const upcoming = await listUpcoming(scheduleWindowFrom(q));
    const context = upcoming.length
      ? upcoming.map((u) => `${u.label} at ${new Date(u.nextOccurrence).toLocaleString()}`).join("\n")
      : "Nothing scheduled in that window.";
    return composeAnswer(question, context);
  }

  const result = await queryMemory(question);
  return composeAnswer(question, result.blendedContext);
}

/**
 * Fast, model-free fallback (item #5): used when the Gemma tool-calling path
 * takes too long to produce a first token. Answers straight from vector/graph
 * search results instead of asking Gemma to compose a sentence — that
 * composition step is itself a call to the same slow model, so it wouldn't
 * actually be faster. Trades a slightly more literal answer for speed.
 */
export async function directSemanticAnswer(question: string): Promise<string> {
  const q = question.toLowerCase();

  if (/\bpill|medicat|dose|tablet\b/.test(q)) {
    const status = await getMedicationStatus(medicationPeriodFrom(q));
    if (status.medications.length > 0) {
      return `Your medications: ${status.medications.map((m) => `${m.name} (${m.dose})`).join(", ")}.`;
    }
    if (status.recentEpisodes.length > 0) return status.recentEpisodes[0]!.text;
    return "I don't have a medication record for that yet.";
  }

  const label = matchObjectLabel(q);
  if (label) {
    const result = await locateObject(label);
    if (result.place) return `Last known location: ${result.place}.`;
    if (result.recentEpisodes.length > 0) return result.recentEpisodes[0]!;
    return "I don't have a location on file for that yet.";
  }

  if (/\bupcoming|today|tomorrow|this week|schedule|plan\b/.test(q)) {
    const upcoming = await listUpcoming(scheduleWindowFrom(q));
    if (upcoming.length === 0) return "Nothing scheduled in that window.";
    return upcoming.map((u) => `${u.label} at ${new Date(u.nextOccurrence).toLocaleString()}`).join("; ");
  }

  const result = await queryMemory(question);
  if (result.episodes.length > 0) return result.episodes[0]!.text;
  if (result.graph) return result.graph.summary;
  return "I couldn't find anything about that yet.";
}
