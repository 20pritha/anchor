const SAMPLE_QUESTIONS = [
  "Did I take my morning pills?",
  "Where are my keys?",
  "Who is coming today?",
  "What's on my schedule this week?",
  "Where is my blue umbrella?",
];

const LOCAL_PATH_STEPS = [
  "You type, speak, or point the camera at something.",
  "Gemma 4 (via Ollama, running on this Mac) decides which memory tool to call.",
  "Neo4j answers structured questions (people, meds, routines, objects); ChromaDB finds relevant past events by meaning, not keywords.",
  "Gemma composes a short, warm answer from what it found — no data ever leaves the machine.",
];

const CLOUD_PATH_STEPS = [
  "You start a live camera session for something that needs real-time vision or deeper reasoning.",
  "The server mints a short-lived Gemini Live token — the API key itself never reaches the browser.",
  "The browser streams video/audio directly to Gemini Live over a WebSocket.",
  "Gemini calls back into the same memory tools (via the server) so cloud answers stay grounded in your local memory, not a generic model guess.",
];

const TECH_STACK: Array<{ layer: string; choice: string; why: string }> = [
  { layer: "UI", choice: "Next.js 16 + React 19", why: "one app, server + browser, streaming responses" },
  { layer: "Local reasoning", choice: "Gemma 4 via Ollama + MLX", why: "on-device, private, fast on Apple Silicon" },
  { layer: "Local embeddings", choice: "embeddinggemma via Ollama", why: "keeps vector search fully offline" },
  { layer: "Graph memory", choice: "Neo4j", why: "people, meds, routines, places, objects and their links" },
  { layer: "Episodic memory", choice: "ChromaDB", why: "semantic recall over everyday events" },
  { layer: "Cloud reasoning", choice: "Gemini Live API", why: "only for real-time streaming vision, never a hard dependency" },
  { layer: "Voice", choice: "Web Speech API", why: "on-device speech-to-text and text-to-speech" },
];

function Card({ children }: { children: React.ReactNode }) {
  return <div className="m3-card p-4">{children}</div>;
}

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-3">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">About Anchor</h1>
        <p className="mt-1 text-lg" style={{ color: "var(--md-on-surface-variant)" }}>
          A dignity-preserving memory companion for people with mild cognitive impairment (MCI) or early
          dementia, and their caregivers.
        </p>
        <p
          className="mt-2 inline-block rounded-full px-3 py-1 text-[0.85rem] font-semibold"
          style={{ background: "var(--md-error-container)", color: "var(--md-on-error-container)" }}
        >
          Anchor is not a medical device — just a memory companion.
        </p>
      </header>

      <section className="mb-4">
        <h2 className="mb-1.5 text-xl font-bold">The problem</h2>
        <p className="text-[1.05rem] leading-snug" style={{ color: "var(--md-on-surface-variant)" }}>
          People with MCI or early dementia lose the everyday scaffolding of memory — where they put things,
          whether they took their medication, who a visitor is, what happened earlier today. Existing tools
          are either clinical trackers (cold, admin-heavy) or generic reminder apps (no context). Anchor
          answers those everyday questions the way a patient, well-informed family member would — calmly,
          briefly, and never in a way that feels like surveillance or a correction.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="mb-1.5 text-xl font-bold">Core principle</h2>
        <p className="text-[1.05rem] leading-snug" style={{ color: "var(--md-on-surface-variant)" }}>
          <strong style={{ color: "var(--md-on-surface)" }}>Cloud is an enhancement, not a dependency.</strong>{" "}
          Everything essential — remembering people, medications, routines, and daily events, and answering
          questions about them — runs entirely on this laptop. The cloud (Gemini Live) is only reached for
          genuinely real-time streaming camera/voice interaction or reasoning that clearly exceeds the local
          model.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="mb-2 text-xl font-bold">Two paths, one memory</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <h3 className="mb-1.5 font-bold">🖥️ Local path (default)</h3>
            <ol className="list-decimal space-y-1.5 pl-4 text-[1rem] leading-snug" style={{ color: "var(--md-on-surface-variant)" }}>
              {LOCAL_PATH_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </Card>
          <Card>
            <h3 className="mb-1.5 font-bold">☁️ Cloud path (on demand)</h3>
            <ol className="list-decimal space-y-1.5 pl-4 text-[1rem] leading-snug" style={{ color: "var(--md-on-surface-variant)" }}>
              {CLOUD_PATH_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </Card>
        </div>
      </section>

      <section className="mb-4">
        <h2 className="mb-2 text-xl font-bold">Try asking</h2>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_QUESTIONS.map((q) => (
            <span key={q} className="m3-chip">
              &ldquo;{q}&rdquo;
            </span>
          ))}
        </div>
      </section>

      <section className="mb-4">
        <h2 className="mb-2 text-xl font-bold">Tech stack</h2>
        <div className="m3-card overflow-x-auto">
          <table className="w-full text-left text-[1rem]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--md-outline-variant)" }}>
                <th className="px-3 py-2 font-bold">Layer</th>
                <th className="px-3 py-2 font-bold">Choice</th>
                <th className="px-3 py-2 font-bold">Why</th>
              </tr>
            </thead>
            <tbody>
              {TECH_STACK.map((row) => (
                <tr key={row.layer} style={{ borderBottom: "1px solid var(--md-outline-variant)" }}>
                  <td className="px-3 py-2 align-top font-semibold">{row.layer}</td>
                  <td className="px-3 py-2 align-top">{row.choice}</td>
                  <td className="px-3 py-2 align-top" style={{ color: "var(--md-on-surface-variant)" }}>
                    {row.why}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-4">
        <h2 className="mb-2 text-xl font-bold">Preserving dignity</h2>
        <ul className="list-disc space-y-1 pl-5 text-[1.05rem] leading-snug" style={{ color: "var(--md-on-surface-variant)" }}>
          <li>Sensitive information (IDs, addresses, financial details, diagnoses) is filtered before storage.</li>
          <li>The camera is trigger-based, never continuously watching.</li>
          <li>Answers are short, warm, and never clinical or corrective in tone.</li>
        </ul>
      </section>

      <footer className="pt-2 text-[0.85rem]" style={{ color: "var(--md-on-surface-variant)" }}>
        Built for the Google DeepMind Bangalore Hackathon — Problem Statement 1 (Real-Time Multimodal
        Interaction via Gemini Live).
      </footer>
    </main>
  );
}
