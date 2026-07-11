# 07 — Gaps, Fixes & Risks

Review of the plan from the transcript against verified facts (July 2026). Each item: what the gap is, the fix, and residual risk.

## Corrections to earlier assumptions

### G1 — "Gemma 4 only supports text" is wrong (it's multimodal)
**Fix:** Gemma 4 (incl. on-device E2B/E4B) accepts **text + image input, with audio input on the small models**; output is text only. This is upside: single-shot perception ("what is this object?") can run on-device, reducing cloud calls and latency. Voice output still needs TTS because output is text-only.
**Impact:** Routing gains a "still-frame → local, live-stream → cloud" branch. Local-first story gets stronger.
**Residual risk:** On-device multimodal inference is heavier than text-only; measure latency/memory on the Pixel 10 for image input specifically.

### G2 — On-device runtime should be LiteRT-LM, not MediaPipe LLM Inference
**Fix:** The MediaPipe `tasks-genai` LLM Inference API is in **maintenance-only** mode in 2026; Google's active edge runtime is **LiteRT-LM**, which is also Gemma 4's documented on-device path. Target LiteRT-LM in the adapter.
**Impact:** The custom adapter wraps a LiteRT-LM session (not a MediaPipe session). AI Edge Gallery already exercises this runtime class, so your "it runs on my Pixel 10" evidence still holds.
**Residual risk:** Slightly less tutorial content for LiteRT-LM's newest APIs; budget reading time.

## Gaps the plan didn't cover

### G3 — Where do embeddings come from?
The vector store needs embeddings; the transcript never said how they're produced.
**Fix:** Use **EmbeddingGemma** on-device (D9). Keeps writes local and in-family.
**Residual risk:** Another model file to load into memory alongside Gemma 4 E4B — watch total RAM footprint on the Pixel 10; load lazily / share memory budget.

### G4 — Function-call reliability + parsing is the real adapter surface
Gemma 4 emits tool calls in a specific token format that needs a custom parser; ADK expects a `Flow<Event>`. This glue is the top technical risk.
**Fix:** Build the adapter in isolation and prove a function-call round-trip *before* wiring the app (see [06](06-adk-model-adapter.md) build order). Wrap the async callback in `callbackFlow`. Keep a whitelisted `ToolRegistry` (never resolve tool names to functions dynamically).
**Residual risk:** If E4B's function-calling is inconsistent under time pressure, fall back to **FunctionGemma (270M)** for routing (D7) — decide early, not at 3am.

### G5 — Memory persistence & demo cold-start
A "remembers your life" app that starts empty or wipes on restart kills the pitch.
**Fix:** KoreDB persists to disk (LSM) — inherent. Add a **seed fixture** of 1–2 days synthetic history (D10, schema doc §Seeding).
**Residual risk:** Low. Just don't forget to run the seeder on the demo device.

### G6 — Async-write vs. blocking-read was undecided
**Fix:** Writes async/fire-and-forget in parallel with TTS; reads blocking but served from a pre-warmed LRU cache of hot entities (D11, architecture doc).
**Residual risk:** Negligible at demo timescales.

### G7 — Two execution paths, one memory
ADK's paved on-device path is Gemini Nano, not Gemma-4-on-LiteRT-LM.
**Fix:** Custom ADK `Model` adapter for the local path (D5); ADK's built-in Gemini model for the cloud path. Both share the same memory `ToolRegistry` so cloud reasoning stays grounded locally.
**Residual risk:** The adapter (G4) — same top risk.

## Risks to actively de-risk on day 0–1

| Risk | Why it bites | Mitigation |
| --- | --- | --- |
| Adapter / function-call parsing (G4) | Everything downstream depends on it | Prove round-trip in isolation first; FunctionGemma fallback ready |
| KoreDB is young (pre-1.0, small maintainer base) | Undocumented bugs under time pressure | Day-0 smoke test: insert nodes/edges, insert vectors, run a GraphRAG query. Fallback: SQLite + relational edges + on-device vector search |
| Model file size (multi-GB) on demo device | First-run download fails / eats time | Pre-provision Gemma 4 E4B (+ EmbeddingGemma, + optional FunctionGemma) on the Pixel 10; load from local storage |
| On-device latency for "real-time" pitch | Judges said not to miss the real-time bar | Measure the local path early (budget in architecture doc); stream tokens to TTS; move routing to FunctionGemma if needed |
| RAM: multiple models resident | Gemma 4 E4B + EmbeddingGemma (+ FunctionGemma) at once | Lazy-load, unload when idle, measure peak on Pixel 10 |
| Demo reliability of live perception | Camera angle/lighting/timing on stage | Script a tight scenario; prefer a still frame (local) where possible; rehearse |

## Deferred by your explicit request (parking lot)

### G8 — Consent / oversight framing
Passive-ish monitoring of a vulnerable population invites an obvious ethics question, and it's core to the "dignity-preserving, not surveillance" claim. Deferred for the build per your call. **Recommendation:** keep a one-line note that trigger-based perception + on-device storage + "what is never recorded" is the answer when it comes up — it costs nothing and preempts the question. Not a build blocker.

### G9 — Pitch / positioning
Deferred. Note only: switching to native TTS drops the "showcase 2 Gemini APIs" angle; revisit when you do pitch prep.
