# Anchor

A dignity-preserving memory companion for people with mild cognitive impairment (MCI) / early dementia and their caregivers. Anchor runs **local-first on a single machine** using **Gemma 4 via Ollama** for perception, reasoning, and memory, and reaches to the cloud (Gemini Live API) only when real-time streaming vision/audio is genuinely needed.

**Core principle:** *Cloud is an enhancement, not a dependency.* Everything essential works offline.

> Anchor is **not a medical device** — just a memory companion.

---

## What it does

- **Remembers the person's world** — people, medications, routines, places, objects, and episodic events — as a structured, queryable memory store (Neo4j graph + ChromaDB vectors).
- **Answers in the moment** — "Did I take my morning pills?", "Where are my keys?", "Who is coming today?" — from local memory, by voice or text, with no network round-trip in the common case.
- **Perceives when asked** — trigger-based (not always-on): point the camera at something and Anchor reasons about the scene using on-device Gemma 4, or opens a live Gemini session for real-time streaming.
- **Preserves dignity** — sensitive information is filtered before storage, perception is trigger-based, and the tone is supportive, never clinical.

## App surface

- **Chat** — ask questions by voice or text; answers stream back and are spoken aloud.
- **Memory** — add unstructured notes / upload `.txt` / `.md` files, and explore the knowledge graph.
- **Recent activity** — the latest additions and changes to the knowledge base.
- **Caregiver** — seed or edit people, medications, routines, places, and objects.
- **About** — how the system works.

## Architecture

Two paths, one memory:

- **Local path (default):** input → Gemma 4 (Ollama) picks a memory tool → Neo4j (structured) + ChromaDB (semantic recall over episodes) → Gemma composes a short, warm answer. No data leaves the machine.
- **Cloud path (on demand):** a live camera session mints a short-lived Gemini Live token server-side (the API key never reaches the browser); the browser streams video/audio directly to Gemini Live, which calls back into the same memory tools so cloud answers stay grounded in local memory.

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | Next.js 16 + React 19 |
| Local reasoning | Gemma 4 via Ollama |
| Local embeddings | embeddinggemma via Ollama |
| Graph memory | Neo4j |
| Episodic memory | ChromaDB |
| Cloud reasoning | Gemini Live API |
| Voice | Web Speech API |

## Running locally

Requires Node ≥ 20.9, Docker, and [Ollama](https://ollama.com).

```bash
cp .env.example .env.local        # fill in GEMINI_API_KEY for the cloud path (optional for local-only)
npm install
docker compose up -d              # Neo4j + ChromaDB
```

Pull the models with Ollama, then set `GEMMA_MODEL` in `.env.local` to match what you pulled:

```bash
ollama pull gemma4:12b            # or another Gemma 4 size / mlx variant
ollama pull embeddinggemma
```

Then:

```bash
npm run check                     # health-check Ollama / Neo4j / ChromaDB
npm run schema                    # Neo4j constraints + indexes
npm run seed                      # demo fixture (graph + vectors)
npm run dev                       # http://localhost:3000
```

## Environment

See [.env.example](.env.example). `GEMINI_API_KEY` is server-only (used to mint ephemeral Live tokens) and is never exposed to the browser. `.env.local` is gitignored — never commit real secrets.
