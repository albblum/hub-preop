#!/usr/bin/env bash
#
# Push do hub-preop para o GitHub (branch main).
# Uso:
#   ./scripts/push-to-github.sh                    # só push (sem alterações por commitar)
#   ./scripts/push-to-github.sh "mensagem commit" # add + commit + push
#   COMMIT_MSG="..." ./scripts/push-to-github.sh   # igual ao anterior
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -d .git ]]; then
  echo "Erro: não há .git aqui: $ROOT"
  exit 1
fi

REMOTE="${GIT_REMOTE:-origin}"
BRANCH="${GIT_BRANCH:-main}"

COMMIT_MSG="${COMMIT_MSG:-}"
if [[ $# -ge 1 ]]; then
  COMMIT_MSG="$1"
fi

echo "==> Repo: $ROOT"
echo "==> Remote: $REMOTE | Branch: $BRANCH"

if ! git remote get-url "$REMOTE" &>/dev/null; then
  echo "Erro: remote '$REMOTE' não existe. Ex.: git remote add origin git@github.com:USER/REPO.git"
  exit 1
fi

echo "==> Remote URL:"
git remote get-url "$REMOTE"

# Garantir branch local
CURRENT="$(git branch --show-current 2>/dev/null || true)"
if [[ -z "$CURRENT" ]]; then
  echo "Erro: detached HEAD ou sem branch. Faz checkout a uma branch primeiro."
  exit 1
fi

if [[ "$CURRENT" != "$BRANCH" ]]; then
  echo "Aviso: estás em '$CURRENT', não em '$BRANCH'."
  read -r -p "Queres mudar para $BRANCH? [s/N] " ans
  if [[ "${ans:-}" =~ ^[sS]$ ]]; then
    git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH"
  else
    echo "Abortado."
    exit 1
  fi
fi

# Commit se houver alterações
if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  if [[ -z "$COMMIT_MSG" ]]; then
    echo ""
    echo "Há alterações não commitadas. Passa uma mensagem de commit:"
    echo "  $0 \"feat(hub-preop): descrição\""
    echo "ou:"
    echo "  COMMIT_MSG=\"...\" $0"
    exit 1
  fi
  echo "==> git add -A"
  git add -A
  echo "==> git commit"
  git commit -m "$COMMIT_MSG"
else
  echo "==> Sem alterações novas para commit."
fi

echo "==> git fetch $REMOTE"
git fetch "$REMOTE" || true

REMOTE_REF="refs/remotes/${REMOTE}/${BRANCH}"
BEHIND=0
if git show-ref --verify --quiet "$REMOTE_REF" 2>/dev/null; then
  BEHIND="$(git rev-list --count HEAD.."${REMOTE}/${BRANCH}" 2>/dev/null || echo 0)"
fi

if [[ "${BEHIND}" != "0" ]]; then
  echo "Aviso: o remoto tem commits que tu não tens (${BEHIND}). Antes do push pode ser preciso:"
  echo "  git pull --rebase ${REMOTE} ${BRANCH}"
  read -r -p "Continuar mesmo assim com push? [s/N] " ans2
  if [[ ! "${ans2:-}" =~ ^[sS]$ ]]; then
    exit 1
  fi
fi

echo "==> git push -u ${REMOTE} ${BRANCH}"
git push -u "$REMOTE" "$BRANCH"

echo ""
echo "OK: push concluído para ${REMOTE}/${BRANCH}."
