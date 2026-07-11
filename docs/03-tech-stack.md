# 03 — Tech Stack

Kotlin end-to-end. Every runtime here is native Kotlin/JVM or has a first-class Android path, so there are no mismatched-language bridges to fight.

| Layer | Tech | Exact artifact / notes |
| --- | --- | --- |
| App shell & UI | Kotlin + Jetpack Compose | Camera + mic trigger UI, on-screen text, caregiver seeding screen |
| Orchestration | Google ADK for Android (Kotlin) | `com.google.adk:*` (v0.1.x). Root orchestrator agent + `Runner` + `SessionService` for conversation state |
| On-device inference | **Gemma 4 E4B** via **LiteRT-LM** | The recommended edge runtime (MediaPipe LLM Inference is maintenance-only). Multimodal input (text+image+audio), text output |
| On-device routing (optional) | **FunctionGemma (Gemma 3 270M)** | Tiny, fast, function-calling-specialized. Optional fast-path router; falls back to Gemma 4 |
| Model→ADK glue | **Custom ADK `Model` adapter** | Wraps the LiteRT-LM Gemma 4 session, parses Gemma 4's tool-call token format, emits `Flow<Event>`. See [06](06-adk-model-adapter.md) |
| On-device embeddings | **EmbeddingGemma** | Generates vectors for KoreDB's vector store, on-device. Fills a gap the original plan left implicit |
| Local storage | **KoreDB** | Pure-Kotlin, LSM-tree, zero-JNI embedded DB. Graph (people/meds/routines) + native vector store (episodic memory) + GraphRAG query. `github.com/raipankaj/KoreDB` |
| Cloud reasoning | **Gemini Live API** | Stateful WebSocket, streaming vision/audio, function calling, barge-in, session resumption. Trigger-based only |
| Voice output | Android `TextToSpeech` | Fully on-device, offline, zero setup. Optional cloud TTS only when cloud path already invoked |
| Speech input | Android `SpeechRecognizer` (or on-device audio → Gemma 4) | For voice queries |
| Async / concurrency | Kotlin Coroutines + Flow | Async memory writes, embedding generation, non-blocking pipeline; `callbackFlow` bridges LiteRT-LM callbacks to ADK |

## Why these choices (short form)

- **Kotlin everywhere** — ADK for Android, KoreDB, LiteRT-LM's Android bindings, and Compose are all Kotlin/JVM. Adding Python (e.g. server-side ADK) would break the "unified on-device app" story and add an auth/network surface.
- **LiteRT-LM over MediaPipe LLM Inference** — as of 2026 the MediaPipe `tasks-genai` LLM Inference API is in maintenance-only mode; Google's active investment (and Gemma 4's documented edge path) is LiteRT-LM. Building new on the deprecated path is a trap.
- **Gemma 4 E4B over E2B** — E4B is the stronger on-device option (~4.5B effective, 128K context) and still fits the Pixel 10's memory budget; you've already run a Gemma 4 on device via AI Edge Gallery, which uses this class of runtime.
- **EmbeddingGemma for vectors** — keeps embedding generation on-device and in the Gemma family, so no separate embedding service or cloud call for memory writes.
- **KoreDB over SQLite+sqlite-vec or a separate graph DB** — one dependency gives you both graph and vector on-device with a GraphRAG query, no JNI. Trade-off: it's young; mitigated by a day-0 smoke test (see gaps doc §2).
- **ADK for orchestration, both paths** — one agent framework spans the local sub-agent (via custom adapter) and the cloud Gemini path, and ADK is purpose-built for Gemini Live bidirectional streaming.

## Dependencies to pull on day 0

- ADK for Android (Kotlin) artifacts.
- LiteRT-LM Android runtime + the Gemma 4 E4B model file (multi-GB — pre-provision on the demo device; do **not** rely on first-run download for the demo).
- (Optional) FunctionGemma 270M model file for the fast router.
- EmbeddingGemma model file.
- KoreDB (Gradle dependency from the repo / published artifact).
- Gemini Live API access + key (confirm rate limits for the event — assumed fine per your call).

> Model files are the classic time sink: bundling multi-GB `.litertlm`/`.task` files in the APK vs. downloading on first launch. For the hackathon, pre-load them onto the Pixel 10 and load from local storage. Decide packaging strategy on day 0, not demo night.
