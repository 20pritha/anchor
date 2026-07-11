#!/usr/bin/env bash
# Mac launch sequence (doc 09 §1 / doc 11 §1). Ollama is Mac-only in this
# project's target setup — this script assumes it's installed locally.
set -euo pipefail

echo "==> Checking Ollama..."
if ! pgrep -x "ollama" > /dev/null 2>&1; then
  echo "Starting Ollama..."
  ollama serve &
  sleep 2
else
  echo "Ollama already running."
fi

echo "==> Starting Neo4j + ChromaDB (docker compose)..."
docker compose up -d

echo "==> Checking service health..."
npx tsx scripts/check-services.ts || true

echo "==> Starting Next.js dev server..."
npm run dev
