import neo4j, { type Driver, type Session } from "neo4j-driver";
import { env } from "@/lib/config";
import type {
  Person,
  Medication,
  Routine,
  Place,
  ObjectEntity,
  UserProfile,
  MedicationPeriod,
  Recurrence,
  GraphNode,
  GraphEdge,
  RecentEpisode,
} from "@/lib/types";

/** neo4j-driver returns Integer objects for integer columns; normalize to JS number. */
function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof (value as { toNumber?: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

let driver: Driver | undefined;

export function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(env.NEO4J_URI, neo4j.auth.basic(env.NEO4J_USER, env.NEO4J_PASSWORD));
  }
  return driver;
}

async function withSession<T>(work: (session: Session) => Promise<T>): Promise<T> {
  const session = getDriver().session();
  try {
    return await work(session);
  } finally {
    await session.close();
  }
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = undefined;
  }
}

/** Drops the entire graph so re-seeding is idempotent (doc 08 M5). */
export async function wipeAllData(): Promise<void> {
  await withSession((session) => session.run("MATCH (n) DETACH DELETE n"));
}

// --- Writes: seed fixture + caregiver panel ---------------------------------

export async function upsertUser(user: UserProfile): Promise<void> {
  await withSession((session) =>
    session.run(
      `MERGE (u:User {id: $id})
       SET u.displayName = $displayName, u.preferences = $preferences`,
      { id: user.id, displayName: user.displayName, preferences: JSON.stringify(user.preferences) },
    ),
  );
}

export async function upsertPerson(
  userId: string,
  person: Person,
  closeness = "family",
): Promise<void> {
  await withSession((session) =>
    session.run(
      `MATCH (u:User {id: $userId})
       MERGE (p:Person {id: $id})
       SET p.name = $name, p.relationship = $relationship, p.notes = $notes
       MERGE (u)-[k:KNOWS]->(p)
       SET k.closeness = $closeness`,
      {
        userId,
        id: person.id,
        name: person.name,
        relationship: person.relationship,
        notes: person.notes ?? null,
        closeness,
      },
    ),
  );
}

export async function upsertMedication(userId: string, medication: Medication): Promise<void> {
  await withSession((session) =>
    session.run(
      `MATCH (u:User {id: $userId})
       MERGE (m:Medication {id: $id})
       SET m.name = $name, m.dose = $dose, m.schedule = $schedule, m.purpose = $purpose
       MERGE (u)-[t:TAKES]->(m)
       SET t.schedule = $schedule`,
      {
        userId,
        id: medication.id,
        name: medication.name,
        dose: medication.dose,
        schedule: medication.schedule,
        purpose: medication.purpose,
      },
    ),
  );
}

export async function upsertRoutine(userId: string, routine: Routine): Promise<void> {
  await withSession((session) =>
    session.run(
      `MATCH (u:User {id: $userId})
       MERGE (r:Routine {id: $id})
       SET r.label = $label, r.timeOfDay = $timeOfDay, r.recurrence = $recurrence, r.daysOfWeek = $daysOfWeek
       MERGE (u)-[:HAS_ROUTINE]->(r)`,
      {
        userId,
        id: routine.id,
        label: routine.label,
        timeOfDay: routine.timeOfDay,
        recurrence: routine.recurrence,
        daysOfWeek: routine.daysOfWeek ?? [],
      },
    ),
  );
}

export async function upsertPlace(place: Place): Promise<void> {
  await withSession((session) =>
    session.run(
      `MERGE (p:Place {id: $id}) SET p.label = $label, p.type = $type`,
      { id: place.id, label: place.label, type: place.type },
    ),
  );
}

export async function upsertObject(object: ObjectEntity, placeId?: string): Promise<void> {
  await withSession(async (session) => {
    await session.run(
      `MERGE (o:Object {id: $id}) SET o.label = $label, o.usualLocation = $usualLocation`,
      { id: object.id, label: object.label, usualLocation: object.usualLocation },
    );
    if (placeId) {
      await session.run(
        `MATCH (o:Object {id: $objectId}), (p:Place {id: $placeId})
         MERGE (o)-[l:LOCATED_AT]->(p)
         SET l.lastSeen = datetime()`,
        { objectId: object.id, placeId },
      );
    }
  });
}

export async function createEpisodeNode(episode: {
  id: string;
  text: string;
  timestamp: number;
  importance: number;
  source: string;
  piiFiltered: boolean;
  entityRefs?: string[];
}): Promise<void> {
  await withSession(async (session) => {
    await session.run(
      `CREATE (e:Episode {
         id: $id, text: $text, timestamp: $timestamp,
         importance: $importance, source: $source, piiFiltered: $piiFiltered
       })`,
      {
        id: episode.id,
        text: episode.text,
        timestamp: episode.timestamp,
        importance: episode.importance,
        source: episode.source,
        piiFiltered: episode.piiFiltered,
      },
    );
    if (episode.entityRefs?.length) {
      await session.run(
        `MATCH (e:Episode {id: $episodeId})
         UNWIND $entityRefs AS refId
         MATCH (n {id: refId})
         MERGE (e)-[:INVOLVES]->(n)`,
        { episodeId: episode.id, entityRefs: episode.entityRefs },
      );
    }
  });
}

// --- Reads -------------------------------------------------------------------

const PERIOD_HOUR_WINDOWS: Record<Exclude<MedicationPeriod, "today">, [number, number]> = {
  morning: [5, 12],
  afternoon: [12, 17],
  evening: [17, 23],
};

export async function findMedicationsForPeriod(
  period: MedicationPeriod,
): Promise<Array<{ name: string; dose: string; schedule: string[] }>> {
  const all = await withSession(async (session) => {
    const result = await session.run(
      `MATCH (u:User)-[:TAKES]->(m:Medication)
       RETURN m.name AS name, m.dose AS dose, m.schedule AS schedule`,
    );
    return result.records.map((r) => ({
      name: r.get("name") as string,
      dose: r.get("dose") as string,
      schedule: r.get("schedule") as string[],
    }));
  });

  if (period === "today") return all;
  const [start, end] = PERIOD_HOUR_WINDOWS[period];
  return all.filter((med) =>
    med.schedule.some((t) => {
      const hour = Number(t.split(":")[0]);
      return hour >= start && hour < end;
    }),
  );
}

export async function locateObjectByLabel(
  label: string,
): Promise<{ place: string; lastSeen: string | null } | null> {
  return withSession(async (session) => {
    const result = await session.run(
      `MATCH (o:Object)-[l:LOCATED_AT]->(p:Place)
       WHERE toLower(o.label) CONTAINS toLower($label)
       RETURN p.label AS place, l.lastSeen AS lastSeen
       ORDER BY l.lastSeen DESC LIMIT 1`,
      { label },
    );
    const record = result.records[0];
    if (!record) return null;
    const lastSeen = record.get("lastSeen");
    return {
      place: record.get("place") as string,
      lastSeen: lastSeen ? String(lastSeen) : null,
    };
  });
}

/**
 * Next occurrence of a routine's time-of-day, honoring recurrence. Computed
 * here in TypeScript rather than in Cypher — fixes doc 10 B7 (the original
 * plan compared a "HH:mm" string against a datetime, which cannot work).
 */
function nextOccurrence(
  timeOfDay: string,
  recurrence: Recurrence,
  daysOfWeek: number[] | undefined,
  from: Date,
): Date | null {
  const parts = timeOfDay.split(":");
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);

  const isAllowedDay = (d: Date) => {
    if (recurrence === "daily" || recurrence === "once") return true;
    if (recurrence === "weekdays") return d.getDay() >= 1 && d.getDay() <= 5;
    if (recurrence === "weekly") {
      const iso = d.getDay() === 0 ? 7 : d.getDay();
      return daysOfWeek?.includes(iso) ?? true;
    }
    return true;
  };

  for (let i = 0; i < 8; i++) {
    const day = new Date(from);
    day.setDate(from.getDate() + i);
    day.setHours(hh, mm, 0, 0);
    if (day <= from) continue;
    if (isAllowedDay(day)) return day;
  }
  return null;
}

export async function listUpcomingRoutines(
  window: "today" | "tomorrow" | "this week",
): Promise<Array<{ label: string; nextOccurrence: string }>> {
  const routines = await withSession(async (session) => {
    const result = await session.run(
      `MATCH (u:User)-[:HAS_ROUTINE]->(r:Routine)
       RETURN r.label AS label, r.timeOfDay AS timeOfDay, r.recurrence AS recurrence, r.daysOfWeek AS daysOfWeek`,
    );
    return result.records.map((r) => ({
      label: r.get("label") as string,
      timeOfDay: r.get("timeOfDay") as string,
      recurrence: r.get("recurrence") as Recurrence,
      daysOfWeek: (r.get("daysOfWeek") as number[] | null) ?? undefined,
    }));
  });

  const now = new Date();
  // For "tomorrow" specifically, search starting from midnight tonight, not
  // from `now` — otherwise nextOccurrence() (which returns the first
  // occurrence strictly after its `from` point) can return a later-today
  // event and this window would mislabel it as "tomorrow".
  const searchFrom = new Date(now);
  const endOfWindow = new Date(now);
  if (window === "today") {
    endOfWindow.setHours(23, 59, 59, 999);
  } else if (window === "tomorrow") {
    searchFrom.setDate(now.getDate() + 1);
    searchFrom.setHours(0, 0, 0, 0);
    endOfWindow.setDate(now.getDate() + 2);
    endOfWindow.setHours(0, 0, 0, 0);
  } else {
    endOfWindow.setDate(now.getDate() + 7);
  }

  return routines
    .map((r) => ({
      label: r.label,
      next: nextOccurrence(r.timeOfDay, r.recurrence, r.daysOfWeek, searchFrom),
    }))
    .filter((r): r is { label: string; next: Date } => r.next !== null && r.next <= endOfWindow)
    .sort((a, b) => a.next.getTime() - b.next.getTime())
    .map((r) => ({ label: r.label, nextOccurrence: r.next.toISOString() }));
}

/**
 * Whole-graph snapshot for the caregiver knowledge-graph viewer. Excludes
 * Episode nodes on purpose: episodic memories are raw text blobs (already
 * browsable as a list on the Recent Activity page) and there are typically
 * far more of them than entities, so including them would swamp the small,
 * meaningful structure of people/medications/routines/places/objects with
 * clutter. Returns every remaining node with a display label + its Neo4j
 * type, and every directed relationship between two returned nodes.
 */
export async function fetchGraph(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  return withSession(async (session) => {
    const result = await session.run(
      `MATCH (n) WHERE NOT n:Episode
       OPTIONAL MATCH (n)-[r]->(m) WHERE NOT m:Episode
       RETURN n, r, m`,
    );

    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const seenEdges = new Set<string>();

    const idOf = (node: { properties: Record<string, unknown>; elementId: string }): string =>
      (node.properties.id as string | undefined) ?? node.elementId;

    const addNode = (node: {
      labels: string[];
      properties: Record<string, unknown>;
      elementId: string;
    } | null) => {
      if (!node) return;
      const id = idOf(node);
      if (nodes.has(id)) return;
      const type = node.labels[0] ?? "Node";
      const p = node.properties;
      const raw =
        (p.name as string) ??
        (p.label as string) ??
        (p.displayName as string) ??
        (p.text as string) ??
        type;
      const label = String(raw).length > 64 ? `${String(raw).slice(0, 61)}…` : String(raw);
      nodes.set(id, { id, label, type });
    };

    for (const record of result.records) {
      const n = record.get("n");
      const m = record.get("m");
      const r = record.get("r");
      addNode(n);
      addNode(m);
      if (r && n && m) {
        const source = idOf(n);
        const target = idOf(m);
        const key = `${source}|${r.type}|${target}`;
        if (!seenEdges.has(key)) {
          seenEdges.add(key);
          edges.push({ source, target, type: r.type as string });
        }
      }
    }

    return { nodes: [...nodes.values()], edges };
  });
}

/** Most recent episodes across all sources — powers the Recent Activity feed. */
export async function fetchRecentEpisodes(limit = 30): Promise<RecentEpisode[]> {
  return withSession(async (session) => {
    const result = await session.run(
      `MATCH (e:Episode)
       RETURN e.id AS id, e.text AS text, e.timestamp AS timestamp, e.source AS source
       ORDER BY e.timestamp DESC LIMIT $limit`,
      { limit: neo4j.int(limit) },
    );
    return result.records.map((r) => ({
      id: r.get("id") as string,
      text: r.get("text") as string,
      timestamp: toNumber(r.get("timestamp")),
      source: (r.get("source") as string) ?? "note",
    }));
  });
}

export async function queryEntityByLabelOrName(entity: string): Promise<string | null> {
  return withSession(async (session) => {
    const result = await session.run(
      `MATCH (n)
       WHERE toLower(coalesce(n.name, '')) CONTAINS toLower($entity)
          OR toLower(coalesce(n.label, '')) CONTAINS toLower($entity)
       OPTIONAL MATCH (n)-[rel]->(related)
       RETURN n, type(rel) AS relType, related
       LIMIT 5`,
      { entity },
    );
    if (result.records.length === 0) return null;
    const parts = result.records.map((r) => {
      const node = r.get("n").properties;
      const relType = r.get("relType");
      const related = r.get("related")?.properties;
      const nodeDesc = JSON.stringify(node);
      return related ? `${nodeDesc} --[${relType}]--> ${JSON.stringify(related)}` : nodeDesc;
    });
    return parts.join("\n");
  });
}
