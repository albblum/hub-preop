#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_URL="${APP_URL:-http://localhost:3000}"
DB_SERVICE="${DB_SERVICE:-db}"
WAIT_SECONDS="${WAIT_SECONDS:-60}"

cd "$ROOT_DIR"

echo "==> Starting PostgreSQL container..."
docker compose up -d "$DB_SERVICE"

echo "==> Waiting for database health..."
for i in $(seq 1 "$WAIT_SECONDS"); do
  container_id="$(docker compose ps -q "$DB_SERVICE" 2>/dev/null || true)"
  status=""
  if [[ -n "$container_id" ]]; then
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
  fi
  if [[ "$status" == "healthy" ]]; then
    echo "Database is healthy."
    break
  fi
  if [[ "$i" -eq "$WAIT_SECONDS" ]]; then
    echo "ERROR: database did not become healthy within ${WAIT_SECONDS}s."
    echo "Tip: run 'docker compose logs $DB_SERVICE' to inspect."
    exit 1
  fi
  sleep 1
done

if [[ ! -d node_modules ]]; then
  echo "==> Installing dependencies (node_modules missing)..."
  npm install
fi

echo "==> Running Prisma migrations..."
npx prisma migrate deploy

echo "==> Opening browser at $APP_URL ..."
if command -v open >/dev/null 2>&1; then
  open "$APP_URL" || true
else
  echo "Command 'open' not found. Open manually: $APP_URL"
fi

echo "==> Starting Next.js dev server (Ctrl+C to stop)..."
npm run dev
