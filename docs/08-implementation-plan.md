# 08 — Implementation Plan

Single builder, hackathon timeframe. Ordered so the highest-risk items (Ollama tool-calling, Neo4j/ChromaDB) are proven before the rest depends on them, and so there's always a demoable slice.

Unlike the original two-builder Android plan, work here is **linear**: each milestone depends on the previous. Stretch goals (FunctionGemma router, multimodal polish) are explicitly conditional — cut them first if time runs short.

## Milestone 0 — Day 0 de-risking (all critical-path unknowns)

Prove the scariest unknowns before building on them. These are **not** sequential — do them in any order on day 0.

- [ ] **Ollama + Gemma 4:** Install Ollama (`brew install ollama`), pull Gemma 4 12B (`ollama pull gemma4:12b`). Generate plain text. Measure tokens/sec + first-token latency for a routing-sized prompt and an answer-sized prompt.
- [ ] **One raw function-call round-trip:** Send a tool declaration to Ollama Gemma 4, get a tool call back (OpenAI-compatible format), parse it. **This is the single most important test — everything downstream depends on it.**
- [ ] **Neo4j smoke test:** Install Neo4j (`brew install neo4j`), start it, create a test node + edge via the JavaScript driver, query it back. Confirm persistence across restart.
- [ ] **ChromaDB smoke test:** Start ChromaDB (`chroma run --path ./data`), create a test collection, insert a vector, query it back.
- [ ] **Embedding API smoke test:** Call `gemini-embedding-2` via `@google/genai` JS SDK with a text input, confirm a vector comes back. Record the output dimension (likely 768 or 1024) — this drives the ChromaDB collection config.
- [ ] **Next.js scaffold:** `create-next-app`, install deps (`ai`, `@ai-sdk/ollama`, `@google/genai`, `neo4j-driver`, `chromadb`). Verify the dev server starts.

**Exit gate:** Ollama serves Gemma 4 with tool calling working. Neo4j and ChromaDB accept writes and return reads. Embedding API returns vectors. **If any of these fail, stop and address the issue before starting M1.**

## Milestone 1 — Local path skeleton

Build the core agent loop with the Vercel AI SDK, wired to Ollama and the memory stores. No UI, no voice yet — text in, text out.

- [ ] **Vercel AI SDK agent loop:** `streamText` with Ollama provider (`gemma4:12b`), one trivial tool, confirm tool-calling round-trip works end-to-end.
- [ ] **Intent router:** Gemma 4 via Ollama classifies requests as `memory | perception | cloud`. Test with a few sample queries.
- [ ] **PII filter:** Gemma 4 via Ollama strips very-sensitive fields per [05-memory-schema.md](05-memory-schema.md) §PII. Test with a message containing fake gov-ID/address.
- [ ] **Neo4j memory tools:** Implement `queryMemory`, `getMedicationStatus`, `locateObject`, `listUpcoming` against Neo4j using the JavaScript driver. Cypher queries per [05-memory-schema.md](05-memory-schema.md).
- [ ] **ChromaDB memory tools:** Implement `queryMemory` vector branch against ChromaDB. Connect via `chromadb` npm client.
- [ ] **`recordEpisode` tool:** Implement the async write pipeline: PII filter → Neo4j Episode node → Gemini Embedding API → ChromaDB collection.
- [ ] **Seed fixture:** Script that populates Neo4j (1 User, 3–4 Persons, 2–3 Medications, Routines, Objects, ~15 Episode nodes) and ChromaDB (corresponding vector entries).
- [ ] **Integration test:** Using the seed data, run `GET /api/agent?q="Did I take my morning pills?"` and verify it returns a grounded text answer referencing the seeded history.

**Exit gate:** Typed query → API route → agent loop → Ollama tool call → Neo4j/ChromaDB read → streamed text answer back. Measured end-to-end (text in to text out).

## Milestone 2 — Voice + UI

Build the browser UI around the API route. Speech in, speech out.

- [ ] **Next.js UI shell:** Conversation view (chat bubble layout), text input, trigger button for camera/mic. Tailwind styled.
- [ ] **Web Speech API — input:** `SpeechRecognition` captures voice, converts to text, sends to `/api/agent`. Push-to-talk button in the UI.
- [ ] **Web Speech API — output:** `SpeechSynthesis` speaks streaming text deltas as they arrive from the API. Incremental (start speaking before generation finishes).
- [ ] **Camera trigger:** `getUserMedia` captures a still frame from the webcam. Frame sent to Ollama vision API for local perception ("what is this object?").
- [ ] **Caregiver screen:** Simple form to seed/add people, medications, routines. Updates Neo4j directly.
- [ ] **LRU cache:** Pre-warm hot entities (today's meds, key people) from Neo4j at app start so common queries skip a DB hit.
- [ ] **End-to-end latency test:** Speak "Did I take my morning pills?" → measure time until spoken answer starts. Compare against the ~0.9–1.8 s budget.

**Exit gate:** Speak a question → hear a grounded spoken answer. Measure end-to-end latency.

## Milestone 3 — Cloud path (Gemini Live)

- [ ] **Gemini Live WebSocket:** `@google/genai` JS SDK connects to Gemini Live API, streams camera + mic, receives streamed responses.
- [ ] **Intent router cloud branch:** When the router returns `cloud`, the agent loop opens a Gemini Live session instead of calling Ollama.
- [ ] **Shared tool registry:** Both local and cloud paths share the same memory tools (`queryMemory`, `recordEpisode`, etc.) so cloud answers stay grounded in local memory.
- [ ] **PII filter on cloud writes:** Anything written back from the cloud path still passes through the PII filter first.
- [ ] **Branch integration:** Trigger camera → router decides cloud (live) vs local (still frame). Full end-to-end test.

**Exit gate:** Trigger camera → "what is this and is it mine?" → Gemini Live answer grounded in seeded memory, spoken back.

## Milestone 4 — Multimodal polish (conditional / stretch)

Cut if time is short. Only after M3 is solid.

- [ ] **Photo upload → embedding:** Upload a photo from the UI → generate embedding via Gemini Embedding API → store in ChromaDB for future semantic retrieval.
- [ ] **Latency pass:** If the local path misses the latency budget, flip routing to FunctionGemma (D7) and confirm streaming-to-TTS is working.
- [ ] **Demo scenario rehearsal:** Script the tight demo flow end-to-end; rehearse twice.
- [ ] **Optional: Airplane-mode test:** Local path works with **no network** (Ollama + Neo4j + ChromaDB all local; embedding API calls will fail gracefully).

**Exit gate:** The full scripted demo runs twice in a row without a network dependency on the local path.

## Milestone 5 — Demo hardening

- [ ] Re-seed memory on the demo laptop; verify Neo4j + ChromaDB persistence (restart both and query).
- [ ] Known-good state snapshot: Ollama running, Neo4j running, ChromaDB running, Next.js dev server running, seed data present, models loaded.
- [ ] Fallback recording of the working demo (in case live perception misbehaves on stage).
- [ ] Local path works fully offline (Ollama serves locally, Neo4j runs locally, ChromaDB runs locally — only embedding API calls will fail, which is acceptable since they're async).

## Critical path

```
M0 (Ollama tool-calling + Neo4j/ChromaDB smoke + Embedding API)
        │
        ▼
M1 (agent loop + memory tools + seed data)
        │
        ▼
M2 (voice + UI + PII)
        │
        ├──► M3 (cloud path)
        │        │
        └────────┴──► M4 (multimodal/stretch) ──► M5 (harden)
```

Ollama tool-calling (M0) and the agent loop (M1) are the true blockers. If either wobbles, take the fallback (FunctionGemma for routing, or simplify the memory tools) immediately rather than pushing through.

## Definition of done (demo)

- Local path answers a memory question fully offline, grounded in seeded history, spoken aloud via Web Speech API, within the ~0.9–1.8 s latency budget.
- Cloud path handles a triggered live-camera scene via Gemini Live API, grounded in local memory, spoken back.
- Memory persists across restart (Neo4j + ChromaDB on disk; PII filter demonstrably strips a sensitive field on write).
- The scripted scenario runs reliably twice.
