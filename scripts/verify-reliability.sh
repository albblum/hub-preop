#!/usr/bin/env bash
#
# verify-reliability.sh — gate automatizado de confiabilidade (hub-preop)
#
# Pré-requisitos:
# - Docker com Compose v2 (`docker compose`) no PATH
# - Node.js e npm
# - Ficheiro `.env` nesta pasta (hub-preop/) com `DATABASE_URL` coerente com
#   `docker-compose.yml` (ex.: postgresql://hub:hub@localhost:5432/hub_preop)
#
# O que faz: sobe o Postgres, espera `pg_isready`, `prisma migrate deploy`,
# `npm run lint`, testes Vitest com banco (SKIP_DB vazio), `npm run build`.
# Exit 0 só se todos os passos passarem.
#
# Uso a partir de hub-preop/: npm run verify:reliability
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

docker compose up -d

ready=0
timeout_secs=90
i=0
while [ "$i" -lt "$timeout_secs" ]; do
  if docker compose exec -T db pg_isready -U hub -d hub_preop >/dev/null 2>&1; then
    ready=1
    break
  fi
  i=$((i + 1))
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  echo "verify-reliability: Postgres não aceitou conexões após ${timeout_secs}s (pg_isready)." >&2
  exit 1
fi

npx prisma migrate deploy
bash scripts/check-env.sh
npm run lint
# Garantir modo com banco mesmo se o shell herdou SKIP_DB
env -u SKIP_DB npm test
npm run build

echo "verify-reliability: todos os passos concluídos com sucesso."
