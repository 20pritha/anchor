# 04 — Design Decisions (ADR log)

Lightweight architecture decision records. Each: the decision, the context, the trade-off, and status.

---

## D1 — Local-first, cloud-as-enhancement

**Decision:** On-device Gemma 4 handles the default path; Gemini Live is invoked only for trigger-based real-time streaming or reasoning beyond the local model.

**Context:** Target population is vulnerable; privacy and offline resilience are the product's whole point, and the hackathon has a Gemma / on-device prize.

**Trade-off:** More engineering than a cloud-only app; on-device model is weaker than frontier cloud. Accepted — it's the differentiator.

**Status:** Locked.

---

## D2 — Single unified Android app (no companion server)

**Decision:** One Kotlin/Compose app on the Pixel 10. No laptop/server component.

**Context:** "On-device" must be literal for the prize; a companion server undercuts the story and adds a network/auth surface to build under time pressure.

**Trade-off:** ADK's paved on-device path is Gemini Nano, so we take on a custom adapter (D5). Accepted.

**Status:** Locked.

---

## D3 — Orchestration: ADK only (drop LangGraph)

**Decision:** Use ADK for Android as the sole orchestration layer for both local and cloud paths.

**Context:** The original concept stacked ADK + LangGraph, which overlap. ADK gives agent structure, sessions, and is purpose-built for Gemini Live streaming; it's also on-brand for a Google hackathon.

**Trade-off:** Lose LangGraph's explicit state-graph/checkpointing — covered adequately by ADK sessions for this scope.

**Status:** Locked.

---

## D4 — On-device runtime: LiteRT-LM (not MediaPipe LLM Inference)

**Decision:** Run Gemma 4 on-device via LiteRT-LM.

**Context:** As of 2026 the MediaPipe `tasks-genai` LLM Inference API is in **maintenance-only** mode; LiteRT-LM is the actively developed edge runtime and Gemma 4's documented on-device path. (The transcript assumed MediaPipe `tasks-genai`.)

**Trade-off:** Slightly less community tutorial content than the older MediaPipe path; but building on a deprecated API is worse. The AI Edge Gallery app you used already exercises this runtime class.

**Status:** Locked. **Correction to earlier plan.**

---

## D5 — Custom ADK `Model` adapter for Gemma 4

**Decision:** Write a custom class implementing ADK's `Model` abstraction that wraps the LiteRT-LM Gemma 4 session, exposes it as a `Flow<Event>`, and parses Gemma 4's tool-call token format.

**Context:** ADK's built-in on-device model is Gemini Nano via ML Kit GenAI — a different runtime from Gemma-4-on-LiteRT-LM. Gemma 4 emits function calls in a specific token format (`<|tool_call>call:name{...}<tool_call|>`) that needs a custom parser.

**Trade-off:** This is the real surface area of the build and the top technical risk. Mitigate by building and testing the adapter in isolation first (see implementation plan M2).

**Status:** Locked. This is the critical-path work item.

---

## D6 — Gemma 4 is multimodal; keep more perception on-device

**Decision:** Use Gemma 4's on-device image/audio input for single-shot perception; reserve Gemini Live for genuinely real-time *streaming* perception and harder reasoning.

**Context:** The transcript assumed "Gemma 4 only supports text." That's wrong — Gemma 4 (incl. E2B/E4B) takes text + image input, with audio input on the small models; output is text only. (Verified against the Gemma 4 model card / capabilities docs, June 2026.)

**Trade-off:** Slightly more routing nuance (still-frame → local; live stream → cloud). Big win: stronger local-first story, fewer cloud calls, lower latency for "what is this?" style questions.

**Status:** Locked. **Correction to earlier plan.** Output voice still needs TTS since Gemma outputs text only.

---

## D7 — Optional fast router: FunctionGemma (270M)

**Decision:** Optionally use FunctionGemma (Gemma 3 270M, function-calling-specialized) as the intent router; fall back to Gemma 4 E4B for perception/reasoning/answers.

**Context:** Routing is the latency-critical first hop. A 270M model returns structured tool calls far faster than E4B, and after light fine-tuning FunctionGemma hits ~85% on held-out function-calling evals.

**Trade-off:** A second model file to manage and load. Only adopt if measured routing latency on E4B is too high (measure first — see M1). Keep it behind a flag.

**Status:** Proposed / behind a flag.

---

## D8 — Memory store: KoreDB (graph + vector in one)

**Decision:** KoreDB for both structured (graph) and episodic (vector) memory, with GraphRAG queries.

**Context:** Single on-device dependency, pure Kotlin, zero JNI, LSM-tree persistence, native cosine-similarity vector search.

**Trade-off:** Young project (small maintainer base, pre-1.0). Mitigate with a day-0 smoke test; fallback is SQLite + a relational edge schema + on-device vector search if KoreDB proves unstable.

**Status:** Locked pending smoke test.

---

## D9 — Embeddings: EmbeddingGemma on-device

**Decision:** Generate embeddings for the vector store with EmbeddingGemma, on-device.

**Context:** The transcript never specified where vectors come from. EmbeddingGemma keeps this local and in-family.

**Trade-off:** Another model to load; small and cheap. Accepted.

**Status:** Locked. **Fills a gap.**

---

## D10 — Persistence + demo seeding

**Decision:** Rely on KoreDB's on-disk persistence; pre-seed 1–2 days of synthetic caregiver/patient history for the demo.

**Context:** A "remembers your life" pitch that starts empty (or wipes on restart) undercuts itself. KoreDB persists to disk (LSM), so this is inherent — just seed data.

**Trade-off:** Need a small seed script/fixture. Cheap and high-value for demo reliability.

**Status:** Locked.

---

## D11 — Async writes, blocking cached reads

**Decision:** Memory writes are async/fire-and-forget (parallel with TTS). Reads are blocking but served from a pre-warmed LRU cache of hot entities.

**Context:** Left open in the transcript. Writes aren't on the user's critical path; reads are.

**Trade-off:** Tiny window where a just-written memory isn't yet queryable; irrelevant at demo timescales.

**Status:** Locked.

---

## D12 — Voice output: Android native TTS

**Decision:** Android `TextToSpeech` for voice; optional cloud TTS only when the cloud path was already invoked (so we don't break a privacy guarantee we hadn't already broken).

**Context:** Gemma 4 outputs text only; "run Gemini TTS locally" isn't possible (it's cloud-only). Native TTS is offline and free.

**Trade-off:** Less showy voice than Gemini Flash TTS. Fine for the demo.

**Status:** Locked.

---

## D13 — Trigger-based perception (not always-on)

**Decision:** Camera/mic perception is user-triggered, not continuous.

**Context:** Continuous streaming is expensive (battery/latency/bandwidth) and reads as surveillance for this population — the opposite of "dignity-preserving."

**Trade-off:** Can't demo fully passive "AI notices things on its own." Accepted; scripted trigger demo is more reliable anyway.

**Status:** Locked.

---

## Parking lot (deferred by explicit request)

- **Consent / oversight UX** — real product concern for passive monitoring of dementia patients; deferred for the build, noted in gaps doc §8.
- **Pitch / positioning** — deferred.
- **Production model packaging / OTA** — use a pre-provisioned device for the demo.
