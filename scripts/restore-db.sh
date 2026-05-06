#!/usr/bin/env bash
#
# Restore destrutivo (laboratório) a partir de dump pg_dump -Fc.
# Exige confirmação interativa (digite YES).
#
# Uso:
#   bash scripts/restore-db.sh path/to/file.dump
#   RESTORE_DUMP=path/to/file.dump bash scripts/restore-db.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DUMP="${1:-${RESTORE_DUMP:-}}"
if [[ -z "$DUMP" ]]; then
  echo "Usage: bash scripts/restore-db.sh <dump.dump>" >&2
  echo "   or: RESTORE_DUMP=<dump.dump> bash scripts/restore-db.sh" >&2
  exit 1
fi

if [[ ! -f "$DUMP" ]]; then
  echo "File not found: $DUMP" >&2
  exit 1
fi

echo "WARNING: This replaces objects in database hub_preop inside the db container (lab only)."
echo "Stop npm run dev and other DB clients first. Press Ctrl+C to abort."
read -r -p "Type YES to continue: " confirm
if [[ "$confirm" != "YES" ]]; then
  echo "Aborted."
  exit 1
fi

docker compose exec -T db pg_restore -U hub -d hub_preop --clean --if-exists -v - <"$DUMP"
echo "Restore finished."
