import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  upsertPerson,
  upsertMedication,
  upsertRoutine,
  upsertPlace,
  upsertObject,
} from "@/lib/memory/neo4j";
import { DEMO_USER_ID } from "@/lib/config";

export const runtime = "nodejs";

const CaregiverRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("person"),
    name: z.string().min(1),
    relationship: z.string().min(1),
    notes: z.string().optional(),
  }),
  z.object({
    kind: z.literal("medication"),
    name: z.string().min(1),
    dose: z.string().min(1),
    schedule: z.array(z.string()).min(1),
    purpose: z.string().min(1),
  }),
  z.object({
    kind: z.literal("routine"),
    label: z.string().min(1),
    timeOfDay: z.string().min(1),
    recurrence: z.enum(["daily", "weekdays", "weekly", "once"]),
    daysOfWeek: z.array(z.number()).optional(),
  }),
  z.object({
    kind: z.literal("place"),
    label: z.string().min(1),
    type: z.string().min(1),
  }),
  z.object({
    kind: z.literal("object"),
    label: z.string().min(1),
    usualLocation: z.string().min(1),
    placeId: z.string().optional(),
  }),
]);

// Caregiver seeding/editing screen writes directly to Neo4j — no PII filter
// needed here since the caregiver is knowingly entering this person's own
// relational data (contrast with lib/memory/write.ts, which filters
// runtime interaction writes per doc 10 B5).
export async function POST(req: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CaregiverRequestSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  const body = parsed.data;
  const id = randomUUID();

  try {
    switch (body.kind) {
      case "person":
        await upsertPerson(DEMO_USER_ID, {
          id,
          name: body.name,
          relationship: body.relationship,
          notes: body.notes,
        });
        break;
      case "medication":
        await upsertMedication(DEMO_USER_ID, {
          id,
          name: body.name,
          dose: body.dose,
          schedule: body.schedule,
          purpose: body.purpose,
        });
        break;
      case "routine":
        await upsertRoutine(DEMO_USER_ID, {
          id,
          label: body.label,
          timeOfDay: body.timeOfDay,
          recurrence: body.recurrence,
          daysOfWeek: body.daysOfWeek,
        });
        break;
      case "place":
        await upsertPlace({ id, label: body.label, type: body.type });
        break;
      case "object":
        await upsertObject({ id, label: body.label, usualLocation: body.usualLocation }, body.placeId);
        break;
    }
    return Response.json({ ok: true, id });
  } catch (err) {
    console.error("[api/caregiver] failed:", err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Write failed" },
      { status: 500 },
    );
  }
}
