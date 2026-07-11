# 09 — Architecture Deep-Dive & Setup Reference

Technical reference for the laptop/Next.js stack. Covers the agent loop in detail, environment setup, service launch, Neo4j schema initialization, ChromaDB collection setup, tool implementations, and the seed fixture. This is the companion to the high-level plan in [08-implementation-plan.md](08-implementation-plan.md).

---

## 1. Environment setup (day 0)

### Prerequisites

```bash
# 1. Install Ollama
brew install ollama
ollama pull gemma4:12b          # ~7.6 GB download
ollama pull gemma4:12b:q4_K_M  # if you want explicit quantization

# Verify
ollama run gemma4:12b -- "Hello, what is 2+2?"

# 2. Install Neo4j
brew install neo4j
brew services start neo4j
# Default: http://localhost:7474, username: neo4j, password: neo4j
# Change password on first login

# 3. Install ChromaDB
pip install chromadb
chroma run --path ./data/chroma  # stores data in ./data/chroma

# 4. Node.js + Next.js
npx create-next-app@latest anchor --typescript --tailwind --eslint
cd anchor
npm install ai @ai-sdk/ollama @google/genai neo4j-driver chromadb zod
```

### Docker Compose alternative (optional)

```yaml
# docker-compose.yml
version: '3.8'
services:
  neo4j:
    image: neo4j:5
    ports:
      - "7474:7474"  # HTTP
      - "7687:7687"  # Bolt
    environment:
      NEO4J_AUTH: neo4j/testpassword
    volumes:
      - ./data/neo4j:/data

  chroma:
    image: chromadb/chroma:latest
    ports:
      - "8000:8000"
    volumes:
      - ./data/chroma:/data
```

### Startup sequence (for the demo)

```bash
# Terminal 1: Ollama (auto-starts, but verify)
ollama serve

# Terminal 2: Neo4j
brew services start neo4j   # or docker compose up neo4j

# Terminal 3: ChromaDB
chroma run --path ./data/chroma   # or docker compose up chroma

# Terminal 4: Next.js
npm run dev
```

Open `http://localhost:3000` in Chrome.

---

## 2. Agent loop — detailed design

### File structure

```
src/
├── app/
│   ├── api/
│   │   └── agent/
│   │       └── route.ts        # POST /api/agent — main entry point
│   │   └── seed/
│   │       └── route.ts        # POST /api/seed — populate demo data
│   ├── page.tsx                 # Main UI (conversation view)
│   └── layout.tsx               # App shell
├── lib/
│   ├── agent/
│   │   ├── loop.ts             # Core agent loop logic
│   │   ├── tools.ts            # memoryTools definition
│   │   ├── pii.ts              # PII filter
│   │   └── router.ts           # Intent router
│   ├── memory/
│   │   ├── neo4j.ts            # Neo4j client + queries
│   │   ├── chroma.ts           # ChromaDB client + queries
│   │   └── write.ts            # Async memory write pipeline
│   ├── embedding.ts            # Gemini Embedding API wrapper
│   └── seed.ts                 # Seed fixture data
├── components/
│   ├── ConversationView.tsx    # Chat bubble UI
│   ├── MicButton.tsx           # Push-to-talk + SpeechRecognition
│   ├── CameraButton.tsx        # Camera trigger + preview
│   └── CaregiverPanel.tsx      # Seed/edit screen
└── lib/
    └── services.ts             # Startup check: is Ollama/Neo4j/ChromaDB running?
```

### Agent loop flow (detailed)

```
POST /api/agent { messages: [...] }
  │
  ├─ 1. Build system prompt (context: user's name, current time, etc.)
  │
  ├─ 2. PII filter the latest user message
  │     → ollama.chat({ model: 'gemma4:12b', messages: [PII_SYSTEM, userMsg] })
  │     → returns filtered text
  │
  ├─ 3. Intent router
  │     → ollama.chat({ model: 'gemma4:12b', messages: [ROUTER_SYSTEM, filteredText], temperature: 0 })
  │     → returns "memory" | "perception" | "cloud"
  │
  ├─ 4a. If "memory":
  │     → streamText({
  │         model: ollama('gemma4:12b'),
  │         system: MEMORY_ANSWER_PROMPT + seeded context,
  │         messages: [history + filteredText],
  │         tools: memoryTools,
  │         maxSteps: 5,
  │       })
  │     → Stream response back via ReadableStream
  │     → After stream completes, fire async memory write
  │
  ├─ 4b. If "perception" (and camera frame included):
  │     → ollama.chat({
  │         model: 'gemma4:12b',
  │         messages: [{ role: 'user', content: 'Describe this image', images: [base64Frame] }],
  │       })
  │     → Return description text
  │
  ├─ 4c. If "cloud":
  │     → Init Gemini Live WebSocket session
  │     → Stream camera + mic frames
  │     → Receive streamed response → forward to browser
  │
  └─ 5. Return streamed response as SSE / ReadableStream
```

### Memory tools — implementation details

#### `queryMemory`

```typescript
async function queryMemory(intent: string, entity?: string, window?: string) {
  const parts: string[] = [];

  // Graph query — always run for exact entity lookups
  if (entity) {
    const graphResult = await neo4jQueryEntity(entity);
    if (graphResult) parts.push(`Graph data: ${JSON.stringify(graphResult)}`);
  }

  // Vector query — for semantic episode retrieval
  const embedding = await generateEmbedding(intent); // uses gemini-embedding-2
  const vectorResults = await chromaQuery({
    embedding,
    namespace: inferNamespace(intent),
    window,
    nResults: 5,
  });
  if (vectorResults.length > 0) {
    parts.push(`Relevant memories: ${vectorResults.map(r => r.document).join('\n')}`);
  }

  return parts.join('\n\n') || 'No relevant information found in memory.';
}
```

#### `recordEpisode`

```typescript
async function recordEpisode(text: string, entityRefs?: string[]) {
  // Fire and forget
  scheduleAsyncMemoryWrite(text, entityRefs);
  return { success: true, message: 'Memory recorded' };
}
```

#### `getMedicationStatus`

```typescript
async function getMedicationStatus(period: string) {
  // Graph query: find medications for this period
  const meds = await neo4jQueryMedications(period);

  // Vector query: find episodes matching this period + medication
  const embedding = await generateEmbedding(`took ${period} medication`);
  const episodes = await chromaQuery({
    embedding,
    namespace: 'episodic/medical',
    window: 'today',
    nResults: 3,
  });

  return { medications: meds, recentEpisodes: episodes };
}
```

---

## 3. Neo4j schema setup

Run this via Cypher after Neo4j starts:

```cypher
// Create uniqueness constraints
CREATE CONSTRAINT FOR (p:Person) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT FOR (m:Medication) REQUIRE m.id IS UNIQUE;
CREATE CONSTRAINT FOR (r:Routine) REQUIRE r.id IS UNIQUE;
CREATE CONSTRAINT FOR (pl:Place) REQUIRE pl.id IS UNIQUE;
CREATE CONSTRAINT FOR (o:Object) REQUIRE o.id IS UNIQUE;
CREATE CONSTRAINT FOR (u:User) REQUIRE u.id IS UNIQUE;
CREATE CONSTRAINT FOR (e:Episode) REQUIRE e.id IS UNIQUE;

// Create indexes for common lookups
CREATE INDEX person_name IF NOT EXISTS FOR (p:Person) ON (p.name);
CREATE INDEX medication_name IF NOT EXISTS FOR (m:Medication) ON (m.name);
CREATE INDEX object_label IF NOT EXISTS FOR (o:Object) ON (o.label);
CREATE INDEX episode_timestamp IF NOT EXISTS FOR (e:Episode) ON (e.timestamp);
```

### JavaScript client setup

```typescript
// src/lib/memory/neo4j.ts
import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
  'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', process.env.NEO4J_PASSWORD || 'testpassword')
);

export async function neo4jQueryEntity(entity: string) {
  const session = driver.session();
  try {
    // Try matching against known entity types
    const result = await session.run(
      `MATCH (n)
       WHERE n.name = $entity OR n.label = $entity
       OPTIONAL MATCH (n)-[r]->(related)
       RETURN n, r, related
       LIMIT 10`,
      { entity }
    );
    return result.records.map(record => ({
      node: record.get('n').properties,
      relationship: record.get('r')?.type,
      related: record.get('related')?.properties,
    }));
  } finally {
    await session.close();
  }
}
```

---

## 4. ChromaDB collection setup

```typescript
// src/lib/memory/chroma.ts
import { ChromaClient } from 'chromadb';

const client = new ChromaClient({ host: 'localhost', port: 8000 });

export async function initChromaCollections() {
  // Delete if re-creating
  try { await client.deleteCollection({ name: 'episodic' }); } catch {}

  await client.createCollection({
    name: 'episodic',
    // dimension set after first gemini-embedding-2 call
    // typically 768 or 1024
  });
}

export async function chromaQuery(opts: {
  embedding: number[];
  namespace: string;
  window?: string;
  nResults: number;
}) {
  const collection = await client.getCollection({ name: 'episodic' });

  const where: any = { namespace: { $eq: opts.namespace } };
  if (opts.window === 'today') {
    const todayStart = new Date().setHours(0, 0, 0, 0);
    where.timestamp = { $gte: todayStart };
  }

  const results = await collection.query({
    queryEmbeddings: [opts.embedding],
    nResults: opts.nResults,
    where,
  });

  return results.ids[0]?.map((_, i) => ({
    id: results.ids[0][i],
    document: results.documents[0][i],
    metadata: results.metadatas[0][i],
    distance: results.distances[0][i],
  })) ?? [];
}
```

---

## 5. Gemini Embedding API wrapper

```typescript
// src/lib/embedding.ts
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: 'gemini-embedding-2',
    contents: text,
  });
  return response.embeddings![0].values!;
}
```

---

## 6. Seed fixture

```typescript
// src/lib/seed.ts
import { v4 as uuid } from 'uuid';

export const SEED_DATA = {
  user: {
    id: 'user-1',
    displayName: 'Ravi',
    preferences: { language: 'en', ttsSpeed: 1.0 },
  },
  persons: [
    { id: 'person-1', name: 'Priya', relationship: 'daughter', notes: 'Lives in the same city' },
    { id: 'person-2', name: 'Mrs. Sharma', relationship: 'neighbor', notes: 'Next door' },
    { id: 'person-3', name: 'Dr. Rao', relationship: 'doctor', notes: 'Neurologist, appointment every 3 months' },
  ],
  medications: [
    { id: 'med-1', name: 'Donepezil', dose: '5mg', schedule: ['08:00'], purpose: 'for memory' },
    { id: 'med-2', name: 'Metformin', dose: '500mg', schedule: ['08:00', '20:00'], purpose: 'for diabetes' },
  ],
  routines: [
    { id: 'routine-1', label: 'Morning walk', time: '07:00', recurrence: 'daily' },
    { id: 'routine-2', label: 'Tea with neighbor', time: '16:00', recurrence: 'weekdays' },
  ],
  places: [
    { id: 'place-1', label: 'Home', type: 'residence' },
    { id: 'place-2', label: "Dr. Rao's Clinic", type: 'clinic' },
    { id: 'place-3', label: 'Park', type: 'outdoor' },
  ],
  objects: [
    { id: 'obj-1', label: 'House keys', usualLocation: 'kitchen drawer' },
    { id: 'obj-2', label: 'Blue umbrella', usualLocation: 'hall stand' },
    { id: 'obj-3', label: 'Reading glasses', usualLocation: 'bedside table' },
  ],
  episodes: [
    { text: 'Took morning pills at 08:15 with breakfast', entityRefs: ['med-1', 'med-2'], namespace: 'episodic/medical', timestamp: 'today 08:15' },
    { text: 'Priya called at 10:00 to check in', entityRefs: ['person-1'], namespace: 'episodic/people', timestamp: 'today 10:00' },
    { text: 'Placed keys on the kitchen counter after coming back from walk', entityRefs: ['obj-1', 'place-1'], namespace: 'episodic/objects', timestamp: 'today 07:45' },
    { text: 'Mrs. Sharma came over for tea at 16:00', entityRefs: ['person-2'], namespace: 'episodic/people', timestamp: 'yesterday 16:00' },
    // ... 10-12 more episodes across namespaces
  ],
};
```

The seed endpoint (`POST /api/seed`) creates all Neo4j nodes + edges, generates embeddings for each episode via `gemini-embedding-2`, and stores them in the ChromaDB `episodic` collection.

---

## 7. Key scripts

| Script | Purpose | Location |
| --- | --- | --- |
| `npm run dev` | Start Next.js dev server | `package.json` |
| `npm run seed` | Populate demo data | `src/lib/seed.ts` |
| `npm run services:start` | Start Ollama + Neo4j + ChromaDB | `scripts/services.sh` |
| `npm run services:check` | Verify all services are running | `src/lib/services.ts` |
