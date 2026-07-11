import { z } from "zod";

// Plain z.string() checks throughout (not .url()/.email()) — those format
// helpers moved around across Zod v4 minor releases; a plain string plus a
// parse step downstream is simpler than chasing the exact deprecation state.
const EnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1).optional(),
  OLLAMA_BASE_URL: z.string().min(1).default("http://127.0.0.1:11434"),
  NEO4J_URI: z.string().min(1).default("bolt://localhost:7687"),
  NEO4J_USER: z.string().min(1).default("neo4j"),
  NEO4J_PASSWORD: z.string().min(1).default("testpassword"),
  CHROMA_URL: z.string().min(1).default("http://localhost:8000"),
  GEMMA_MODEL: z.string().min(1).default("gemma4:12b"),
  EMBED_MODEL: z.string().min(1).default("embeddinggemma"),
  GEMINI_LIVE_MODEL: z
    .string()
    .min(1)
    .default("gemini-2.5-flash-native-audio-preview-09-2025"),
  USE_LLM_ROUTER: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  USE_MLX: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }
  return parsed.data;
}

export const env = loadEnv();

/** Parses CHROMA_URL into the {host, port, ssl} shape the ChromaClient constructor expects. */
export function parseChromaUrl(url: string): { host: string; port: number; ssl: boolean } {
  const parsed = new URL(url);
  const ssl = parsed.protocol === "https:";
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : ssl ? 443 : 80,
    ssl,
  };
}

export const CHROMA_COLLECTION = "episodic";

/** Single demo user for the hackathon build — one laptop, one person (doc 01). */
export const DEMO_USER_ID = "user-1";

/**
 * embeddinggemma's output dimension. Confirmed by the day-0 smoke test
 * (doc 10/11 M0) — re-verify with one real `embed()` call before relying on
 * it, since ChromaDB itself infers/enforces dimension from the first insert
 * rather than a config value we set here.
 */
export const EMBED_DIMENSION = 768;
