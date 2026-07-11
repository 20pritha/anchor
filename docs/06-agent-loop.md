# 06 — Agent Loop (Vercel AI SDK)

This is the core orchestration component: the agent loop built on the **Vercel AI SDK** that connects the Next.js API routes to Ollama (local Gemma 4), Neo4j, ChromaDB, and the Gemini Embedding API. Unlike the Android plan which required a custom ADK `Model` adapter, the Vercel AI SDK's built-in Ollama provider handles streaming and tool-calling protocol translation — no low-level adapter needed.

## Architecture

```
User input (text/camera frame)
       │
       ▼
┌─────────────────────────────────────────────────┐
│  POST /api/agent                                 │
│                                                   │
│  Vercel AI SDK Agent Loop (streamText + tool())   │
│                                                   │
│  1. System prompt + conversation history          │
│  2. PII filter call (Gemma 4 via Ollama)          │
│  3. Intent router call (Gemma 4 via Ollama)       │
│     → { route: "memory" | "local_perception" | "cloud" } │
│                                                   │
│  4a. MEMORY:                                      │
│      streamText with memory tools →               │
│        Gemma 4 generates tool calls →             │
│        AI SDK dispatches to Neo4j/ChromaDB        │
│        → text answer streamed back                │
│                                                   │
│  4b. LOCAL PERCEPTION:                            │
│      Send camera frame to Ollama vision API       │
│      → Gemma 4 describes the scene → answer       │
│                                                   │
│  4c. CLOUD:                                       │
│      Open Gemini Live WebSocket session           │
│      → stream camera+mic → reasoning → answer     │
│                                                   │
│  5. Async memory write (fire-and-forget):          │
│     Gemma 4 scores importance + extracts entities  │
│     → PII filter → Neo4j store                     │
│     → Gemini Embedding API → ChromaDB store        │
└─────────────────────────────────────────────────┘
       │
       ▼
Browser: display text + SpeechSynthesis speaks
```

## Agent loop implementation (TypeScript)

### Core loop pattern

```typescript
import { streamText, tool } from 'ai';
import { ollama } from '@ai-sdk/ollama';
import { z } from 'zod';

// Shared tool registry — same tools exposed to both local and cloud paths
const memoryTools = {
  queryMemory: tool({
    description: 'Query the local memory store for relevant context',
    parameters: z.object({
      intent: z.string().describe('What the user is asking about'),
      entity: z.string().optional().describe('Specific entity to look up'),
      window: z.string().optional().describe('Time window: "today", "this week", "all"'),
    }),
    execute: async ({ intent, entity, window }) => {
      // 1. Query Neo4j graph (exact entity/relationship lookups)
      const graphResults = await neo4jQuery(intent, entity, window);
      // 2. Query ChromaDB vector store (semantic episode search)
      const vectorResults = await chromaQuery(intent, entity, window);
      // 3. Blend results into a grounded context string
      return blendResults(graphResults, vectorResults);
    },
  }),

  recordEpisode: tool({
    description: 'Record a new episodic memory for future recall',
    parameters: z.object({
      text: z.string().describe('Natural-language summary of the event'),
      entityRefs: z.array(z.string()).optional().describe('Neo4j node IDs involved'),
    }),
    execute: async ({ text, entityRefs }) => {
      // Fire-and-forget: PII filter → Neo4j → embedding → ChromaDB
      scheduleAsyncMemoryWrite(text, entityRefs);
      return { success: true, message: 'Memory recorded' };
    },
  }),

  getMedicationStatus: tool({
    description: 'Check whether a medication was taken in a given period',
    parameters: z.object({
      period: z.enum(['morning', 'afternoon', 'evening', 'today']),
    }),
    execute: async ({ period }) => {
      // Query Neo4j for TAKES edge + ChromaDB episodic/medical
      return checkMedicationStatus(period);
    },
  }),

  locateObject: tool({
    description: 'Find the last known location of an object',
    parameters: z.object({
      label: z.string().describe('Object name, e.g. "keys", "umbrella"'),
    }),
    execute: async ({ label }) => {
      // Neo4j: Object -LOCATED_AT-> Place
      // ChromaDB: recent episodic/objects mentioning this label
      return locateObject(label);
    },
  }),

  listUpcoming: tool({
    description: 'List upcoming routines, visits, and events',
    parameters: z.object({
      window: z.string().describe('Time window: "today", "tomorrow", "this week"'),
    }),
    execute: async ({ window }) => {
      // Neo4j: routines + people visits for the time window
      return listUpcomingEvents(window);
    },
  }),
};
```

### Handling the local path

For a memory query (the common case):

```typescript
export async function POST(req: Request) {
  const { messages } = await req.json();

  // Step 1: PII filter (local Gemma via Ollama)
  const piiResult = await ollama.chat({
    model: 'gemma4:12b',
    messages: [
      { role: 'system', content: PII_FILTER_PROMPT },
      ...messages,
    ],
  });

  // Step 2: Intent routing (local Gemma via Ollama)
  const route = await intentRouter(piiResult.message.content);

  if (route === 'memory') {
    // Step 3a: Stream answer with memory tools
    const result = streamText({
      model: ollama('gemma4:12b'),
      system: MEMORY_ANSWER_PROMPT,
      messages: [{ role: 'user', content: piiResult.message.content }],
      tools: memoryTools,
      maxSteps: 5, // allow multi-turn tool calling
    });

    return result.toTextStreamResponse();
  }

  if (route === 'local_perception') {
    // Step 3b: Single-shot vision via Ollama
    return handleLocalPerception(piiResult.message.content);
  }

  if (route === 'cloud') {
    // Step 3c: Gemini Live streaming via @google/genai
    return handleCloudPath(piiResult.message.content);
  }
}
```

### Handling the cloud path (Gemini Live)

```typescript
import { GoogleGenAI } from '@google/genai';

async function handleCloudPath(userInput: string) {
  // Open WebSocket to Gemini Live API
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const liveSession = await ai.live.connect({
    model: 'gemini-2.0-flash-live-preview', // or latest live model
    config: {
      responseModalities: ['TEXT'], // text only; audio is via Web Speech API
      systemInstruction: { parts: [{ text: CLOUD_PATH_PROMPT }] },
      tools: memoryTools, // share the same tool registry
    },
  });

  // Stream camera + mic to Gemini Live
  // Receive streamed responses → forward to browser
  // See @google/genai docs for WebSocket streaming details
}
```

## PII filter

The PII filter is a lightweight prompt to Gemma 4 via Ollama:

```typescript
const PII_FILTER_PROMPT = `You are a PII filter. Given the text below, identify and remove:
- Government IDs, insurance numbers, account numbers
- Full street addresses and precise geolocation (keep coarse labels like "home", "clinic")
- Financial figures, card numbers
- Free-form medical diagnoses beyond medication name/purpose

KEEP: first names, relationship labels, medication names and schedules, place labels, object labels.

Return ONLY the filtered text, nothing else.`;

async function piiFilter(text: string): Promise<string> {
  const response = await ollama.chat({
    model: 'gemma4:12b',
    messages: [
      { role: 'system', content: PII_FILTER_PROMPT },
      { role: 'user', content: text },
    ],
  });
  return response.message.content;
}
```

## Intent router

The intent router classifies the incoming request into one of three paths:

```typescript
const INTENT_ROUTER_PROMPT = `You are an intent router for a memory companion app. Classify the user's request into exactly one of:

- "memory" — the user is asking about their life: people, medications, routines, past events, locations of objects. Answerable from the local memory store.
- "perception" — the user is asking about something they're looking at now (single image/frame). Answerable by local Gemma 4 vision.
- "cloud" — the user needs real-time streaming video/audio analysis, or the question requires reasoning beyond the local model's capabilities.

Respond with ONLY the classification word: "memory", "perception", or "cloud".`;

async function intentRouter(text: string): Promise<'memory' | 'perception' | 'cloud'> {
  const response = await ollama.chat({
    model: 'gemma4:12b',
    messages: [
      { role: 'system', content: INTENT_ROUTER_PROMPT },
      { role: 'user', content: text },
    ],
    options: { temperature: 0 }, // deterministic
  });
  return response.message.content.trim().toLowerCase() as any;
}
```

## Async memory write pipeline

After the answer is delivered, the interaction is written to memory asynchronously:

```typescript
async function scheduleAsyncMemoryWrite(text: string, entityRefs?: string[]) {
  // Fire and forget — never blocks the response
  setTimeout(async () => {
    // 1. PII filter
    const cleanText = await piiFilter(text);

    // 2. Store in Neo4j as Episode node
    const episodeId = await neo4jCreateEpisode(cleanText, entityRefs);

    // 3. Generate embedding via Gemini API
    const embedding = await generateEmbedding(cleanText);

    // 4. Store in ChromaDB
    await chromaStoreEpisode(episodeId, cleanText, embedding, entityRefs);
  }, 0);
}
```

## Streaming to TTS

Text deltas are streamed from the Vercel AI SDK directly to the Web Speech API:

```typescript
// Browser-side: receive streaming response
const response = await fetch('/api/agent', {
  method: 'POST',
  body: JSON.stringify({ messages }),
});

// Stream text to display + TTS
const reader = response.body.getReader();
const utterance = new SpeechSynthesisUtterance();
let partialText = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const text = new TextDecoder().decode(value);
  partialText += text;

  // Speak incrementally for low-latency
  utterance.text = text;
  speechSynthesis.speak(utterance);
}
```

## Build & prove order (de-risk)

1. **Prove Ollama + Gemma 4 works on the MacBook:** `ollama pull gemma4:12b`, generate plain text, measure tokens/sec.
2. **Prove tool calling:** Send a tool declaration, get a tool call back, parse it. Use `streamText` with one trivial tool.
3. **Prove Neo4j + ChromaDB tools:** Implement `queryMemory` and `getMedicationStatus` against real DBs, run end-to-end.
4. **Prove streaming + TTS:** Wire text deltas to Web Speech API, measure perceived latency.
5. **Prove PII filter:** Feed a message with fake gov-ID/address, confirm it's stripped.
6. **Prove cloud path:** Open a Gemini Live WebSocket session, stream camera frame, receive answer.
7. **Prove full loop:** Voice input → intent route → memory tools → streamed answer → TTS output.

If step 2 (tool-calling reliability) is shaky, switch routing to FunctionGemma (D7) early.

## Open sub-decisions (resolve while building)

- Whether to stream text deltas to TTS incrementally (better perceived latency) or speak the full response (simpler). Recommend incremental if answer generation > ~600 ms.
- Whether `thinking` mode is on for routing (more accurate, slower) — likely off for routing, on for harder reasoning. Ollama supports Gemma 4's thinking mode via the `think: true` option.
