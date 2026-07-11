# 10 — Critical Review & Revised Implementation Plan

A fresh, adversarial pass over docs 01–09. I re-verified the load-bearing factual
claims (web sources, July 2026) instead of trusting the "verified July 2026" stamp,
found where the plan contradicts itself, and rewrote the implementation plan so a
single builder can hit a working demo without walking into the traps below.

**TL;DR of what changed:** most product/schema thinking is sound. The damage is
concentrated in the **runtime + connectivity story**: the Android→MacBook pivot quietly
broke the "works offline" promise (cloud embeddings), overstated the runtime ("Ollama +
MLX on a 16 GB Mac"), named a package that doesn't exist (`@ai-sdk/ollama`), and drew a
latency budget that assumes 2 model calls when the loop actually makes 3–7. None are
fatal; all are cheaper to fix now than on demo morning.

---

## Part 1 — Assumption audit (what I re-verified)

| Claim in docs | Verdict | Detail |
| --- | --- | --- |
| **Gemma 4** exists, Apr 2 2026, sizes E2B/E4B/12B, multimodal, 12B fits 16 GB | ✅ **Correct** | 12B is a unified encoder-free multimodal model, text+image (video/audio native on E2B/E4B/12B), text output. Runs in ~16 GB unified memory. |
| **`gemini-embedding-2`** is multimodal (text + photos) | ✅ **Correct** | Natively multimodal — text/image/video/audio/docs into one space. But it is a **cloud** API and currently **preview**. This correctness is exactly what creates the offline contradiction below. |
| **Ollama + MLX** is the fastest local path for Gemma 4 12B | ⚠️ **True on 32 GB, no-op on 16 GB** | Corrected: a `gemma4:12b-mlx` build **does** exist on Ollama (vision/tools/audio, ~7.7 GB) — my earlier "not ported" claim was wrong. But the MLX *backend* only activates on **32 GB+ unified memory**; below that Ollama falls back to **llama.cpp Metal** even if you pull the `-mlx` tag. So: on a **32 GB+** Mac, `gemma4:12b-mlx` + `OLLAMA_USE_MLX=1` gives ~2× decode (and helps the latency problem in B4); on a **16 GB** Mac it's Metal regardless, and the doc's numbers (~7.6 GB Q4, ~25 tok/s) describe that Metal path. **Action: confirm the demo Mac's RAM and pick accordingly.** |
| **`@ai-sdk/ollama`** is the Ollama provider | ❌ **Does not exist → resolved** | No official Vercel package. **Decision: use `ai-sdk-ollama`** (jagreehal — built on the official `ollama` package, cross-provider compatible). `npm i @ai-sdk/ollama` fails; `npm i ai-sdk-ollama ai` is correct. |
| **Web Speech API** SpeechRecognition "works offline / fully local / zero setup" | ⚠️ **Cloud by default → resolved by config** | Chrome sends audio to Google servers by default (no offline). **Decision: configure on-device mode** (Chrome 139+, desktop) — it's a committed setup step, not "zero setup": requires explicitly requesting local processing + a **one-time language-pack download per language**, which must be installed on the demo Mac and listed in the known-good snapshot (M5). |
| **FunctionGemma (Gemma 3 270M)** fast router | ⚠️ **Verify at build** | A Gemma 3 270M exists; treat the "FunctionGemma" branding and its Ollama availability as unverified until pulled. It's a stretch item anyway. |

Net: the two product-defining facts (Gemma 4, multimodal embeddings) hold. The runtime
plumbing claims are where the doc drifts from reality.

---

## Part 2 — Gaps & contradictions, ranked by blast radius

### Tier 1 — Demo-killers (fix before building on them)

**B1. The offline promise is broken by cloud embeddings — and the naive fix makes it worse.**
This is the single most important finding. D1 says *"everything essential works offline; cloud is an enhancement."* But D9 moved embeddings to the **cloud** `gemini-embedding-2`. Any episodic query has to embed the **query** to search ChromaDB (09 §2 `queryMemory` calls `generateEmbedding(intent)` on the read path), so **every vector search is a network call**. Pipeline A's "No cloud call anywhere in this path" is false, and the M4/M5 "airplane-mode" test fails for any question that touches episodic memory (i.e. most of them). Only pure-graph (Neo4j) questions are truly offline.

The trap in the "obvious" fix: you **cannot** embed writes with cloud `gemini-embedding-2` and embed read-queries with a local model — the document vectors and the query vector would live in **different embedding spaces** and similarity search returns garbage. It is a hard either/or:

- **All-local embeddings** (e.g. `embeddinggemma` / `nomic-embed-text` via Ollama — the community Ollama provider already exposes an embeddings API) → offline genuinely works; you lose native image-embedding quality.
- **All-cloud `gemini-embedding-2`** → keep multimodal, but drop the "local path, no network" claim honestly.

Framing worth stating out loud: **the Android plan had this right** with on-device EmbeddingGemma. The pivot's D9 is what introduced the contradiction. **Recommendation for the demo: go all-local for episodic text embeddings** (`embeddinggemma` via Ollama) so the offline story is real, and use `gemini-embedding-2` *only* for the optional photo-upload stretch feature (M4), stored in a **separate** collection that is never mixed with the local-text space.

**B2. Ollama + Gemma 4 tool-calling through an unofficial provider is the #1 technical risk.** The docs already call this out (good) — keep it as the first thing proven on day 0. Added nuance: the provider itself is community-maintained (`ollama-ai-provider-v2`), and Gemma's tool-call reliability under multi-step (`maxSteps`) loops is the exact thing that wobbles. If the raw round-trip is flaky, the fallback is not "try harder" — it's **drop the LLM tool loop and dispatch tools from deterministic intent handlers** (see revised M1).

**B3. Gemini Live: the media and the API key live in different places.** Camera/mic come from `getUserMedia` in the **browser**; the API key must stay **server-side**. Doc 06/09 opens the Live WebSocket inside the Next.js route and then "streams camera + mic" — but the route has no access to the browser's media stream. Two real options: (a) **ephemeral auth tokens** — server mints a short-lived token, browser connects to Gemini Live directly (the Live API supports this); or (b) a server-side media relay (heavier). Pick (a). This is unspecified today and is a hard blocker for the cloud path.

**B4. The latency budget assumes 2 model calls; the loop makes 3–7.** The budget (02) counts one routing call + one answer call = ~0.9–1.8 s. The actual local path runs: **PII filter (Gemma)** → **router (Gemma)** → **answer with tool calling, `maxSteps: 5`** (up to 5 more Gemma round-trips) → **+ a cloud embedding call** if vector search is used. On a 16 GB Mac (llama.cpp Metal, not MLX), first-token latency of a 12B alone is often ~1 s. The realistic budget is several seconds unless the loop is cut down. Fixes are in the revised plan: remove PII from the read path, collapse or drop the LLM router, cap tool steps, stream to TTS.

### Tier 2 — Correctness bugs (will misbehave when you run them)

**B5. PII filtering is on the wrong path.** The loop PII-filters the **inbound user query** before routing (06 step 2). PII belongs on the **write** path (before storage / before a cloud call), not on every read. Filtering a question ("Did I take my pills?") buys nothing, adds a full 12B call to the latency-critical path, and risks mangling the query. Move PII to the write pipeline only.

**B6. Streaming-to-TTS as written stutters.** The browser snippet (06) reuses one `SpeechSynthesisUtterance`, sets `.text` to each raw network chunk, and calls `speak()` per chunk. Chunks split mid-word, `speak()` **enqueues**, and you get overlapping/choppy fragments. Fix: buffer deltas, flush on sentence boundaries (`.!?`), and create a **new** utterance per sentence.

**B7. `Routine.time` is a string but queried as a datetime.** Schema stores `time: "07:00"` (05), but the "upcoming routines" Cypher does `WHERE rt.time >= $now AND rt.time <= $endOfWindow` treating it as an absolute datetime, and ignores `recurrence`. String vs datetime comparison won't return what you expect. Decide a representation (store next-occurrence datetime, or compare as time-of-day) and honor `recurrence`.

**B8. `setTimeout(…, 0)` fire-and-forget dies in a Next.js route.** After the response streams, the route/serverless context can be torn down before the async memory write runs (D11 / 06). Use Next.js `after()` (v15) or a `waitUntil`-style mechanism, or a tiny in-process queue, so writes actually complete.

**B9. The text intent router can't classify an image trigger.** Perception is a **UI button** with a camera frame and often no text. A text-only router (06) can't route it, and "still-frame → local vs live-stream → cloud" is a UI/heuristic decision, not something the LLM infers from text. Route by **input channel**, not by asking the model.

### Tier 3 — Nits / version drift (fix in passing; verify at build, don't over-invest)

- **B10.** `@ai-sdk/ollama` → **`ai-sdk-ollama`** (jagreehal). Align its major to your AI SDK major (per its README: `ai-sdk-ollama@^3` for AI SDK v6, latest for v7). *Verify version pinning at build time.*
- **B11.** `maxSteps: 5` is v4-era; AI SDK v5+ uses `stopWhen: stepCountIs(5)`. *Verify against installed SDK version.*
- **B12.** ChromaDB collection dim guess "768 or 1024" is wrong for `gemini-embedding-2` (MRL sizes ~768/1536/3072) and irrelevant if you go local (`embeddinggemma` = 768). Set the dimension from a real first call. Also: current Chroma JS clients require an explicit `embeddingFunction` (set it to a no-op when you supply your own vectors) or they try to download an embedder.
- **B13.** `gemini-2.0-flash-live-preview` (06) is a stale model id for July 2026 — look up the current Live model at build.

### Cross-cutting product note (not a bug, but load-bearing)

**B14. "Dignity-preserving" is the entire pitch, and consent/oversight is parked.** Deferring the *build* of consent UX is fine for a hackathon; deferring the *narrative* is not, because dignity is the differentiator (01, D13, G11). The one-liner is cheap and should be in the demo script: *trigger-based perception (never always-on) + on-device storage + an explicit "what is never recorded" list.* Also be honest internally that an **LLM PII filter is best-effort, not a guarantee** — don't sell it as one.

**B15. The LLM router is buying little for its latency.** Modality is already encoded by the input channel (typed text → memory; camera button → perception/cloud). A dedicated 12B routing call mostly re-derives what the UI already knows. Keep a cheap classifier only for the genuinely ambiguous text case (memory vs "this needs the cloud"), or drop it and default typed text to the memory path.

---

## Part 3 — Corrections to fold back into docs 02 / 03 / 06

These carry the "verified July 2026" stamp but are now known wrong. Left in place they'll
keep reading as fact. Minimal edits (not a rewrite):

- **03 (Tech Stack) & 02:** replace `@ai-sdk/ollama` with `ai-sdk-ollama`; reword "Ollama + MLX … fits 16 GB Macs" to "Ollama on the demo Mac: `gemma4:12b-mlx` + `OLLAMA_USE_MLX=1` **iff the machine has 32 GB+** (≈2× decode); on 16 GB, Ollama runs llama.cpp Metal (~25 tok/s) regardless of the `-mlx` tag."
- **03 & D14/G6:** Web Speech is **cloud by default**; offline requires **explicitly enabling on-device mode + a per-language pack** (Chrome 139+, desktop). Reword "works offline / zero setup" to "offline once on-device mode is configured and the language pack is installed."
- **02 Pipeline A & 06:** either (a) switch episodic embeddings to local so "no network on the local path" becomes true, or (b) strike that claim. Don't leave both the claim and the cloud-embedding read path.
- **02 latency table:** add the PII + router + per-tool-step + embedding hops, or remove them from the loop per the revised plan so the table becomes true again.
- **06:** move PII filter to the write path; fix the TTS loop; note Gemini Live uses ephemeral tokens from the browser, not a server-held socket.

---

## Part 4 — Revised implementation plan

Same spirit and roughly the same size as doc 08 (single builder, linear, always a
demoable slice). The changes: **cut cloud dependencies out of the critical path**, **prove
the two real blockers first**, and **make the offline claim honest**. Checkboxes are the
build order.

### Decisions this plan locks (resolving the contradictions above)

1. **Episodic embeddings run locally** (`embeddinggemma` or `nomic-embed-text` via Ollama). `gemini-embedding-2` is used **only** for the optional photo-upload stretch, in a separate collection. → offline is real (B1).
2. **PII filtering is write-path only.** → read path loses a 12B hop (B5).
3. **Route by input channel, not by an LLM call.** Typed text → memory path; camera button → perception; a "needs live" toggle/heuristic → cloud. Keep an optional tiny text classifier behind a flag. → removes a 12B hop (B4/B15).
4. **Tool dispatch has a deterministic fallback.** If Gemma tool-calling is flaky, intent handlers call the memory functions directly. → de-risks B2.
5. **Gemini Live connects from the browser via an ephemeral token** minted server-side. → resolves B3.
6. **Runtime:** confirm the demo Mac's RAM. **32 GB+** → `gemma4:12b-mlx` + `OLLAMA_USE_MLX=1` (≈2× decode, helps B4). **16 GB** → standard `gemma4:12b` on llama.cpp Metal (the `-mlx` tag brings no speedup below 32 GB) and budget RAM carefully against Neo4j + ChromaDB + Chrome.
7. **Provider is `ai-sdk-ollama`** (jagreehal), major-aligned to the installed AI SDK.
8. **Chrome speech runs in on-device mode** with the language pack pre-installed (offline is a configured state, not a default).

### Milestone 0 — Day-0 de-risk (do the scary ones first, any order)

- [ ] **Confirm demo-Mac RAM → pick the Gemma build** (decision 6): 32 GB+ → `gemma4:12b-mlx` + `OLLAMA_USE_MLX=1`; 16 GB → `gemma4:12b`. Measure first-token latency + tok/s for a routing-size and an answer-size prompt on the **actual demo Mac**. Record RAM headroom with Neo4j + ChromaDB + Chrome also running (this is the real constraint, not tok/s).
- [ ] **Tool-calling round-trip** through `ai-sdk-ollama`: one trivial tool, declaration in → tool call out → parsed. **Gate:** if flaky, adopt the deterministic-dispatch fallback (decision 4) *now*, don't push through.
- [ ] **Local embeddings smoke test:** `ollama pull embeddinggemma` (or `nomic-embed-text`), embed a string, record the dimension → this sets the ChromaDB collection dim.
- [ ] **Neo4j** smoke: node+edge via `neo4j-driver`, query back, confirm persistence across restart.
- [ ] **ChromaDB** smoke: start server, create `episodic` collection with the recorded dim and an explicit no-op embedding function, insert a vector with metadata, query with a `where` filter.
- [ ] **Gemini Live reachability + ephemeral token:** mint a short-lived token server-side, open a Live session from a throwaway browser page, get one response. Confirms B3's approach before M3 depends on it.
- [ ] **Next.js scaffold** with correct deps: `ai ai-sdk-ollama @google/genai neo4j-driver chromadb zod` (major-align `ai-sdk-ollama` to `ai`).

**Exit gate:** tool-calling works (or fallback chosen); local embeddings return vectors; both DBs read/write; Live token flow proven. Any failure stops M1.

### Milestone 1 — Local path skeleton (text in, text out, **fully offline**)

- [ ] **Channel router** (not an LLM): typed text → `memory`. Optional flagged text classifier for memory-vs-cloud only.
- [ ] **Memory tools** against Neo4j: `getMedicationStatus`, `locateObject`, `listUpcoming`, `queryMemory` (graph branch). Fix `Routine.time`/`recurrence` (B7).
- [ ] **Vector branch** of `queryMemory`: embed query **locally**, search ChromaDB, blend with graph results.
- [ ] **Agent loop** via `streamText` + tools, `stopWhen: stepCountIs(3)` (cap steps, B4/B11). Verify the deterministic-dispatch fallback path also answers if tool-calling is off.
- [ ] **Seed fixture** (per 09 §6): User, 3–4 Persons, 2–3 Medications, Routines, Objects, ~12–15 Episodes embedded **locally**.
- [ ] **Integration test:** "Did I take my morning pills?" → grounded answer from seed, **with Wi-Fi off**. This is the proof B1 is fixed.

**Exit gate:** typed query → grounded streamed answer, network disabled, end-to-end time measured.

### Milestone 2 — Voice + UI + write path

- [ ] **UI shell:** conversation view, text input, camera/mic trigger button (Tailwind).
- [ ] **Speech in:** `SpeechRecognition`; **explicitly enable on-device mode + document the language-pack step** (B-webspeech). Ship a text-input fallback.
- [ ] **Speech out:** buffer deltas, flush on sentence boundaries, new utterance per sentence (B6).
- [ ] **Write path:** PII filter (write-path only, B5) → Neo4j Episode → **local** embedding → ChromaDB, run via `after()`/queue so it survives response teardown (B8).
- [ ] **Caregiver screen:** seed/edit people, meds, routines → Neo4j.
- [ ] **LRU pre-warm** of hot entities (today's meds, key people).
- [ ] **Latency pass:** speak → spoken answer; compare to a **revised, honest** budget (measured, not the old 2-call fantasy).

**Exit gate:** spoken question → grounded spoken answer, offline, with a real latency number.

### Milestone 3 — Cloud path (Gemini Live)

- [ ] **Browser-side Live session** using the ephemeral token from M0 (B3). Stream camera+mic; receive text; speak via Web Speech.
- [ ] **Grounding:** translate the shared memory tools into `@google/genai` FunctionDeclarations (they are **not** the same objects as AI SDK `tool()` — B-tools); handle `toolCall` messages server-side or via a grounding endpoint.
- [ ] **PII on cloud writebacks** (write-path filter reused).
- [ ] **Channel routing:** camera "live" trigger → cloud; single still frame → local Gemma vision (Ollama `images:`), no LLM router needed (B9).

**Exit gate:** trigger camera → "what is this and is it mine?" → Live answer grounded in seeded memory, spoken back.

### Milestone 4 — Stretch (cut first)

- [ ] Photo upload → `gemini-embedding-2` → **separate** ChromaDB collection (never mixed with local-text space, B1).
- [ ] FunctionGemma / Gemma-3-270M fast router — only if a text classifier is actually needed and 12B routing is measured too slow.
- [ ] Demo scenario scripted + rehearsed twice.

### Milestone 5 — Demo hardening

- [ ] Re-seed; verify Neo4j + ChromaDB persistence across restart.
- [ ] Known-good snapshot: all services up, models pulled (incl. local embedder), seed present, on-device speech language pack installed.
- [ ] **Airplane-mode test that actually passes:** local path (Ollama + Neo4j + ChromaDB + local embeddings + on-device speech) with Wi-Fi off. Cloud path degrades gracefully to local still-frame vision.
- [ ] Fallback screen recording of the working demo.
- [ ] One-line consent/dignity statement in the demo script (B14).

### Critical path

```
M0 (tool-calling OR fallback  +  LOCAL embeddings  +  Live token)
      │
      ▼
M1 (offline local path: channel router + memory tools + local vectors + seed)
      │
      ▼
M2 (voice + write-path PII + durable async write + sentence-buffered TTS)
      │
      ├──► M3 (cloud path via ephemeral token, grounded)
      └──► M4 (stretch) ──► M5 (harden, real airplane-mode test)
```

The two true blockers are unchanged from doc 08 — **Ollama/Gemma tool-calling** and **the
memory loop** — but this plan adds a third that doc 08 missed: **making the offline claim
real by embedding locally.** Prove all three in M0/M1; everything else is downstream.

### Definition of done (revised)

- Local path answers a memory question **fully offline** (local embeddings, on-device speech), grounded in seed, within a **measured** latency budget — not the paper one.
- Cloud path handles a triggered live scene via Gemini Live using an **ephemeral token from the browser**, grounded in local memory, spoken back.
- Memory persists across restart; PII filter demonstrably strips a sensitive field **on write**.
- The dignity/consent one-liner is in the script.
- The scripted scenario runs twice.
