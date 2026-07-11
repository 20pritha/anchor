import { z } from "zod";

// Single source of truth for tool parameter shapes — used both by the AI SDK
// tool() definitions (lib/agent/tools.ts, local Gemma loop) and the Gemini
// Live FunctionDeclarations (lib/live/declarations.ts, cloud path), so the
// two paths stay grounded in the same tool surface (doc 02 Pipeline B).

export const queryMemorySchema = z.object({
  intent: z.string().describe("What the user is asking about"),
  entity: z.string().optional().describe("Specific entity to look up, e.g. a person or object name"),
  window: z.string().optional().describe('Time window: "today", "this week", "all"'),
});

export const getMedicationStatusSchema = z.object({
  period: z.enum(["morning", "afternoon", "evening", "today"]),
});

export const locateObjectSchema = z.object({
  label: z.string().describe("Object name"),
});

export const listUpcomingSchema = z.object({
  window: z.enum(["today", "tomorrow", "this week"]),
});

export const recordEpisodeSchema = z.object({
  text: z.string().describe("Natural-language summary of the event"),
  entityRefs: z.array(z.string()).optional().describe("Related entity IDs, if known"),
});
