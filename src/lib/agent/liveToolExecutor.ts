import { queryMemory, getMedicationStatus, locateObject, listUpcoming } from "@/lib/memory/query";
import { scheduleMemoryWrite } from "@/lib/memory/write";
import type { MedicationPeriod } from "@/lib/types";

// Mirrors lib/agent/tools.ts, but for the Gemini Live path: the Live session
// runs in the browser (components/LiveSession.ts) and cannot import
// Node-only memory modules directly, so tool calls are forwarded here via
// POST /api/live-tool-call and the result is sent back over the same Live
// session (doc 02 Pipeline B — the cloud path still grounds itself in local
// memory through function calling).
export async function executeLiveFunctionCall(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "queryMemory": {
      const result = await queryMemory(
        String(args.intent ?? ""),
        args.entity ? String(args.entity) : undefined,
        args.window ? String(args.window) : undefined,
      );
      return result.blendedContext;
    }
    case "getMedicationStatus": {
      const status = await getMedicationStatus((args.period as MedicationPeriod) ?? "today");
      return {
        medications: status.medications,
        recentEpisodes: status.recentEpisodes.map((e) => e.text),
      };
    }
    case "locateObject":
      return locateObject(String(args.label ?? ""));
    case "listUpcoming":
      return listUpcoming((args.window as "today" | "tomorrow" | "this week") ?? "today");
    case "recordEpisode":
      scheduleMemoryWrite({
        text: String(args.text ?? ""),
        entityRefs: Array.isArray(args.entityRefs) ? (args.entityRefs as string[]) : undefined,
        source: "cloud_perception",
      });
      return { success: true, message: "Memory recorded" };
    default:
      throw new Error(`Unknown function: ${name}`);
  }
}
