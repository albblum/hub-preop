#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$ROOT_DIR/tmp/g1-tests"
VALIDATOR_CMD=(npm run validate:markdown --)

PASSED=0
FAILED=0

run_case() {
  local case_id="$1"
  local expected="$2"
  shift 2
  local args=("$@")

  echo ""
  echo "[$case_id] Expected: $expected"
  echo "Command: ${VALIDATOR_CMD[*]} ${args[*]}"

  set +e
  "${VALIDATOR_CMD[@]}" "${args[@]}"
  local exit_code=$?
  set -e

  if [[ "$expected" == "pass" && $exit_code -eq 0 ]]; then
    echo "Result: PASS (as expected)"
    PASSED=$((PASSED + 1))
  elif [[ "$expected" == "fail" && $exit_code -ne 0 ]]; then
    echo "Result: PASS (failed as expected)"
    PASSED=$((PASSED + 1))
  else
    echo "Result: FAIL (unexpected exit code: $exit_code)"
    FAILED=$((FAILED + 1))
  fi
}

main() {
  set -e

  cd "$ROOT_DIR"

  mkdir -p "$TMP_DIR"

  cat > "$TMP_DIR/valid.md" <<'EOF'
# Titulo de teste

Texto normativo de teste para validar o fluxo G.1.

## Art. 1
Fica estabelecido que este conteudo e valido.
EOF

  : > "$TMP_DIR/empty.md"

  cat > "$TMP_DIR/not-md.txt" <<'EOF'
Arquivo texto simples.
EOF

  echo "Running G.1 markdown validation flow..."
  echo "Workspace: $ROOT_DIR"

  run_case "MD-01 valid file" "pass" --file "$TMP_DIR/valid.md"
  run_case "MD-02 empty file" "fail" --file "$TMP_DIR/empty.md"
  run_case "MD-03 missing file" "fail" --file "$TMP_DIR/missing.md"
  run_case "MD-04 non-md extension" "pass" --file "$TMP_DIR/not-md.txt"
  run_case "MD-05 invalid min-chars" "fail" --file "$TMP_DIR/valid.md" --min-chars 0

  echo ""
  echo "=============================="
  echo "G.1 Markdown Flow Test Summary"
  echo "Passed checks: $PASSED"
  echo "Failed checks: $FAILED"
  echo "=============================="

  if [[ $FAILED -gt 0 ]]; then
    exit 1
  fi
}

main "$@"
