# 01 — Product Overview

## The problem

People with mild cognitive impairment (MCI) or early-stage dementia lose the everyday scaffolding of memory: where they put things, whether they took their medication, who a visitor is, what they did earlier today. The existing tools are either clinical trackers (cold, admin-heavy) or generic reminder apps (dumb, no context). Caregivers carry the invisible load of being the patient's external memory.

## The user

Two users, one device:

- **The person with MCI / early dementia** — the primary user. Interacts by voice and by pointing the camera at things ("where do I put this?", "did I take my pills?"). Needs answers that are calm, short, and never make them feel surveilled or diminished.
- **The caregiver** — secondary user. Seeds routines, medication schedules, and important people; reviews what happened; gets gentle nudges. May be co-located or remote.

## What Anchor does

Anchor is an ambient memory companion that:

1. **Remembers the person's world** — people, medications, routines, places, and episodic events ("you had tea with Emily at 4pm") — as a structured, queryable memory on the device.
2. **Answers in the moment** — "Did I take my morning pills?", "Who is coming today?", "Where are my keys?" — from local memory, by voice, with no network round-trip in the common case.
3. **Perceives when asked** — trigger-based (not always-on): the user invokes the camera/mic, and Anchor looks/listens and reasons about the scene.
4. **Preserves dignity** — sensitive information is filtered before storage, perception is trigger-based rather than continuous surveillance, and the tone is supportive, never corrective-scolding.

## The differentiator

Everything essential runs **on the device**. Cloud (Gemini Live) is invoked only for genuinely real-time streaming interaction or reasoning that exceeds the on-device model. This is the pitch's backbone: a memory companion for a vulnerable population that keeps their life on their own phone by default.

## Hackathon scope (what we build vs. defer)

**In scope for the demo:**

- On-device Gemma 4 (E4B) doing intent routing, PII filtering, memory scoring, and answering from memory.
- KoreDB memory store (graph + vector) with seeded synthetic history so the demo doesn't start empty.
- One tight, scripted trigger-based scenario that exercises both the local path and the cloud (Gemini Live) path.
- Voice output via Android native TTS + on-screen text.

**Explicitly deferred (parking lot, not for demo):**

- Full consent/oversight UX (flagged as a real product concern — see gaps doc §8).
- Pitch/positioning polish.
- Production model packaging/OTA of the multi-GB model file (use a pre-provisioned device for demo).
- Continuous ambient perception (we do trigger-based only).

## Success criteria for the build

- A cold-start-safe demo: memory is pre-seeded and persists across app restarts.
- The local path answers a memory question end-to-end with no network call.
- The cloud path invokes Gemini Live for a live camera scene and returns a spoken answer.
- Perceived latency on the local path feels conversational (target budget in [02-architecture.md](02-architecture.md)).
