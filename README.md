# Anchor

A dignity-preserving memory companion for people with mild cognitive impairment (MCI) / early dementia and their caregivers. Anchor runs **local-first on a single Android device** (Pixel 10), using on-device Gemma 4 for perception, reasoning, and memory, and reaching to the cloud (Gemini Live API) only when real-time streaming vision/audio or heavier reasoning is genuinely needed.

**Core principle:** *Cloud is an enhancement, not a dependency.* Everything essential works offline.

**Context:** Built for the Google DeepMind Bangalore Hackathon — Problem Statement 1 (Real-Time Multimodal Interaction via Gemini Live), also targeting the on-device / Gemma special prize.

---

## Docs index

| Doc | What's in it |
| --- | --- |
| [docs/01-product-overview.md](docs/01-product-overview.md) | The problem, the user, what Anchor does, scope for the hackathon |
| [docs/02-architecture.md](docs/02-architecture.md) | System architecture + the two end-to-end request pipelines (local path, cloud path) |
| [docs/03-tech-stack.md](docs/03-tech-stack.md) | Every layer, the exact library/artifact, and why |
| [docs/04-design-decisions.md](docs/04-design-decisions.md) | ADR-style log of the key decisions and their trade-offs |
| [docs/05-koredb-schema.md](docs/05-koredb-schema.md) | Graph node/edge types + vector namespaces for the memory store |
| [docs/06-adk-model-adapter.md](docs/06-adk-model-adapter.md) | The custom ADK `Model` adapter wrapping on-device Gemma 4 (the core glue) |
| [docs/07-gaps-and-risks.md](docs/07-gaps-and-risks.md) | Gaps found reviewing the plan, the fixes, and open risks to de-risk early |
| [docs/08-implementation-plan.md](docs/08-implementation-plan.md) | Milestone + task breakdown for a 2-person team over the hackathon |

## Team

Two builders. Suggested split (see implementation plan for detail):

- **Builder A — On-device brain:** Gemma 4 via LiteRT-LM, ADK Model adapter, function-calling parser, PII filter, intent router.
- **Builder B — Memory + cloud + app shell:** KoreDB schema & GraphRAG, EmbeddingGemma embeddings, Gemini Live path, Jetpack Compose UI, native TTS.

## Status of key assumptions (verified July 2026)

- **Gemma 4** exists (released Apr 2, 2026), on-device sizes **E2B / E4B**. It is **multimodal** — text + image input, with audio input on E2B/E4B/12B; **text output only**. (The earlier "text-only" assumption was wrong; see gaps doc — this is good news.)
- **On-device runtime:** MediaPipe LLM Inference API is now **maintenance-only**; **LiteRT-LM** is the recommended path. Adapter targets LiteRT-LM.
- **ADK for Android** (Kotlin, v0.1.x) is real; its paved on-device path is Gemini Nano via ML Kit GenAI, so wrapping Gemma 4 requires a **custom `Model` adapter**.
- **KoreDB** is a pure-Kotlin, LSM-tree, zero-JNI embedded DB with native vector search — good single-dependency fit; still young, smoke-test on day 0.
- **Android `TextToSpeech`** — fully on-device voice output, zero setup.

See [docs/07-gaps-and-risks.md](docs/07-gaps-and-risks.md) for the sourced details.
