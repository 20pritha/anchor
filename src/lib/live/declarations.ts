import { z } from "zod";
import type { FunctionDeclaration } from "@google/genai";
import {
  queryMemorySchema,
  getMedicationStatusSchema,
  locateObjectSchema,
  listUpcomingSchema,
  recordEpisodeSchema,
} from "@/lib/agent/schemas";

// Mirrors lib/agent/tools.ts as Gemini FunctionDeclarations for the Live
// path (doc 02 Pipeline B — the cloud path grounds itself in the same
// memory tools as the local path). Execution happens via
// lib/agent/liveToolExecutor.ts, called from the browser through
// POST /api/live-tool-call.
export const liveFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: "queryMemory",
    description:
      "Query the local memory store for relevant context about the user's life: people, medications, routines, past events, object locations.",
    parametersJsonSchema: z.toJSONSchema(queryMemorySchema),
  },
  {
    name: "getMedicationStatus",
    description: "Check whether a medication was taken in a given period of the day.",
    parametersJsonSchema: z.toJSONSchema(getMedicationStatusSchema),
  },
  {
    name: "locateObject",
    description: 'Find the last known location of an object, e.g. "keys", "umbrella".',
    parametersJsonSchema: z.toJSONSchema(locateObjectSchema),
  },
  {
    name: "listUpcoming",
    description: "List upcoming routines and events in a time window.",
    parametersJsonSchema: z.toJSONSchema(listUpcomingSchema),
  },
  {
    name: "recordEpisode",
    description: "Record a new episodic memory for future recall.",
    parametersJsonSchema: z.toJSONSchema(recordEpisodeSchema),
  },
];
