# 11 — End-to-End Code Setup Plan

The concrete build plan: repo layout, every file and what it owns, exact setup, and the
order to write it in. This is the executable companion to the strategy in
[08](08-implementation-plan.md) and the corrections in
[10](10-critical-review-and-revised-plan.md). Every decision from doc 10 is already baked
in here — if this plan and docs 02/03/06 disagree, **this plan wins**.

## Build-blind constraint (read first)

The code is authored on a **Windows** machine and **will not run there**; it runs on the
**demo Mac**. Consequences that shape everything below:

- **No "just run it" safety net while writing.** The only local checks are `tsc --noEmit`
  and `eslint`. So: strict TypeScript, Zod-validate every boundary, and give each file an
  **acceptance check** (below) to run the first time it reaches the Mac.
- **Split the stack by where it can be exercised:**
  - *OS-neutral, testable anywhere (incl. Windows/Docker):* Next.js app, agent loop,
    Neo4j + ChromaDB (Docker), Ollama logic (Ollama has a Windows build — **no MLX**, but
    tool-calling/embeddings behave the same), seed scripts.
  - *Mac-only, verify on the Mac:* MLX acceleration (`gemma4:12b-mlx`, 32 GB+), Web Speech
    **on-device** STT/TTS, `getUserMedia` camera, the full latency budget.
- **Therefore develop in two rings:** get the OS-neutral core green on Docker + Windows
  Ollama first (M1 logic), then do a single "Mac bring-up" pass for the Mac-only pieces
  (voice, MLX, camera). The plan is ordered so nothing Mac-only blocks the core.
- **Commit config, not secrets.** `.env.example` is committed; `.env.local` is gitignored.
  `GEMINI_API_KEY` is **server-only** — it never reaches the browser (the Live path uses
  ephemeral tokens).

---

## 1. Repository layout

```
anchor/
├── .env.example                 # committed; documents every env var
├── .gitignore                   # add: .env.local, /data, node_modules, .next
├── docker-compose.yml           # Neo4j + ChromaDB (OS-neutral)
├── package.json
├── tsconfig.json                # "strict": true
├── next.config.mjs
├── tailwind.config.ts
├── scripts/
│   ├── services.sh              # Mac: ollama serve check + docker compose up
│   ├── services.ps1             # Windows dev equivalent
│   ├── check-services.ts        # health-pings Ollama/Neo4j/Chroma, exits nonzero on fail
│   ├── init-schema.ts           # Neo4j constraints/indexes + Chroma collections
│   └── seed.ts                  # runs the seed fixture end-to-end
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                     # conversation view
│   │   ├── caregiver/page.tsx           # seed/edit screen
│   │   └── api/
│   │       ├── agent/route.ts           # POST — text/memory path (streams)
│   │       ├── perception/route.ts      # POST — still-frame local vision
│   │       ├── live-token/route.ts      # POST — mint ephemeral Gemini Live token
│   │       └── seed/route.ts            # POST — populate demo data
│   ├── lib/
│   │   ├── config.ts            # env parsing (Zod), model ids, ports, flags
│   │   ├── ollama.ts            # ai-sdk-ollama provider + raw ollama client
│   │   ├── router.ts           # channel routing (+ optional flagged text classifier)
│   │   ├── pii.ts              # write-path PII filter (NOT read path)
│   │   ├── agent/
│   │   │   ├── loop.ts         # streamText + tools, stopWhen(stepCountIs(3))
│   │   │   ├── tools.ts        # AI SDK tool() definitions (Zod params)
│   │   │   └── dispatch.ts     # deterministic fallback: intent → memory fn directly
│   │   ├── memory/
│   │   │   ├── neo4j.ts        # driver + typed graph queries
│   │   │   ├── chroma.ts       # client + collection accessors (explicit no-op embedFn)
│   │   │   ├── embed.ts        # LOCAL embeddinggemma via Ollama (single source of vectors)
│   │   │   ├── query.ts        # blended graph+vector queryMemory
│   │   │   └── write.ts       # write pipeline: PII → Neo4j Episode → embed → Chroma
│   │   ├── live/
│   │   │   ├── token.ts        # server-side ephemeral token mint
│   │   │   └── declarations.ts # AI SDK tools → @google/genai FunctionDeclarations
│   │   └── types.ts            # shared domain types (Person, Medication, Episode, …)
│   ├── components/
│   │   ├── ConversationView.tsx
│   │   ├── MicButton.tsx       # SpeechRecognition, on-device mode requested
│   │   ├── speaker.ts          # sentence-buffered SpeechSynthesis
│   │   ├── CameraButton.tsx    # getUserMedia still-frame + live trigger
│   │   ├── LiveSession.ts      # browser-side Gemini Live client (uses ephemeral token)
│   │   └── CaregiverPanel.tsx
│   └── data/
│       └── seed-data.ts        # SEED_DATA fixture (from doc 09 §6, embeddings done at seed time)
└── data/                        # gitignored volumes: data/neo4j, data/chroma
```

---

## 2. Dependencies & config

`package.json` (pin exact versions **at build time on the Mac** — the majors matter more
than the patch):

```jsonc
{
  "dependencies": {
    "next": "^15",            // App Router; provides after() for durable async writes
    "react": "^19",
    "react-dom": "^19",
    "ai": "latest",           // note the installed MAJOR — it drives ai-sdk-ollama major
    "ai-sdk-ollama": "latest",// jagreehal; align major to `ai` (README: @^3 for ai v6)
    "@google/genai": "latest",// Gemini Live + (stretch) gemini-embedding-2
    "neo4j-driver": "^5",
    "chromadb": "latest",     // API changed across majors — verify client ctor + query shape
    "zod": "^3"
  },
  "devDependencies": { "typescript": "^5", "tailwindcss": "^4", "eslint": "^9" },
  "scripts": {
    "dev": "next dev",
    "typecheck": "tsc --noEmit",
    "services": "bash scripts/services.sh",
    "check": "tsx scripts/check-services.ts",
    "schema": "tsx scripts/init-schema.ts",
    "seed": "tsx scripts/seed.ts"
  }
}
```

> **Version-drift watchlist** (verify against installed versions, don't trust these names blind):
> `ai` tool-loop API (`stopWhen: stepCountIs(n)` on v5+, was `maxSteps` on v4); `ai-sdk-ollama`
> major-alignment; `chromadb` client constructor + `query()` result shape; current Gemini
> **Live** model id and the ephemeral-token API surface in `@google/genai`.

`.env.example`:

```
# Server-only. NEVER exposed to the browser.
GEMINI_API_KEY=

# Local services
OLLAMA_BASE_URL=http://localhost:11434
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=testpassword
CHROMA_URL=http://localhost:8000

# Model ids (set on the Mac after `ollama list`)
GEMMA_MODEL=gemma4:12b          # or gemma4:12b-mlx on a 32GB+ Mac
EMBED_MODEL=embeddinggemma      # LOCAL embeddings — keeps the read path offline
GEMINI_LIVE_MODEL=              # look up current Live model id at build

# Feature flags
USE_LLM_ROUTER=false            # false = route by input channel (default); true = flagged text classifier
USE_MLX=false                   # true only on 32GB+ Mac (sets OLLAMA_USE_MLX at launch)
```

`docker-compose.yml` — Neo4j + ChromaDB, runs identically on Windows/Mac (this is why the
core is testable off the Mac):

```yaml
services:
  neo4j:
    image: neo4j:5
    ports: ["7474:7474", "7687:7687"]
    environment: { NEO4J_AUTH: "neo4j/testpassword" }
    volumes: ["./data/neo4j:/data"]
  chroma:
    image: chromadb/chroma:latest    # pin a tag on the Mac to match the JS client major
    ports: ["8000:8000"]
    volumes: ["./data/chroma:/data"]
```

---

## 3. The decisions, encoded (where each doc-10 fix lives in code)

| Doc-10 fix | Where it's implemented | The rule in code |
| --- | --- | --- |
| B1 local embeddings | `lib/memory/embed.ts` | **One** embedder for both writes and read-queries: `embeddinggemma` via Ollama. `gemini-embedding-2` appears **only** in a separate stretch module, never mixed. |
| B2 tool-calling fallback | `agent/loop.ts` + `agent/dispatch.ts` | `loop.ts` tries the LLM tool loop; if `USE_LLM_ROUTER=false` or tool-calling is disabled, `dispatch.ts` calls memory fns directly from the resolved intent. |
| B3 Live token | `api/live-token/route.ts` + `live/token.ts` + `components/LiveSession.ts` | Server mints a short-lived token; browser opens the Live socket. API key stays server-side. |
| B4 latency | `router.ts` (no LLM hop by default) + `loop.ts` (`stepCountIs(3)`) + `speaker.ts` (stream) | Read path = 1 answer call (+ local embed), not 3–7. |
| B5 PII on write only | `pii.ts` called **only** from `memory/write.ts` | The agent read path never calls the PII filter. |
| B6 TTS | `components/speaker.ts` | Buffer deltas, flush on `.!?`, new utterance per sentence. |
| B7 Routine time | `memory/neo4j.ts` + `types.ts` | Store next-occurrence datetime; honor `recurrence`; no string-vs-datetime compare. |
| B8 durable writes | `memory/write.ts` via `after()` | Use Next.js `after()` (v15) so the write survives response teardown. |
| B9 channel routing | `router.ts` | Text → memory; camera-still → perception; live toggle → cloud. No LLM needed to route. |

---

## 4. Critical snippets (the bits doc 10 flagged as bug-prone — get these right once)

**Durable async write — `memory/write.ts`:**
```typescript
import { after } from 'next/server';
export function scheduleMemoryWrite(raw: string, entityRefs?: string[]) {
  after(async () => {                       // survives after the response streams
    const clean = await piiFilter(raw);      // PII on the WRITE path only
    const episodeId = await neo4jCreateEpisode(clean, entityRefs);
    const vec = await embedLocal(clean);      // embeddinggemma via Ollama — same space as reads
    await chromaUpsert(episodeId, clean, vec, entityRefs);
  });
}
```

**Sentence-buffered TTS — `components/speaker.ts`:**
```typescript
let buf = '';
export function pushDelta(text: string) {
  buf += text;
  const parts = buf.split(/(?<=[.!?])\s+/);      // flush complete sentences
  buf = parts.pop() ?? '';
  for (const s of parts) if (s.trim()) speak(s.trim());
}
export function flush() { if (buf.trim()) { speak(buf.trim()); buf = ''; } }
function speak(sentence: string) {
  const u = new SpeechSynthesisUtterance(sentence); // NEW utterance per sentence
  speechSynthesis.speak(u);                          // enqueues in order, no mid-word splits
}
```

**Ephemeral Live token — `api/live-token/route.ts` (server):** mint a short-lived token
with `@google/genai` and return only the token; the browser (`LiveSession.ts`) connects to
Gemini Live with it. The `GEMINI_API_KEY` never leaves the server. *(Confirm the exact
token-mint call on the installed `@google/genai` at build — see watchlist.)*

**Chroma collection — `memory/chroma.ts`:** create `episodic` with an **explicit no-op
embedding function** (we always pass our own vectors) and the dimension from a real
`embeddinggemma` call (768). Metadata: `episodeId, namespace, timestamp, importance,
entityIds, source, piiFiltered`.

**On-device STT — `components/MicButton.tsx`:** construct `SpeechRecognition`, request
on-device/local processing (Chrome 139+ service-type flag), and fail over to the text
input if the language pack isn't installed.

---

## 5. Build order (with per-file acceptance checks)

Each step lists what to run **on the Mac** (or Docker anywhere) to prove it — because you
can't prove it while writing on Windows.

### Ring 0 — Scaffold & services (OS-neutral)
1. `create-next-app` (TS + Tailwind + App Router), add deps, `tsconfig` strict, `.env.example`, `.gitignore`, `docker-compose.yml`.
2. `lib/config.ts` — Zod-parse env; throws loudly if a required var is missing.
3. `scripts/check-services.ts` — pings Ollama `/api/tags`, Neo4j (bolt), Chroma `/api/v2/heartbeat`.
   - **Check:** `docker compose up -d && npm run check` → all green.

### Ring 1 — Memory core (OS-neutral: Docker + Windows Ollama)
4. `types.ts`, `memory/neo4j.ts`, `scripts/init-schema.ts` (constraints/indexes from doc 09 §3; fix `Routine` time model, B7).
   - **Check:** `npm run schema` then create+read a node via a scratch call.
5. `memory/embed.ts` (embeddinggemma via Ollama) + `memory/chroma.ts`.
   - **Check:** embed a string → get a 768-vector; upsert + query it back from Chroma.
6. `data/seed-data.ts` + `scripts/seed.ts` (+ `api/seed/route.ts`): Neo4j nodes/edges, embed each episode **locally**, upsert to Chroma.
   - **Check:** `npm run seed` → Neo4j browser shows the graph; Chroma has ~15 docs.
7. `memory/query.ts` (blended graph+vector) + `agent/tools.ts` + `agent/dispatch.ts`.
   - **Check:** unit-call `queryMemory("morning pills","today")` → grounded blended result.

### Ring 2 — Agent loop & API (OS-neutral)
8. `lib/ollama.ts`, `router.ts` (channel routing; classifier behind `USE_LLM_ROUTER`), `agent/loop.ts` (`stepCountIs(3)`), `pii.ts`, `memory/write.ts` (`after()`).
9. `api/agent/route.ts` — POST, streams; fires `scheduleMemoryWrite` on completion.
   - **Check (the M1 gate):** `curl -N localhost:3000/api/agent` with *"Did I take my morning pills?"* → grounded streamed answer **with Wi-Fi off** (proves B1). Confirm the tool loop *and* the `dispatch.ts` fallback both answer.

### Ring 3 — Mac bring-up (Mac-only; single focused pass)
10. Choose Gemma build by RAM (decision 6): 32 GB+ → `gemma4:12b-mlx` + `USE_MLX=true`; 16 GB → `gemma4:12b`. Install on-device speech language pack.
11. UI: `page.tsx`, `ConversationView`, `MicButton` (on-device STT), `speaker.ts` (buffered TTS), `CameraButton`, `CaregiverPanel`.
    - **Check (M2 gate):** speak a question → hear a grounded answer offline; record real latency.
12. `api/perception/route.ts` — still frame → Ollama vision.
    - **Check:** point camera at an object → local description.

### Ring 4 — Cloud path
13. `live/token.ts` + `api/live-token/route.ts` + `live/declarations.ts` + `components/LiveSession.ts`.
    - **Check (M3 gate):** camera "live" trigger → Gemini Live answer grounded in seeded memory, spoken back; verify `GEMINI_API_KEY` is absent from all browser network traffic.

### Ring 5 — Stretch & hardening
14. Photo upload → `gemini-embedding-2` → **separate** Chroma collection (never mixed, B1).
15. `services.sh`/`.ps1` one-command startup; re-seed + restart persistence check; airplane-mode test that passes; fallback screen recording; consent one-liner in the demo script.

---

## 6. Definition of done for "code setup"

- `npm run check` green; `npm run schema && npm run seed` populate both stores.
- `npm run typecheck` clean (the primary safety net for build-blind work).
- Ring-2 gate passes offline on the Mac (local answer, no network).
- Ring-3/4 gates pass on the Mac (voice offline; Live via ephemeral token, key server-side).
- One-command bring-up on a fresh Mac boot from the committed repo + `.env.local`.

---

## 7. What I can scaffold now vs. what waits for the Mac

**Can write now, correct build-blind** (typecheck-verifiable): the entire repo skeleton,
`config`, all `lib/` modules, API routes, seed, components, scripts, compose, env template.
**Must be verified on the Mac** (not writable-blind): MLX activation, on-device Web Speech,
`getUserMedia`, the current Gemini Live model id + token-mint call, and the real latency
numbers. Those are marked in the watchlist and the Ring-3/4 checks.
