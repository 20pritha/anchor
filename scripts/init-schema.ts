import { getDriver, closeDriver } from "@/lib/memory/neo4j";

const STATEMENTS = [
  "CREATE CONSTRAINT person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE",
  "CREATE CONSTRAINT medication_id IF NOT EXISTS FOR (m:Medication) REQUIRE m.id IS UNIQUE",
  "CREATE CONSTRAINT routine_id IF NOT EXISTS FOR (r:Routine) REQUIRE r.id IS UNIQUE",
  "CREATE CONSTRAINT place_id IF NOT EXISTS FOR (pl:Place) REQUIRE pl.id IS UNIQUE",
  "CREATE CONSTRAINT object_id IF NOT EXISTS FOR (o:Object) REQUIRE o.id IS UNIQUE",
  "CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE",
  "CREATE CONSTRAINT episode_id IF NOT EXISTS FOR (e:Episode) REQUIRE e.id IS UNIQUE",
  "CREATE INDEX person_name IF NOT EXISTS FOR (p:Person) ON (p.name)",
  "CREATE INDEX medication_name IF NOT EXISTS FOR (m:Medication) ON (m.name)",
  "CREATE INDEX object_label IF NOT EXISTS FOR (o:Object) ON (o.label)",
  "CREATE INDEX episode_timestamp IF NOT EXISTS FOR (e:Episode) ON (e.timestamp)",
];

async function main() {
  const driver = getDriver();
  const session = driver.session();
  try {
    for (const statement of STATEMENTS) {
      await session.run(statement);
      console.log(`OK: ${statement}`);
    }
  } finally {
    await session.close();
    await closeDriver();
  }
}

main().catch((err) => {
  console.error("Schema init failed:", err);
  process.exitCode = 1;
});
