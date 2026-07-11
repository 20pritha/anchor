import { streamText } from "ai-sdk-ollama";
import { stepCountIs } from "ai";
import { gemmaModel } from "@/lib/ollama";
import { memoryTools } from "@/lib/agent/tools";

const MEMORY_ANSWER_SYSTEM = `You are Anchor, a calm and supportive memory companion for someone with mild cognitive impairment. Use the tools available to look up the user's memory before answering. Keep answers short — one or two sentences — warm, and never clinical or corrective. If you don't have a record of something, say so gently and offer to note it down.`;

// Capped well below the AI SDK default (isStepCount(20)) — the read path is
// latency-critical (doc 10 B4) and a couple of tool calls plus a final
// answer is enough for this tool set.
const MAX_STEPS = 4;

/**
 * Runs the Gemma tool-calling loop and returns a streaming Response — or
 * `null` if the model never produces a single chunk (e.g. Ollama
 * unreachable), so the caller can fall back to `dispatchDeterministic`
 * (doc 10 B2).
 *
 * This peek-first-chunk dance exists because `streamText()` resolves
 * successfully even when the underlying model call is doomed to fail —
 * confirmed empirically: the failure only surfaces once the stream is
 * consumed, and the plain `textStream` swallows it into a silent
 * zero-chunk completion rather than throwing. Reading one chunk manually
 * before committing to a Response lets a route handler detect that failure
 * and fall back, while still streaming the rest of a successful response
 * chunk-by-chunk rather than buffering the whole answer.
 */
export async function runMemoryAgent(question: string): Promise<Response | null> {
  const result = await streamText({
    model: gemmaModel,
    system: MEMORY_ANSWER_SYSTEM,
    prompt: question,
    tools: memoryTools,
    stopWhen: stepCountIs(MAX_STEPS),
  });

  const iterator = result.textStream[Symbol.asyncIterator]();
  const first = await iterator.next();
  if (first.done) {
    return null;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(first.value));
      try {
        for (;;) {
          const { value, done } = await iterator.next();
          if (done) break;
          controller.enqueue(encoder.encode(value));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
