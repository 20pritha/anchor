import { randomUUID } from "node:crypto";
import {
  upsertUser,
  upsertPerson,
  upsertMedication,
  upsertRoutine,
  upsertPlace,
  upsertObject,
  createEpisodeNode,
  wipeAllData,
} from "@/lib/memory/neo4j";
import { tryEmbedText } from "@/lib/memory/embed";
import { upsertEpisodeVector, resetEpisodicCollection } from "@/lib/memory/chroma";
import {
  SEED_USER,
  SEED_PERSONS,
  SEED_MEDICATIONS,
  SEED_ROUTINES,
  SEED_PLACES,
  SEED_OBJECTS,
  SEED_EPISODES,
} from "@/data/seed-data";

export interface SeedSummary {
  persons: number;
  medications: number;
  routines: number;
  places: number;
  objects: number;
  episodesTotal: number;
  episodesEmbedded: number;
  episodesGraphOnly: number;
}

// Seed episodes are curated synthetic fixtures, not raw user input, so this
// writes them directly rather than through lib/memory/write.ts's piiFilter
// step (which exists for genuine runtime writes — doc 10 B5).
//
// Wipes existing data first so re-seeding is idempotent (doc 08 M5) — without
// this, calling POST /api/seed more than once (e.g. before each demo run)
// would accumulate duplicate episodes indefinitely.
export async function seedDemoData(): Promise<SeedSummary> {
  await wipeAllData();
  await resetEpisodicCollection();

  await upsertUser(SEED_USER);
  for (const person of SEED_PERSONS) await upsertPerson(SEED_USER.id, person);
  for (const medication of SEED_MEDICATIONS) await upsertMedication(SEED_USER.id, medication);
  for (const routine of SEED_ROUTINES) await upsertRoutine(SEED_USER.id, routine);
  for (const place of SEED_PLACES) await upsertPlace(place);
  for (const object of SEED_OBJECTS) {
    const { placeId, ...rest } = object;
    await upsertObject(rest, placeId);
  }

  let embedded = 0;
  let skipped = 0;
  for (const ep of SEED_EPISODES) {
    const id = randomUUID();
    const timestamp = Date.now() - ep.hoursAgo * 3600 * 1000;
    const episode = {
      id,
      text: ep.text,
      timestamp,
      importance: ep.importance,
      source: ep.source,
      piiFiltered: true,
      entityRefs: ep.entityRefs,
    };
    await createEpisodeNode(episode);

    const embedding = await tryEmbedText(ep.text);
    if (embedding) {
      await upsertEpisodeVector({ ...episode, namespace: ep.namespace }, embedding);
      embedded++;
    } else {
      skipped++;
    }
  }

  return {
    persons: SEED_PERSONS.length,
    medications: SEED_MEDICATIONS.length,
    routines: SEED_ROUTINES.length,
    places: SEED_PLACES.length,
    objects: SEED_OBJECTS.length,
    episodesTotal: SEED_EPISODES.length,
    episodesEmbedded: embedded,
    episodesGraphOnly: skipped,
  };
}
