#!/usr/bin/env bash
#
# Backup PostgreSQL do hub-preop (docker compose service "db") para ./backups/
# Uso: a partir da raiz do repo, via npm run db:backup ou: bash scripts/backup-db.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mkdir -p backups
stamp="$(date +%Y%m%d_%H%M%S)"
out="backups/hub_preop_${stamp}.dump"

docker compose exec -T db pg_dump -U hub -d hub_preop -Fc >"$out"
echo "Wrote $out"
