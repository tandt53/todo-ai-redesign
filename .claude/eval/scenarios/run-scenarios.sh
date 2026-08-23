#!/usr/bin/env bash
# Eval-scenarios runner for the project-starter template.
#
# Every scenario here is R-tier: pure static analysis of the prompt files
# (grep / awk / file existence). No `claude` CLI, no network, no cost,
# sub-second. Run it before merging ANY change to an agent, protocol,
# ORCHESTRATION.md, or hook.
#
# Usage:
#   bash run-scenarios.sh              # all R-tier scenarios (default)
#   bash run-scenarios.sh R            # same
#   bash run-scenarios.sh R2 R5        # specific scenarios
#
# Each scenario is a script under tests/ named R<n>-description.sh.
# Exit 0 = PASS, 77 = SKIP, anything else = FAIL.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTS_DIR="$SCRIPT_DIR/tests"

declare -a SCENARIOS=()
MODE="${1:-R}"

case "$MODE" in
  R) SCENARIOS=(R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11 R12 R13 R14 R15 R16 R17 R18 R19 R20) ;;
  # Proves each scenario can fail. A green suite says the checks did not fire;
  # only the sweep says they are capable of firing at all.
  mutation) exec bash "$SCRIPT_DIR/mutation-test.sh" "${@:2}" ;;
  *) SCENARIOS=("$@") ;;
esac

[ "${#SCENARIOS[@]}" -eq 0 ] && { echo "No scenarios to run." >&2; exit 0; }

# Parse-check every resolved script before running it. bash 3.2 (macOS default)
# can swallow quote-balance bugs until runtime; `bash -n` surfaces them here.
parse_fail=0
for sid in "${SCENARIOS[@]}"; do
  script="$(find "$TESTS_DIR" -maxdepth 1 -name "${sid}-*.sh" | head -1)"
  if [ -z "$script" ]; then
    echo "UNKNOWN SCENARIO: $sid (no tests/${sid}-*.sh)" >&2
    parse_fail=1
    continue
  fi
  if ! bash -n "$script" 2>&1; then
    echo "PARSE-FAIL: $script" >&2
    parse_fail=1
  fi
done
[ "$parse_fail" -ne 0 ] && { echo "Aborting: fix the errors above before running." >&2; exit 2; }

PASSED=0
FAILED=0
SKIPPED=0
declare -a FAILED_IDS=()

for sid in "${SCENARIOS[@]}"; do
  script="$(find "$TESTS_DIR" -maxdepth 1 -name "${sid}-*.sh" | head -1)"
  echo ""
  set +e
  bash "$script"
  rc=$?
  set -e
  case "$rc" in
    0)  PASSED=$((PASSED + 1)) ;;
    77) SKIPPED=$((SKIPPED + 1)) ;;
    *)  FAILED=$((FAILED + 1)); FAILED_IDS+=("$sid") ;;
  esac
done

echo ""
echo "============================================"
echo "  $PASSED passed · $FAILED failed · $SKIPPED skipped"
if [ "$FAILED" -gt 0 ]; then
  echo "  Failed: ${FAILED_IDS[*]}"
  echo "============================================"
  exit 1
fi
echo "============================================"
exit 0
