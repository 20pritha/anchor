# 04 — Design Decisions (ADR log)

Lightweight architecture decision records. Each: the decision, the context, the trade-off, and status. Decisions from the original Android plan that are superseded by the MacBook pivot are marked accordingly.

---

## D1 — Local-first, cloud-as-enhancement

**Decision:** On-device Gemma 4 handles the default path; Gemini Live is invoked only for trigger-based real-time streaming or reasoning beyond the local model.

**Context:** Target population is vulnerable; privacy and offline resilience are the product's whole point, and the hackathon has a Gemma / on-device prize.

**Trade-off:** More engineering than a cloud-only app; on-device model is weaker than frontier cloud. Accepted — it's the differentiator.

**Status:** Locked. (Unaffected by platform pivot.)

---

## D2 — Single unified MacBook web app (no companion server)

**Decision:** One Next.js app on a single MacBook. No separate server component beyond the local services.

**Context:** The Android plan said "single unified Android app" — same principle, different platform. Everything runs on one machine. Pivot from Kotlin/Compose to Next.js/React was forced by Android hardware unavailability.

**Trade-off:** Browser-based speech/camera APIs are less capable than native Android equivalents but require zero setup and run on any laptop.

**Status:** **Supersedes original D2.** The platform changed (Android → MacBook), the "single unified" principle remains.

---

## D3 — Orchestration: Vercel AI SDK (was ADK for Android)

**Decision:** Use Vercel AI SDK as the sole orchestration layer for both local and cloud paths.

**Context:** The Android plan used ADK for Android. On the web/TypeScript stack, the Vercel AI SDK provides the equivalent: streaming text, tool calling, and multi-turn agent loops with an Ollama provider that works with local Gemma 4.

**Trade-off:** Lose ADK's tight Gemini Live integration — but `@google/genai` JS SDK fills that gap. Gain a unified TypeScript stack with no cross-language bridges.

**Status:** **Supersedes original D3.** Vercel AI SDK replaces ADK for Android.

---

## D4 — On-device runtime: Ollama + MLX (was LiteRT-LM)

**Decision:** Run Gemma 4 on MacBook via Ollama with the MLX backend.

**Context:** The Android plan used LiteRT-LM. On macOS, Ollama + MLX is the fastest, easiest path: `brew install ollama; ollama pull gemma4:12b`. MLX is Apple's optimized ML framework for Apple Silicon.

**Trade-off:** Tied to Apple Silicon for MLX acceleration. On other hardware (Intel Mac, Linux), fall back to Ollama's default CUDA/Vulkan backend.

**Status:** **Supersedes original D4.** Ollama + MLX replaces LiteRT-LM.

---

## D5 — Vercel AI SDK agent loop (was custom ADK `Model` adapter)

**Decision:** Use Vercel AI SDK's `streamText` + `tool()` API to define tools and drive the agent loop. No custom adapter needed — the SDK's Ollama provider handles streaming and tool-calling protocol translation.

**Context:** The Android plan required a custom ADK `Model` adapter because ADK's paved on-device path was Gemini Nano, not Gemma-4-on-LiteRT-LM. On the web stack, the Vercel AI SDK's `@ai-sdk/ollama` provider wraps Ollama's OpenAI-compatible API directly. Gemma 4's tool-calling format (via Ollama) uses standard OpenAI format — no custom parser needed.

**Trade-off:** Less control over the low-level streaming protocol than a custom adapter. But the SDK is open-source and well-documented; any needed customization can be done in the agent loop rather than at the transport layer.

**Status:** **Supersedes original D5.** The adapter layer is replaced by the Vercel AI SDK Ollama provider.

---

## D6 — Gemma 4 is multimodal; keep more perception on-device

**Decision:** Use Gemma 4's on-device image input (via Ollama vision API) for single-shot perception; reserve Gemini Live for genuinely real-time *streaming* perception and harder reasoning.

**Context:** Gemma 4 (incl. E2B/E4B/12B) takes text + image input, with audio input on the small models; output is text only. Ollama exposes the vision capability via its chat API — send a still frame, get a description.

**Trade-off:** Slightly more routing nuance (still-frame → local; live stream → cloud). Big win: stronger local-first story, fewer cloud calls, lower latency for "what is this?" style questions.

**Status:** Locked. Output voice still needs TTS since Gemma outputs text only.

---

## D7 — Optional fast router: FunctionGemma (270M)

**Decision:** Optionally use FunctionGemma (Gemma 3 270M, function-calling-specialized) as the intent router; fall back to Gemma 4 for perception/reasoning/answers.

**Context:** Routing is the latency-critical first hop. A 270M model returns structured calls far faster than Gemma 4 12B. Can also run via Ollama.

**Trade-off:** A second model file to manage. Only adopt if measured routing latency on Gemma 4 is too high (measure first — see M1). Keep it behind a flag.

**Status:** Proposed / behind a flag. (Same as original D7, now runs via Ollama.)

---

## D8 — Memory store: Neo4j + ChromaDB (was KoreDB)

**Decision:** Neo4j for graph memory (entities + relationships) and ChromaDB for vector memory (episodic embeddings).

**Context:** The Android plan used KoreDB (a single Kotlin DB with graph + vector). KoreDB is Kotlin-only and doesn't work in the Node.js/TypeScript stack. Neo4j provides a mature graph database with a JavaScript driver. ChromaDB provides purpose-built vector search with metadata filtering and collections.

**Trade-off:** Two local services instead of one embedded DB. More startup steps but more mature, better-documented databases with larger communities.

**Status:** **Supersedes original D8.**

---

## D9 — Embeddings: Gemini Embedding API (was EmbeddingGemma)

**Decision:** Generate embeddings via the Google Gemini Embedding API (`gemini-embedding-2`), which supports both text and photo uploads (multimodal).

**Context:** The Android plan used on-device EmbeddingGemma. EmbeddingGemma doesn't have a JavaScript binding. The Gemini Embedding API provides higher-quality multimodal embeddings (text + images), is on-brand for the Google hackathon, and is accessible via the `@google/genai` JS SDK.

**Trade-off:** Embedding generation now requires internet. This is acceptable because embeddings are generated on the **async write path** — the user never waits for them during a query.

**Status:** **Supersedes original D9.** Gemini Embedding API replaces EmbeddingGemma.

---

## D10 — Persistence + demo seeding

**Decision:** Rely on Neo4j's on-disk persistence + ChromaDB's persistence; pre-seed 1–2 days of synthetic caregiver/patient history for the demo.

**Context:** A "remembers your life" pitch that starts empty (or wipes on restart) undercuts itself. Both DBs persist to disk.

**Trade-off:** Need a small seed script/fixture. Cheap and high-value for demo reliability.

**Status:** Locked.

---

## D11 — Async writes, blocking cached reads

**Decision:** Memory writes are async/fire-and-forget (parallel with TTS). Reads are blocking but served from a pre-warmed LRU cache of hot entities.

**Context:** Writes aren't on the user's critical path; reads are.

**Trade-off:** Tiny window where a just-written memory isn't yet queryable; irrelevant at demo timescales.

**Status:** Locked. (Unaffected by platform pivot.)

---

## D12 — Voice output: Web Speech API (was Android TTS)

**Decision:** Use the browser's Web Speech API (`SpeechSynthesis`) for voice output. Optional cloud TTS only when the cloud path was already invoked.

**Context:** Gemma 4 outputs text only. The Web Speech API provides browser-native, fully local TTS. Available in Chrome/Edge on macOS with zero setup.

**Trade-off:** Voice quality depends on macOS voice pack. Less showy than cloud TTS. Fine for the demo.

**Status:** **Supersedes original D12.** Web Speech API replaces Android TextToSpeech.

---

## D13 — Trigger-based perception (not always-on)

**Decision:** Camera/mic perception is user-triggered (button click in the UI), not continuous.

**Context:** Continuous streaming is expensive and reads as surveillance for this population — the opposite of "dignity-preserving."

**Trade-off:** Can't demo fully passive "AI notices things on its own." Accepted; scripted trigger demo is more reliable anyway.

**Status:** Locked. (Unaffected by platform pivot.)

---

## D14 — Speech input: Web Speech API (was Android SpeechRecognizer)

**Decision:** Use the browser's Web Speech API (`SpeechRecognition`) for speech input.

**Context:** The Android plan used Android's native SpeechRecognizer. On the web, the Web Speech API provides browser-native, offline-capable speech recognition with zero dependencies.

**Trade-off:** Chrome-only (not supported in all browsers). Requires HTTPS or localhost. Acceptable for the demo.

**Status:** New ADR for the MacBook pivot.

---

## D15 — Camera: Browser `getUserMedia` (was Android camera intent)

**Decision:** Use the browser's `getUserMedia` API to capture camera frames.

**Context:** The Android plan used Android's camera intent system. On the web, `getUserMedia` is the standard API for camera access.

**Trade-off:** Less control over camera parameters than native Android APIs. Still works for still-frame perception and live streaming to Gemini Live.

**Status:** New ADR for the MacBook pivot.

---

## D16 — Single builder (was two builders)

**Decision:** A single developer handles all work, sequenced linearly rather than parallel.

**Context:** The Android plan split across Builder A (on-device brain) and Builder B (memory + cloud + shell). With the platform pivot and the reality of a single developer, the work is re-sequenced.

**Trade-off:** Longer critical path. Stretch goals (FunctionGemma router, multimodal polish) are the first to cut if time runs short.

**Status:** New ADR for the MacBook pivot.

---

## D17 — Local service orchestration (new)

**Decision:** Run three local services for the dev stack: Ollama, Neo4j, and ChromaDB. Automate startup with a single launch script or Docker Compose.

**Context:** Unlike the Android plan which had one embedded DB (KoreDB) and no model server (LiteRT-LM loaded in-process), the web stack requires separate processes for model serving and two databases.

**Trade-off:** More moving parts during development. Mitigated by automating startup. For the demo, pre-start all services and leave them running.

**Status:** New ADR for the MacBook pivot.

---

## Parking lot (deferred by explicit request)

- **Consent / oversight UX** — real product concern for passive monitoring of dementia patients; deferred for the build, noted in gaps doc §8.
- **Pitch / positioning** — deferred.
- **Production deployment / packaging** — beyond the hackathon scope.
