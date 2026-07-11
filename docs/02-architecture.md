# 02 — Architecture

## Design stance

Anchor is a **single unified Android app** with two execution paths that share one memory store:

- **Local path (default):** everything on-device. No network. Handles the large majority of queries.
- **Cloud path (trigger-based only):** invokes Gemini Live API for real-time streaming vision/audio or reasoning beyond the on-device model.

The on-device Gemma 4 model is the router: it decides, per request, whether the query is answerable locally or needs the cloud. "Cloud is an enhancement, not a dependency."

## Component map

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Anchor (Android app, Kotlin)                    │
│                                                                        │
│  ┌──────────────┐   ┌───────────────────────────────────────────┐    │
│  │ Jetpack       │   │        ADK for Android (Kotlin)            │    │
│  │ Compose UI    │◄─►│  Runner + SessionService (conversation)    │    │
│  │ + camera/mic  │   │                                            │    │
│  │ trigger       │   │  Root orchestrator agent                   │    │
│  └──────────────┘   │    ├── LocalGemmaModel (custom adapter) ────┼──┐ │
│         ▲            │    │     wraps on-device Gemma 4            │  │ │
│         │            │    └── GeminiLiveModel (cloud, built-in) ──┼┐ │ │
│         │ voice out  │                                            ││ │ │
│  ┌──────┴───────┐   └───────────────────────────────────────────┘│ │ │
│  │ Android       │                                                 │ │ │
│  │ TextToSpeech  │        ┌──────────────────────────────────┐    │ │ │
│  └──────────────┘        │  Memory layer                     │◄───┘ │ │
│                          │  - KoreDB graph (people/meds/…)   │      │ │
│                          │  - KoreDB vector (episodic)       │      │ │
│                          │  - EmbeddingGemma (embeddings)    │      │ │
│                          │  - PII filter                     │◄─────┘ │
│                          └──────────────────────────────────┘        │
└──────────────────────────────────────────────────────┬───────────────┘
                                                         │ (only when routed)
                                                         ▼
                                            ┌────────────────────────┐
                                            │  Gemini Live API (cloud) │
                                            │  WebSocket, streaming    │
                                            │  vision/audio + reasoning│
                                            └────────────────────────┘
```

## The on-device brain

On-device Gemma 4 (E4B) is used for several distinct jobs. Because Gemma 4 is **multimodal on-device** (text + image + audio input), some perception that we originally planned to send to the cloud can stay local:

1. **Intent routing** — classify the incoming request: answerable-from-memory / needs-perception-local / needs-cloud.
2. **On-device perception** — single-shot image or short-audio understanding (e.g. "what is this object?") without leaving the device.
3. **Memory scoring & extraction** — decide what's worth remembering from an interaction, extract entities/events.
4. **PII filtering** — strip sensitive fields before anything is written to storage.
5. **Answer generation** — compose the natural-language answer from retrieved memory.

> Optimization to consider: use **FunctionGemma (Gemma 3 270M)** as a tiny, fast router for step 1, and reserve full **Gemma 4 E4B** for steps 2–5. Routing is the latency-critical hop and a 270M model returns structured calls much faster. See [04-design-decisions.md](04-design-decisions.md) §D7.

## Pipeline A — Local query (default, no network)

Example: user says *"Did I take my morning pills?"*

```
1. UI captures audio → Android SpeechRecognizer → text
       (or text input directly)
2. ADK Runner receives event → root agent
3. LocalGemmaModel: intent routing
       → "answerable from memory" (medication + today's log)
4. Function call emitted by Gemma 4 → parsed by adapter
       → queryMemory(entity="medication:morning", window="today")
5. Memory layer:
       - EmbeddingGemma embeds the query (if semantic lookup needed)
       - KoreDB graphRAGQuery: graph edges (routine/med schedule)
         + vector search (today's episodic events)
   [BLOCKING — on the critical path, cache hot entities]
6. LocalGemmaModel: compose answer from retrieved context
       → "Yes — you took them at 8:15 this morning."
7. Android TextToSpeech speaks the answer + on-screen text
8. Memory write (this interaction) fires ASYNC via coroutine,
   in parallel with TTS playback — never blocks the response
```

**No cloud call anywhere in this path.**

## Pipeline B — Cloud path (trigger-based)

Example: user points camera and says *"What am I looking at, and is it mine?"*

```
1. User TRIGGERS perception (button / wake phrase) → camera+mic open
2. ADK Runner → root agent
3. LocalGemmaModel: intent routing
       → "needs real-time streaming vision" → route to cloud
   (For a single still frame, Gemma 4 could answer locally;
    the cloud path is for live streaming / harder reasoning.)
4. GeminiLiveModel opens a WebSocket session to Gemini Live API
       - streams camera video + mic audio
       - Live API session (stateful, resumable up to 24h)
5. Gemini Live reasons over the stream, may call the same memory
   tools (function calling) to ground the answer in local memory
       e.g. "this looks like your blue umbrella (added last week)"
6. Response streamed back → composed answer
7. Output: Android TextToSpeech (default) or, since cloud was
   already invoked, optionally cloud TTS as an enhanced-voice mode
8. Any new memory (e.g. "saw umbrella at door") written ASYNC to KoreDB
```

The cloud path still **grounds itself in local memory** via function calls, and any privacy-sensitive fields are still PII-filtered before being written back.

## Async vs. blocking — the decision

This was left open in the transcript. Decision:

- **Memory writes** (new events, embeddings, scoring) → **async, fire-and-forget** on a coroutine after the response is produced. Runs in parallel with TTS playback. If the app dies mid-write, KoreDB's LSM design tolerates it and we lose at most the last interaction.
- **Memory reads** (context lookup for the current query) → **blocking**, on the critical path. This is where caching earns its keep: keep a small in-memory LRU of hot entities (the person's meds, key people, today's events) pre-warmed at app start so the common questions skip a disk hit.
- **Embedding generation for writes** → async. **Embedding of the incoming query for reads** → blocking but cache frequent queries.

## Latency budget (local path target)

Real-time is the bar judges said not to miss. Rough target for the local path, end to end (speech-in to speech-out start):

| Hop | Target |
| --- | --- |
| Speech-to-text | ~200–400 ms |
| Gemma 4 routing (or FunctionGemma) | ~150–400 ms |
| Memory read (cached) | < 50 ms |
| Gemma 4 answer generation | ~400–800 ms (streamed) |
| TTS first audio | ~150 ms |
| **Total to first spoken word** | **~1–1.8 s** |

Prototype and measure this path in the first day — do not architect latency on paper. If Gemma 4 E4B generation is the bottleneck, stream tokens to TTS incrementally and/or move routing to FunctionGemma.

## Adapter shape (sync vs. Flow)

ADK's runner uses a `runAsync(...).collect { }` pattern and expects the model to produce a `Flow<Event>`. On-device Gemma 4 generation via LiteRT-LM exposes an async/streaming callback. **Wrap that callback in a `callbackFlow { }`** so the adapter emits `Flow<Event>` and integrates with ADK's streaming naturally. Full spec in [06-adk-model-adapter.md](06-adk-model-adapter.md).
