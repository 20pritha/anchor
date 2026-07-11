import { tool } from "ai";
import { queryMemory, getMedicationStatus, locateObject, listUpcoming } from "@/lib/memory/query";
import { scheduleMemoryWrite } from "@/lib/memory/write";
import {
  queryMemorySchema,
  getMedicationStatusSchema,
  locateObjectSchema,
  listUpcomingSchema,
  recordEpisodeSchema,
} from "@/lib/agent/schemas";

// Shared tool registry for the Gemma tool-calling loop (lib/agent/loop.ts).
// Each tool is a thin wrapper over the memory layer in lib/memory/query.ts —
// the same functions lib/agent/dispatch.ts calls directly when bypassing
// tool-calling entirely (doc 10 B2).
export const memoryTools = {
  queryMemory: tool({
    description:
      "Query the local memory store for relevant context about the user's life: people, medications, routines, past events, object locations.",
    inputSchema: queryMemorySchema,
    execute: async ({ intent, entity, window }) => {
      const result = await queryMemory(intent, entity, window);
      return result.blendedContext;
    },
  }),

  getMedicationStatus: tool({
    description: "Check whether a medication was taken in a given period of the day.",
    inputSchema: getMedicationStatusSchema,
    execute: async ({ period }) => {
      const status = await getMedicationStatus(period);
      return {
        medications: status.medications,
        recentEpisodes: status.recentEpisodes.map((e) => e.text),
      };
    },
  }),

  locateObject: tool({
    description: 'Find the last known location of an object, e.g. "keys", "umbrella".',
    inputSchema: locateObjectSchema,
    execute: async ({ label }) => locateObject(label),
  }),

  listUpcoming: tool({
    description: "List upcoming routines and events in a time window.",
    inputSchema: listUpcomingSchema,
    execute: async ({ window }) => listUpcoming(window),
  }),

  recordEpisode: tool({
    description: "Record a new episodic memory for future recall.",
    inputSchema: recordEpisodeSchema,
    execute: async ({ text, entityRefs }) => {
      scheduleMemoryWrite({ text, entityRefs, source: "voice_note" });
      return { success: true, message: "Memory recorded" };
    },
  }),
};
