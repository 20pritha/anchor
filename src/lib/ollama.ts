import { createOllama } from "ai-sdk-ollama";
import { env } from "@/lib/config";

// A configured provider instance (not the package's default singleton) so we
// respect OLLAMA_BASE_URL from the environment.
export const ollamaProvider = createOllama({ baseURL: env.OLLAMA_BASE_URL });

export const gemmaModel = ollamaProvider(env.GEMMA_MODEL);
export const embeddingModel = ollamaProvider.embedding(env.EMBED_MODEL);
