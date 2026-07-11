# 01 — Product Overview

## The problem

People with mild cognitive impairment (MCI) or early-stage dementia lose the everyday scaffolding of memory: where they put things, whether they took their medication, who a visitor is, what they did earlier today. The existing tools are either clinical trackers (cold, admin-heavy) or generic reminder apps (dumb, no context). Caregivers carry the invisible load of being the patient's external memory.

## The user

Two users, one laptop:

- **The person with MCI / early dementia** — the primary user. Interacts by voice and by pointing the camera at things ("where do I put this?", "did I take my pills?"). Needs answers that are calm, short, and never make them feel surveilled or diminished.
- **The caregiver** — secondary user. Seeds routines, medication schedules, and important people; reviews what happened; gets gentle nudges. May be co-located or remote, accessing via a shared web interface.

## What Anchor does

Anchor is an ambient memory companion that:

1. **Remembers the person's world** — people, medications, routines, places, and episodic events ("you had tea with Emily at 4pm") — as a structured, queryable memory store on the laptop.
2. **Answers in the moment** — "Did I take my morning pills?", "Who is coming today?", "Where are my keys?" — from local memory, by voice, with no network round-trip in the common case.
3. **Perceives when asked** — trigger-based (not always-on): the user invokes the camera/mic, and Anchor looks/listens and reasons about the scene using on-device Gemma 4.
4. **Preserves dignity** — sensitive information is filtered before storage, perception is trigger-based rather than continuous surveillance, and the tone is supportive, never corrective-scolding.

## The differentiator

Everything essential runs **on the laptop**. Cloud (Gemini Live + Gemini Embeddings API) is invoked only for genuinely real-time streaming interaction, multimodal embeddings, or reasoning that exceeds the local model. The core pitch: a memory companion for a vulnerable population that keeps their life on their own device by default.

## Hackathon scope (what we build vs. defer)

**In scope for the demo:**

- On-device Gemma 4 (via Ollama + MLX on MacBook) doing intent routing, PII filtering, memory scoring, and answering from memory.
- Neo4j graph store (people, medications, routines, places, objects) + ChromaDB vector store (episodic memory) with seeded synthetic history so the demo doesn't start empty.
- One tight, scripted trigger-based scenario that exercises both the local path and the cloud (Gemini Live) path.
- Voice input/output via Web Speech API + on-screen text in a Next.js browser UI.

**Explicitly deferred (parking lot, not for demo):**

- Full consent/oversight UX (flagged as a real product concern — see gaps doc §8).
- Pitch/positioning polish.
- Production deployment / packaging beyond the hackathon device.
- Continuous ambient perception (we do trigger-based only).

## Success criteria for the build

- A cold-start-safe demo: memory is pre-seeded and persists across app restarts.
- The local path answers a memory question end-to-end with no network call.
- The cloud path invokes Gemini Live for a live camera scene and returns a spoken answer.
- Perceived latency on the local path feels conversational (target budget in [02-architecture.md](02-architecture.md)).
