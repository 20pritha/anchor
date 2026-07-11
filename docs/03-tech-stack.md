# 03 — Tech Stack

TypeScript + Python + shell. Every runtime layer is chosen for a single-developer hackathon: minimal moving parts, well-documented APIs, and a clear upgrade path if something hits a wall.

| Layer | Tech | Exact artifact / notes |
| --- | --- | --- |
| App shell & UI | **Next.js** (TypeScript) + **Tailwind CSS** | Browser-based UI: conversation view, caregiver seeding screen, camera/mic trigger. Hosted locally on the MacBook (`localhost`). |
| Orchestration | **Vercel AI SDK** (`ai`) | `streamText` + `tool()` API for agent loop. Ollama provider (`@ai-sdk/ollama`) for local Gemma 4. Handles streaming, tool calling, multi-turn. |
| On-device inference | **Gemma 4 12B** (or E4B) via **Ollama + MLX** | Ollama with MLX backend is the fastest path on Apple Silicon. Gemma 4 12B Q4_K_M (~7.6 GB) fits 16 GB MacBooks at ~25 tok/s. Handles intent routing, PII filtering, answer generation, single-shot perception. |
| Tool calling & agent loop | **Custom agent loop** built on Vercel AI SDK `generateText` / `streamText` | Wraps Ollama tool-calling, dispatches to Neo4j/ChromaDB tools, manages conversation history. See [06-agent-loop.md](06-agent-loop.md). |
| Graph memory | **Neo4j** (local) | `brew install neo4j`. Stores entity graph: people, medications, routines, places, objects, and their relationships. JavaScript driver via `neo4j-driver` npm package. |
| Vector memory | **ChromaDB** (local server) | Local ChromaDB server (`chroma run --path ./data`). Stores episodic memory embeddings. JavaScript client via `chromadb` npm package. |
| Embeddings | **Gemini Embedding API** (`gemini-embedding-2`) | Multimodal embeddings (text + photos). Called via `@google/genai` JS SDK. Internet required for write path; read path is local ChromaDB vector search. |
| Cloud reasoning | **Gemini Live API** (`@google/genai` JS SDK) | Stateful WebSocket, streaming vision/audio, function calling, barge-in. Trigger-based only — invoked by intent router for live voice/video. |
| Speech input | **Web Speech API** (`SpeechRecognition`) | Browser-native, works in Chrome/Edge. Zero dependencies, fully local. |
| Speech output | **Web Speech API** (`SpeechSynthesis`) | Browser-native TTS. Zero dependencies, fully local. |
| Camera | **`getUserMedia`** (browser API) | Captures frames from laptop camera. Single frames sent to local Gemma 4 vision; live stream sent to Gemini Live API. |
| PII filter | **Gemma 4** (local, via Ollama) | Post-processing call in the agent loop — strips very-sensitive fields before any memory write or cloud call. |
| Async / concurrency | **JavaScript Promises + async/await** | Async memory writes, embedding generation, non-blocking pipeline. Fire-and-forget for memory writes parallel with TTS. |

## Why these choices (short form)

- **TypeScript end-to-end** — Next.js, Vercel AI SDK, Neo4j driver, ChromaDB client, `@google/genai` — all native npm packages. One language, one runtime, no bridges.
- **Ollama + MLX over raw llama.cpp** — Ollama handles GPU detection, quantization, chat templates, and provides an OpenAI-compatible API + native JS SDK. MLX backend is the fastest inference on Apple Silicon. One command to serve any model.
- **Neo4j + ChromaDB over SQLite** — The domain is inherently relational (people know each other, take medications, follow routines). A graph DB models this naturally. ChromaDB adds purpose-built vector search with metadata filtering, collections, and a simple API. Both run as local services with zero cloud dependency.
- **Gemini Embedding API over local embeddings** — Higher quality multimodal embeddings (text + photos), on-brand for the Google hackathon, and the write path is async so network dependency is acceptable. Read path (vector search) is still local.
- **Vercel AI SDK over LangChain or raw Ollama** — Lighter than LangChain, purpose-built for streaming, native Next.js integration, clean tool-calling API with Zod schemas. The Ollama community provider means zero cloud LLM dependency in dev.
- **Web Speech API over cloud STT/TTS** — Fully local, zero setup, zero cost. Chrome's SpeechRecognition works offline. Quality is acceptable for a demo.

## Services to run locally (day 0)

| Service | How to start | Depends on |
| --- | --- | --- |
| Ollama | `ollama serve` (auto-starts) | Gemma 4 model file (`ollama pull gemma4:12b`) |
| Neo4j | `brew services start neo4j` | Java runtime |
| ChromaDB | `chroma run --path ./data` | Python 3 + `pip install chromadb` |
| Next.js dev server | `npm run dev` | Node.js 20+ |
