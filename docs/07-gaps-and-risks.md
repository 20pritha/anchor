# 07 — Gaps, Fixes & Risks

Review of the original Android plan against the laptop/Next.js pivot, plus verified facts (July 2026).

## Corrections from the Android→MacBook pivot

### G1 — Platform: Android → MacBook + Next.js
**Change:** The entire platform shifted from a single Android app (Kotlin, Jetpack Compose, LiteRT-LM) to a MacBook-hosted Next.js web app (TypeScript, React, Ollama + MLX).
**Impact:** The app runs in a browser on the laptop. Camera/mic/speech are browser APIs. Gemma 4 runs via Ollama with MLX acceleration instead of LiteRT-LM.
**Residual risk:** Web Speech API quality (SpeechRecognition accuracy, SpeechSynthesis naturalness) may differ from native Android. Mitigate by testing early on the demo MacBook.

### G2 — LLM runtime: LiteRT-LM → Ollama + MLX
**Change:** Originally on-device Gemma 4 via LiteRT-LM (Android). Now Gemma 4 runs via Ollama with the MLX backend on Apple Silicon.
**Impact:** Easier setup (`brew install ollama; ollama pull gemma4:12b`), better performance on Mac (MLX is Apple's optimized ML framework), and an OpenAI-compatible API for integration.
**Residual risk:** Ollama's Gemma 4 tool-calling support must be verified on the target Mac. Test a raw function-call round-trip early (day 0).

### G3 — Orchestration: ADK for Android → Vercel AI SDK
**Change:** Previously ADK for Android (Kotlin) with a custom `Model` adapter. Now Vercel AI SDK (TypeScript) with the built-in Ollama provider.
**Impact:** Simpler architecture — no custom adapter needed. The AI SDK handles streaming, tool calling, and multi-turn conversations natively.
**Residual risk:** The Vercel AI SDK's Ollama provider abstracts tool calling; verify it handles Gemma 4's tool format correctly (Gemma 4 uses the OpenAI-compatible format which Ollama exposes).

### G4 — Memory store: KoreDB → Neo4j + ChromaDB
**Change:** Previously a single KoreDB instance (graph + vector in one Kotlin DB). Now two services: Neo4j (graph) + ChromaDB (vector).
**Impact:** Two running services on the MacBook instead of one embedded DB. More deployment overhead but more mature, well-documented databases.
**Residual risk:** Two services means more startup steps and memory footprint. Automate startup with a single script (`docker-compose up` or a launch script). Monitor total RAM with Ollama + Neo4j + ChromaDB simultaneously.

### G5 — Embeddings: EmbeddingGemma → Gemini Embedding API
**Change:** Previously on-device EmbeddingGemma (no network needed). Now Google Gemini Embedding API (`gemini-embedding-2`).
**Impact:** Embedding generation now requires internet. This is acceptable because embeddings are generated on the **async write path** — the user never waits for them during a query.
**Residual risk:** Demo venue Wi-Fi must work. If the network is down, memory writes still complete (text stored in Neo4j) but vector embeddings will be queued/failed. Have a fallback: skip embedding and rely on graph-only queries for the demo.

### G6 — Speech: Android native → Web Speech API
**Change:** Android TextToSpeech + SpeechRecognizer replaced by browser Web Speech API.
**Impact:** Zero-dependency speech I/O in the browser. Quality varies by browser/OS — Chrome on macOS provides the best results.
**Residual risk:** Chrome's SpeechRecognition requires HTTPS (or localhost). For the demo, serve via `localhost`. SpeechSynthesis voices depend on the macOS voice pack installed.

### G7 — Single builder (was two builders)
**Change:** The Android plan split work across Builder A (on-device brain) and Builder B (memory + cloud + shell). Now a single builder does everything.
**Impact:** Sequencing is linear rather than parallel. Critical-path items (Ollama tool-calling, Neo4j/ChromaDB smoke tests) must work before dependent work begins.
**Residual risk:** Time pressure is higher. Cut stretch goals (FunctionGemma router, multimodal polish) early if behind schedule.

## Gaps the plan didn't cover

### G8 — Local service orchestration
The new stack requires **three local services**: Ollama, Neo4j, and ChromaDB. The Android plan had one embedded DB (KoreDB) and no model server (LiteRT-LM was loaded in-process).
**Fix:** Create a single `docker-compose.yml` or shell launch script for the hackathon. Auto-start on demo boot.
**Residual risk:** Low — Docker Compose handles this cleanly. Or run Neo4j + ChromaDB as native processes.

### G9 — Web Speech API quality baseline
Web Speech API quality is browser/OS-dependent and may not match Android native speech.
**Fix:** Test and record SpeechRecognition accuracy and SpeechSynthesis naturalness on the demo MacBook on day 0. Have a text-input fallback for the demo.
**Residual risk:** Low for demo — scripted scenarios can be tuned to the chosen voice.

### G10 — ChromaDB embedding dimension mismatch
The Gemini Embedding API and ChromaDB must agree on vector dimensions.
**Fix:** On day 0, call `gemini-embedding-2` once, record the output dimension (likely 768 or 1024), and configure the ChromaDB collection with that dimension before any writes.
**Residual risk:** Negligible — this is a one-time check.

## Risks to actively de-risk on day 0–1

| Risk | Why it bites | Mitigation |
| --- | --- | --- |
| Ollama Gemma 4 tool-calling reliability | Everything downstream depends on it | Prove raw function-call round-trip on day 0 (declaration in → tool call out → parsed) |
| Neo4j + ChromaDB: two services running | Demo machine may run out of RAM with Ollama + both DBs | Measure peak RAM on the demo MacBook early. Reduce ChromaDB to single-process mode |
| Embedding API network dependency | Demo venue Wi-Fi might fail | Writes still work for graph-only queries. Prep a demo script that doesn't need vector search |
| Web Speech API on demo browser | Chrome version / macOS voice quality may vary | Test on the exact demo MacBook + Chrome version on day 0 |
| Single-builder time pressure | More work per unit time than two-builder plan | Cut FunctionGemma router and multimodal stretch goals at first sign of schedule risk |
| Gemma 4 12B download on demo day | 7.6 GB download takes too long on venue Wi-Fi | Pre-download `gemma4:12b` on the demo MacBook before the event |

## Deferred by explicit request (parking lot)

### G11 — Consent / oversight framing
Passive-ish monitoring of a vulnerable population invites an obvious ethics question, and it's core to the "dignity-preserving, not surveillance" claim. Deferred for the build. **Recommendation:** keep a one-line note that trigger-based perception + on-device storage + "what is never recorded" is the answer when it comes up — it costs nothing and preempts the question. Not a build blocker.

### G12 — Pitch / positioning
Deferred. Note only: the pivot from Android to laptop loses the "pure mobile" angle but gains a stronger "runs on off-the-shelf hardware" story — revisit when you do pitch prep.
