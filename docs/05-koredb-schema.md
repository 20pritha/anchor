# 05 — KoreDB Memory Schema

The memory store has two coordinated layers in KoreDB: a **graph** for structured, stable relationships (people, medications, routines, places) and a **vector** store for unstructured **episodic** memories (things that happened). A GraphRAG query blends them: vectors surface semantically relevant episodes; the graph ties them to entities, edges, and timelines.

This schema is a starting point — adjust field names to KoreDB's actual node/edge API once the smoke test confirms it.

## Graph layer — node types

| Node type | Key fields | Notes |
| --- | --- | --- |
| `Person` | `id`, `name`, `relationship` (daughter, doctor, neighbor…), `notes` | The people in the user's life. Names are core relational data — **kept**, not stripped (see PII rules below) |
| `Medication` | `id`, `name`, `dose`, `schedule` (e.g. `["08:00","20:00"]`), `purpose` | Purpose kept vague if sensitive (see PII) |
| `Routine` | `id`, `label` (morning walk, tea time), `time`, `recurrence` | Anchors "what usually happens when" |
| `Place` | `id`, `label` (home, Dr. Rao's clinic), `type` | For "where" questions |
| `Object` | `id`, `label` (blue umbrella, house keys), `usual_location` | Populated by perception ("where are my keys?") |
| `User` | `id`, `display_name`, `preferences` | The primary user profile |

## Graph layer — edge types

| Edge | From → To | Meaning |
| --- | --- | --- |
| `KNOWS` | User → Person | relationship + closeness |
| `TAKES` | User → Medication | with schedule |
| `HAS_ROUTINE` | User → Routine | |
| `LOCATED_AT` | Object → Place | last known location |
| `CARES_FOR` | Person → User | caregiver link |
| `RELATED_TO` | Person → Person | e.g. Emily is Dr. Rao's… |
| `INVOLVES` | Episode → (Person/Med/Object/Place) | links an episodic memory to graph entities |

## Vector layer — episodic memory

Each episode is one embedded record. Embeddings generated on-device by **EmbeddingGemma**.

```
Episode {
  id: string
  text: string            // natural-language summary, e.g.
                          // "Took morning pills at 08:15. Emily visited for tea."
  embedding: float[]      // EmbeddingGemma vector
  timestamp: epoch_ms
  importance: 0.0–1.0     // scored on-device by Gemma 4 at write time
  entity_refs: [id, ...]  // graph node ids this episode INVOLVES
  source: enum            // {local_perception, cloud_perception, voice_note, caregiver_seed}
  pii_filtered: bool      // true once passed through the PII filter
}
```

Suggested **vector namespaces** (partitions), so retrieval can scope by kind:

- `episodic/daily` — day-to-day events (the bulk of reads for "what did I do today").
- `episodic/people` — interactions tied to specific people.
- `episodic/objects` — object sightings/locations (perception writes).
- `episodic/medical` — medication-taking events (kept separate so "did I take my pills" is a tight lookup).

## GraphRAG query pattern

For a query like *"Did I take my morning pills?"*:

1. **Graph-first** (fast, exact): resolve `User -TAKES-> Medication{schedule includes morning}`.
2. **Vector** (scoped to `episodic/medical`, today's window): retrieve episodes semantically matching "took pills / medication" for today.
3. **Blend**: if a matching episode exists with a timestamp in the morning window → "Yes, at 08:15." If not → "I don't have a record of it — want to mark it now?"

For *"Where are my keys?"*: `Object{keys} -LOCATED_AT-> Place` from the graph, corroborated by the most recent `episodic/objects` episode mentioning keys.

## PII filtering rules

The tension (raised in the transcript): names like "Emily" / "Dr. Rao" are exactly what the graph needs, but are also personal. Per your call — **strip only very sensitive info**, keep core relational data.

**Kept (core relational, needed for usefulness):**

- First names / relationship labels of people in the user's circle.
- Medication names and schedules (the app's whole job).
- Place labels, routines, object labels.

**Stripped / never stored (very sensitive):**

- Government / national IDs, insurance numbers, account numbers.
- Full street addresses and precise geolocation (store coarse label like "home" / "clinic" instead).
- Financial figures, card numbers.
- Free-form medical diagnoses/record numbers beyond the medication name+purpose needed to function.

The PII filter runs **on-device (Gemma 4)** at write time, before any KoreDB write and before any cloud call. Every stored record carries `pii_filtered: true`.

## Seeding for the demo

Provide a fixture that seeds ~1–2 days of realistic history: a `User`, 3–4 `Person`s (a daughter, a neighbor, Dr. Rao), 2–3 `Medication`s with schedules, a couple of `Routine`s, a few `Object`s, and ~10–15 `Episode`s across the namespaces with sensible timestamps. This makes the very first demo query return a rich, grounded answer instead of "I don't know yet."
