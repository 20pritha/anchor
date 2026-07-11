# Anchor

A dignity-preserving memory companion for people with mild cognitive impairment (MCI) / early dementia and their caregivers. Anchor runs **local-first on a single MacBook** using **Gemma 4 via Ollama + MLX** for perception, reasoning, and memory, and reaches to the cloud (Gemini Live API) only when real-time streaming vision/audio or heavier reasoning is genuinely needed.

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
| [docs/05-koredb-schema.md](docs/05-koredb-schema.md) | Graph node/edge types (Neo4j) + vector collections (ChromaDB) for the memory store |
| [docs/06-agent-loop.md](docs/06-agent-loop.md) | The Vercel AI SDK agent loop wrapping Ollama + Gemini Live (the core glue) |
| [docs/07-gaps-and-risks.md](docs/07-gaps-and-risks.md) | Gaps found reviewing the plan, the fixes, and open risks to de-risk early |
| [docs/08-implementation-plan.md](docs/08-implementation-plan.md) | Milestone + task breakdown for a single builder over the hackathon |
| [docs/09-architecture-deep-dive.md](docs/09-architecture-deep-dive.md) | Detailed agent loop design, tool definitions, Neo4j schema, ChromaDB collection spec |
| [docs/10-critical-review-and-revised-plan.md](docs/10-critical-review-and-revised-plan.md) | Adversarial re-review: re-verified assumptions, ranked gaps/contradictions, and a corrected implementation plan |
| [docs/11-code-setup-plan.md](docs/11-code-setup-plan.md) | End-to-end code build plan: repo layout, deps, file responsibilities, and a build-blind order with per-step acceptance checks |

## Running the app

The code was written on Windows and is meant to run on the demo Mac (see
[docs/11](docs/11-code-setup-plan.md)'s build-blind constraint) — Ollama and
on-device Web Speech are Mac-only pieces. Everything else (Next.js, Neo4j,
ChromaDB) is OS-neutral and can be brought up anywhere Docker + Node run.

```bash
cp .env.example .env.local        # fill in GEMINI_API_KEY for the cloud path (optional for local-only use)
npm install
docker compose up -d              # Neo4j + ChromaDB
npm run check                     # health-check Ollama/Neo4j/ChromaDB
npm run schema                    # Neo4j constraints + indexes
npm run seed                      # demo fixture (graph always; vectors need Ollama reachable)
npm run dev                       # http://localhost:3000
```

On the Mac, pull the models first: `ollama pull gemma4:12b` (or `gemma4:12b-mlx`
on 32 GB+ machines, see doc 10) and `ollama pull embeddinggemma`. `scripts/services.sh`
(Mac) / `scripts/services.ps1` (Windows dev) wrap the steps above into one command.

## Status of key assumptions (verified July 2026)

- **Gemma 4** exists (released Apr 2, 2026), on-device sizes **E2B / E4B / 12B**. It is **multimodal** — text + image input, with audio input on E2B/E4B/12B; **text output only**.
- **Ollama + MLX** on Apple Silicon is the fastest local runtime for Gemma 4 on MacBook. Gemma 4 12B (Q4_K_M, ~7.6 GB) runs comfortably on 16 GB M-series Macs at ~25 tok/s.
- **Neo4j** runs locally via `brew install neo4j`. **ChromaDB** runs locally as a Python/Docker server. Both have mature JavaScript clients.
- **Gemini Live API** is accessible from the browser via WebSocket using the `@google/genai` JS SDK.
- **Vercel AI SDK** provides the Ollama provider and tool-calling framework needed for the agent loop.
- **Web Speech API** provides both speech recognition and speech synthesis in Chrome/Edge — fully local, zero setup.
- **Gemini Embedding API** (`gemini-embedding-2`) provides multimodal embeddings for text and photo uploads — requires internet for writes only.

See [docs/07-gaps-and-risks.md](docs/07-gaps-and-risks.md) for the sourced details.
