# 02 — Architecture

## Design stance

Anchor is a **Next.js web app running on a single MacBook** with two execution paths that share one memory store:

- **Local path (default):** everything on the laptop. No network. Handles the large majority of queries.
- **Cloud path (trigger-based only):** invokes Gemini Live API for real-time streaming vision/audio or reasoning beyond the local model.

The on-device Gemma 4 model (via Ollama + MLX) is the router: it decides, per request, whether the query is answerable locally or needs the cloud. "Cloud is an enhancement, not a dependency."

## Data flow

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser (Chrome on MacBook)                                      │
│                                                                   │
│  ┌──────────────────┐    ┌────────────────────────────────┐      │
│  │ Next.js UI        │    │ Web Speech API + getUserMedia  │      │
│  │ (React/Tailwind)  │    │ SpeechRecognition → text       │      │
│  │                   │    │ SpeechSynthesis ← audio out    │      │
│  │ Conversation view │    │ getUserMedia → camera frames   │      │
│  │ Caregiver screen  │    └────────────────────────────────┘      │
│  └────────┬─────────┘                                             │
│           │ fetch / POST                                           │
└───────────┼───────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────────┐
│  Next.js API Routes (localhost:3000/api)                          │
│                                                                   │
│  Vercel AI SDK Agent Loop (streamText + tool())                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  1. receive text/camera frame                                │  │
│  │  2. PII filter (Gemma 4 via Ollama)                          │  │
│  │  3. Intent router (Gemma 4 via Ollama)                       │  │
│  │     → answerable from memory | local perception | cloud      │  │
│  │  4a. [LOCAL] Tool call → Neo4j graph + ChromaDB vector       │  │
│  │  4b. [CLOUD] Gemini Live WebSocket (via @google/genai)       │  │
│  │  5. Compose answer → stream text deltas back                 │  │
│  │  6. Async memory write (PII → Neo4j → embed → ChromaDB)     │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────┐    ┌────────────────────┐
│  Ollama Server      │    │  @google/genai SDK │
│  (localhost:11434)   │    │                    │
│  Gemma 4 12B (MLX)  │    │  Gemini Embedding  │
│  - PII filter       │    │  API (embeddings)  │
│  - intent routing   │    │                    │
│  - answer gen       │    │  Gemini Live API   │
│  - vision           │    │  (cloud streaming) │
└────────────────────┘    └────────────────────┘
            │
            ▼
┌────────────────────┐    ┌────────────────────┐
│  Neo4j (local)     │    │  ChromaDB (local)  │
│  Graph store       │    │  Vector store      │
│  - People          │    │  - episodic/daily  │
│  - Medications     │    │  - episodic/people │
│  - Routines        │    │  - episodic/objects│
│  - Places          │    │  - episodic/medical│
│  - Objects         │    └────────────────────┘
│  - Relationships   │
└────────────────────┘
```

## The on-device brain (local Gemma 4 via Ollama)

On-device Gemma 4 (12B or E4B, served by Ollama) handles several distinct jobs:

1. **Intent routing** — classify the incoming request: answerable-from-memory / needs-perception-local / needs-cloud.
2. **On-device perception** — single-shot image understanding (e.g. "what is this object?") via Ollama's vision API.
3. **Memory scoring & extraction** — decide what's worth remembering from an interaction, extract entities/events.
4. **PII filtering** — strip sensitive fields before anything is written to storage or sent to the cloud.
5. **Answer generation** — compose the natural-language answer from retrieved memory.

> Optimization to consider: use **FunctionGemma (Gemma 3 270M)** as a tiny, fast router for step 1, and reserve full **Gemma 4** for steps 2–5. Routing is the latency-critical hop and a 270M model returns structured calls much faster. See [04-design-decisions.md](04-design-decisions.md) §D7.

## Pipeline A — Local query (default, no network)

Example: user says *"Did I take my morning pills?"*

```
1. Browser captures audio → Web Speech API SpeechRecognition → text
       (or text input directly in the chat UI)
2. POST /api/agent → Vercel AI SDK agent loop begins
3. Ollama (Gemma 4): intent routing
       → "answerable from memory" (medication + today's log)
4. Tool call emitted by Gemma 4 → AI SDK parses and dispatches
       → queryMemory(entity="medication:morning", window="today")
5. Memory layer:
       - Neo4j graph query: User →TAKES→ Medication{schedule includes morning}
       - ChromaDB vector search: scoped to episodic/medical namespace, today's window
       [BLOCKING — on the critical path, cache hot entities]
6. Ollama (Gemma 4): compose answer from retrieved context
       → "Yes — you took them at 8:15 this morning."
7. Text streamed back via AI SDK → browser displays text
       → Web Speech API SpeechSynthesis speaks the answer
8. Memory write (this interaction) fires ASYNC via fetch/Promise:
       PII filter → store in Neo4j → generate embedding via Gemini Embedding API
       → store in ChromaDB — runs in parallel with TTS playback, never blocks
```

**No cloud call anywhere in this path** (except embedding generation which is async and non-blocking).

## Pipeline B — Cloud path (trigger-based)

Example: user points camera and says *"What am I looking at, and is it mine?"*

```
1. User TRIGGERS perception (button click in UI) → camera+mic open via getUserMedia
2. POST /api/agent → Vercel AI SDK agent loop begins
3. Ollama (Gemma 4): intent routing
       → "needs real-time streaming vision" → route to cloud
   (For a single still frame, Gemma 4 could answer locally via Ollama vision;
    the cloud path is for live streaming / harder reasoning.)
4. Agent loop opens a WebSocket session to Gemini Live API via @google/genai
       - streams camera video + mic audio
       - Live API session (stateful, resumable up to 24h)
5. Gemini Live reasons over the stream, may call the same memory
   tools (function calling) to ground the answer in local memory
       e.g. "this looks like your blue umbrella (added last week)"
6. Response streamed back → composed answer → browser displays + speaks
7. Any new memory (e.g. "saw umbrella at door") written ASYNC: PII filter →
   Neo4j → Gemini Embedding API → ChromaDB
```

The cloud path still **grounds itself in local memory** via function calls (same `ToolRegistry` concept), and any privacy-sensitive fields are still PII-filtered before being written back.

## Async vs. blocking — the decision

- **Memory writes** (new events, embeddings, scoring) → **async, fire-and-forget** via a Promise after the response is produced. Runs in parallel with TTS playback. If the app dies mid-write, we lose at most the last interaction.
- **Memory reads** (context lookup for the current query) → **blocking**, on the critical path. Keep a small in-memory LRU of hot entities (the person's meds, key people, today's events) pre-warmed at app start so the common questions skip a DB hit.
- **Embedding generation for writes** → async (calls Gemini Embedding API). **Embedding of the incoming query for reads** → blocking but cache frequent query embeddings.

## Latency budget (local path target)

Real-time is the bar judges said not to miss. Rough target for the local path, end to end (speech-in to speech-out start):

| Hop | Target |
| --- | --- |
| Speech-to-text (Web Speech API) | ~200–400 ms |
| Gemma 4 routing (via Ollama) | ~150–400 ms |
| Memory read (cached) | < 50 ms |
| Gemma 4 answer generation (via Ollama) | ~400–800 ms (streamed) |
| TTS first audio (Web Speech API) | ~100–200 ms |
| **Total to first spoken word** | **~0.9–1.8 s** |

Prototype and measure this path in the first day — do not architect latency on paper. If Gemma 4 generation is the bottleneck, stream tokens to TTS incrementally and/or move routing to FunctionGemma.

## Adapter shape (Vercel AI SDK + Ollama provider)

Unlike the Android ADK which required a custom `Model` adapter wrapping a `callbackFlow`, the Vercel AI SDK provides a direct Ollama provider (`@ai-sdk/ollama`) that handles the streaming and tool-calling protocol. The agent loop is a custom loop using `generateText` / `streamText` with `tool()` definitions — no adapter layer needed. Full spec in [06-agent-loop.md](06-agent-loop.md).
