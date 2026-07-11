import { generateText } from "ai-sdk-ollama";
import { gemmaModel } from "@/lib/ollama";

// Called ONLY from the memory write pipeline (lib/memory/write.ts) — never
// from the read path (doc 10 B5). Filtering an inbound question buys nothing
// and adds a full model call to the latency-critical path.
const PII_FILTER_PROMPT = `You are a PII filter for a memory companion app. Given the text below, identify and remove:
- Government IDs, insurance numbers, account numbers
- Full street addresses and precise geolocation (keep coarse labels like "home", "clinic")
- Financial figures, card numbers
- Free-form medical diagnoses beyond medication name/purpose

KEEP: first names, relationship labels, medication names and schedules, place labels, object labels.

Return ONLY the filtered text, nothing else.`;

export async function piiFilter(text: string): Promise<string> {
  const { text: filtered } = await generateText({
    model: gemmaModel,
    system: PII_FILTER_PROMPT,
    prompt: text,
    temperature: 0,
  });
  return filtered.trim();
}
