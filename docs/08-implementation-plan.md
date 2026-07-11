# 08 — Implementation Plan

Two builders, hackathon timeframe. Ordered so the highest-risk items (adapter, KoreDB) are proven before the rest depends on them, and so there's always a demoable slice.

## Team split

- **Builder A — On-device brain**: LiteRT-LM + Gemma 4, ADK `Model` adapter, tool-call parser, PII filter, intent router, TTS wiring.
- **Builder B — Memory + cloud + shell**: KoreDB schema + GraphRAG, EmbeddingGemma, seed fixture, Gemini Live path, Compose UI, camera/mic trigger.

Shared contract they agree on first: the `ToolRegistry` interface (tool names, args, return shapes — see [06](06-adk-model-adapter.md)). Once that's fixed, A and B can work in parallel against it.

## Milestone 0 — Day 0 de-risking (both, first thing)

Prove the two scariest unknowns before building on them.

- [ ] **A:** Load Gemma 4 E4B in a LiteRT-LM session on the Pixel 10; generate plain text. Measure tokens/sec + first-token latency.
- [ ] **A:** One raw function-call round-trip (declaration in → `<|tool_call>` out → parsed) — no ADK yet.
- [ ] **B:** KoreDB smoke test — insert nodes/edges, insert vectors, run a `graphRAGQuery`. Confirm persistence across restart.
- [ ] **B:** EmbeddingGemma produces a vector on-device; confirm dimensionality matches KoreDB vector config.
- [ ] **Both:** Confirm all model files are pre-loaded on the Pixel 10 and load from local storage. Agree the `ToolRegistry` contract.

**Exit gate:** if function-calling is shaky → adopt FunctionGemma router now. If KoreDB is unstable → switch to SQLite fallback now.

## Milestone 1 — Local path skeleton (A leads, B supports)

- [ ] **A:** ADK `Model` adapter wrapping LiteRT-LM Gemma 4, emitting `Flow<Event>` via `callbackFlow`.
- [ ] **A:** Tool-call parser + whitelisted `ToolRegistry` dispatch.
- [ ] **A:** Intent router prompt (memory / local-perception / cloud) with `thinking` off for speed.
- [ ] **B:** Implement the memory tools (`queryMemory`, `getMedicationStatus`, `recordEpisode`, `locateObject`, `listUpcoming`) against KoreDB.
- [ ] **B:** Seed fixture: 1–2 days synthetic history (people, meds, routines, objects, episodes).

**Exit gate:** typed query → ADK → local Gemma tool call → KoreDB read → text answer. No UI, no voice yet.

## Milestone 2 — Voice + UI (B leads, A supports)

- [ ] **B:** Jetpack Compose shell — conversation view, on-screen text, caregiver seed screen.
- [ ] **B:** `SpeechRecognizer` in, Android `TextToSpeech` out.
- [ ] **A:** Stream text deltas to TTS for low perceived latency.
- [ ] **A:** PII filter on the write path (strip very-sensitive fields per schema §PII).
- [ ] **Both:** Async write on a coroutine, parallel with TTS; pre-warm the hot-entity LRU cache at app start.

**Exit gate:** speak "Did I take my morning pills?" → hear a grounded spoken answer. Measure end-to-end latency against the budget.

## Milestone 3 — Cloud path (Gemini Live) (B leads)

- [ ] **B:** ADK cloud Gemini model + Gemini Live WebSocket session (camera + mic streaming).
- [ ] **B:** Router branch: live-stream perception → cloud; still-frame → local Gemma 4.
- [ ] **A:** Share the `ToolRegistry` with the cloud path so cloud answers stay grounded in local memory.
- [ ] **Both:** PII filter still applied to anything written back from the cloud path.

**Exit gate:** trigger camera → "what is this and is it mine?" → Gemini Live answer grounded in seeded memory, spoken back.

## Milestone 4 — Multimodal local + polish

- [ ] **A:** Add image/audio input parts to the adapter (on-device Gemma 4 single-shot perception).
- [ ] **Both:** Tighten the scripted demo scenario end-to-end; rehearse.
- [ ] **Both:** Latency pass — if local path is slow, flip routing to FunctionGemma; stream to TTS.

**Exit gate:** the full scripted demo runs twice in a row without a network dependency on the local path.

## Milestone 5 — Demo hardening (both)

- [ ] Re-seed memory on the demo device; verify persistence.
- [ ] Airplane-mode test: local path works fully offline.
- [ ] Fallback recording of the working demo (in case live perception misbehaves on stage).
- [ ] Known-good device state snapshot (models loaded, seed data present).

## Critical path (what blocks what)

```
M0 (adapter round-trip + KoreDB smoke test)
        │
        ▼
M1 (local path skeleton) ──► M2 (voice + UI) ──► M4 (multimodal + polish) ──► M5 (harden)
        │                                              ▲
        └──────────────► M3 (cloud path) ──────────────┘
```

The adapter (M1) and KoreDB (M0) are the true blockers — everything else is parallelizable once they hold. If either wobbles at M0, take the documented fallback immediately rather than pushing through.

## Definition of done (demo)

- Local path answers a memory question fully offline, grounded in seeded history, spoken aloud, within the latency budget.
- Cloud path handles a triggered live-camera scene, grounded in local memory, spoken back.
- Memory persists across restart; PII filter demonstrably strips a sensitive field.
- The scripted scenario runs reliably twice.
