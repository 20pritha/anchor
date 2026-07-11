import { seedDemoData } from "@/lib/seed";
import { closeDriver } from "@/lib/memory/neo4j";

async function main() {
  console.log("Seeding Neo4j graph + ChromaDB episodic memory...");
  const summary = await seedDemoData();
  console.log(
    `Graph seeded: 1 user, ${summary.persons} people, ${summary.medications} medications, ` +
      `${summary.routines} routines, ${summary.places} places, ${summary.objects} objects.`,
  );
  console.log(
    `Episodes seeded: ${summary.episodesTotal} total, ${summary.episodesEmbedded} embedded into ChromaDB, ` +
      `${summary.episodesGraphOnly} graph-only (local embedder unavailable — those degrade gracefully to ` +
      "graph-only recall).",
  );
}

main()
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exitCode = 1;
  })
  .finally(() => closeDriver());
