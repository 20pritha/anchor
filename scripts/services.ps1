# Windows dev equivalent of services.sh. Ollama is Mac-only in this
# project's target setup (see docs/11 build-blind constraint) — this script
# only brings up the OS-neutral pieces: Neo4j + ChromaDB via Docker, then the
# Next.js dev server. `npm run check` will report Ollama as unreachable here,
# which is expected on a non-Mac dev machine.

Write-Host "==> Starting Neo4j + ChromaDB (docker compose)..."
docker compose up -d

Write-Host "==> Checking service health..."
npx tsx scripts/check-services.ts

Write-Host "==> Starting Next.js dev server..."
npm run dev
