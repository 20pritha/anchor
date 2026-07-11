import { env } from "@/lib/config";
import { getDriver, closeDriver } from "@/lib/memory/neo4j";

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

async function checkOllama(): Promise<CheckResult> {
  try {
    const res = await fetch(new URL("/api/tags", env.OLLAMA_BASE_URL));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const names = data.models?.map((m) => m.name).join(", ") ?? "(none pulled)";
    return { name: "Ollama", ok: true, detail: `reachable at ${env.OLLAMA_BASE_URL} — models: ${names}` };
  } catch (err) {
    return { name: "Ollama", ok: false, detail: `unreachable at ${env.OLLAMA_BASE_URL}: ${(err as Error).message}` };
  }
}

async function checkNeo4j(): Promise<CheckResult> {
  try {
    const driver = getDriver();
    await driver.getServerInfo();
    return { name: "Neo4j", ok: true, detail: `reachable at ${env.NEO4J_URI}` };
  } catch (err) {
    return { name: "Neo4j", ok: false, detail: `unreachable at ${env.NEO4J_URI}: ${(err as Error).message}` };
  }
}

async function checkChroma(): Promise<CheckResult> {
  try {
    const res = await fetch(new URL("/api/v2/heartbeat", env.CHROMA_URL));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { name: "ChromaDB", ok: true, detail: `reachable at ${env.CHROMA_URL}` };
  } catch (err) {
    return { name: "ChromaDB", ok: false, detail: `unreachable at ${env.CHROMA_URL}: ${(err as Error).message}` };
  }
}

async function main() {
  const results = await Promise.all([checkOllama(), checkNeo4j(), checkChroma()]);
  for (const r of results) {
    console.log(`${r.ok ? "OK  " : "FAIL"} ${r.name}: ${r.detail}`);
  }
  const anyFailed = results.some((r) => !r.ok);
  if (anyFailed) {
    console.log(
      "\nNote: Ollama is Mac-only in this project's target setup — a FAIL here on a non-Mac dev " +
        "machine is expected (see docs/11 build-blind constraint). Neo4j/ChromaDB should be reachable " +
        "if `docker compose up -d` has been run.",
    );
  }
  process.exitCode = anyFailed ? 1 : 0;
}

main().finally(() => closeDriver());
