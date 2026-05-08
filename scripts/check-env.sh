#!/usr/bin/env bash
#
# check-env.sh — validação mínima de .env (laboratório / gate verify:reliability)
#
# Sem .env: sai 0 (ex.: CI que não carrega ficheiro local).
# Com .env: exige DATABASE_URL e AUTH_SECRET não vazios; AUTH_SECRET ≥ 16 chars.
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "check-env: sem ficheiro .env — validação ignorada."
  exit 0
fi

if ! grep -qE '^[[:space:]]*DATABASE_URL=[^[:space:]]' .env; then
  echo "check-env: DATABASE_URL em falta ou vazio em .env" >&2
  exit 1
fi

if ! grep -qE '^[[:space:]]*AUTH_SECRET=[^[:space:]]' .env; then
  echo "check-env: AUTH_SECRET em falta ou vazio em .env" >&2
  exit 1
fi

# Primeira linha AUTH_SECRET=... (valor sem aspas para contagem)
val="$(grep -m1 '^AUTH_SECRET=' .env | sed 's/^AUTH_SECRET=//' | tr -d '\r' | tr -d '"' | tr -d "'")"
if [ "${#val}" -lt 16 ]; then
  echo "check-env: AUTH_SECRET deve ter pelo menos 16 caracteres (ambiente real: prefira 32+)." >&2
  exit 1
fi

echo "check-env: variáveis mínimas (DATABASE_URL, AUTH_SECRET) OK."
