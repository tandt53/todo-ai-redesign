#!/usr/bin/env bash
# Assertion helpers. Each assertion echoes "PASS:" or "FAIL:" and tracks the count.
# A scenario calls `pass_or_fail` at the end to print verdict.

# Initialised by the scenario runner before any asserts.
ASSERT_PASS=0
ASSERT_FAIL=0
ASSERT_FAILED_LIST=""

# Exit a scenario as SKIPPED. Use for environment / infrastructure conditions
# (missing CLI, offline, harness unreachable) — NOT for bugs in the agent under
# test. Exit code 77 is the de-facto convention (Automake, autotools); the
# runner buckets it separately from PASS/FAIL.
skip_scenario() {
  local reason="${1:-no reason given}"
  echo "  [SKIP] $reason"
  exit 77
}

_record_pass() {
  ASSERT_PASS=$((ASSERT_PASS + 1))
  echo "  PASS: $1"
}

_record_fail() {
  ASSERT_FAIL=$((ASSERT_FAIL + 1))
  ASSERT_FAILED_LIST="${ASSERT_FAILED_LIST}\n    - $1"
  echo "  FAIL: $1"
}

assert_file_exists() {
  local f="$1" desc="${2:-$f exists}"
  [ -f "$f" ] && _record_pass "$desc" || _record_fail "$desc (file not found at $f)"
}

assert_file_not_exists() {
  local f="$1" desc="${2:-$f should NOT exist}"
  [ ! -e "$f" ] && _record_pass "$desc" || _record_fail "$desc (path exists at $f)"
}

assert_file_lines_lte() {
  local f="$1" max="$2" desc="${3:-$(basename "$f") ≤ $max lines}"
  if [ ! -f "$f" ]; then _record_fail "$desc (file missing)"; return; fi
  local n; n=$(wc -l < "$f" | tr -d ' ')
  [ "$n" -le "$max" ] && _record_pass "$desc (got $n)" || _record_fail "$desc (got $n)"
}

assert_file_lines_gte() {
  local f="$1" min="$2" desc="${3:-$(basename "$f") ≥ $min lines}"
  if [ ! -f "$f" ]; then _record_fail "$desc (file missing)"; return; fi
  local n; n=$(wc -l < "$f" | tr -d ' ')
  [ "$n" -ge "$min" ] && _record_pass "$desc (got $n)" || _record_fail "$desc (got $n)"
}

assert_file_contains() {
  local f="$1" needle="$2" desc="${3:-$(basename "$f") contains '$needle'}"
  if [ ! -f "$f" ]; then _record_fail "$desc (file missing)"; return; fi
  if grep -qF -- "$needle" "$f"; then _record_pass "$desc"; else _record_fail "$desc"; fi
}

assert_file_not_contains() {
  local f="$1" needle="$2" desc="${3:-$(basename "$f") does NOT contain '$needle'}"
  if [ ! -f "$f" ]; then _record_fail "$desc (file missing)"; return; fi
  if ! grep -qF -- "$needle" "$f"; then _record_pass "$desc"; else _record_fail "$desc (unexpected match)"; fi
}

assert_file_grep_count() {
  local f="$1" pattern="$2" op="$3" expected="$4" desc="${5:-$(basename "$f") grep '$pattern' $op $expected}"
  if [ ! -f "$f" ]; then _record_fail "$desc (file missing)"; return; fi
  # grep -c prints "0" then exits 1 when no match. `|| echo 0` would append a second "0",
  # producing "0\n0" which breaks numeric comparison under `set -e`. Use `|| true` instead —
  # grep already wrote the count; we just need to swallow the non-zero exit code.
  local n; n=$(grep -cE -- "$pattern" "$f" 2>/dev/null || true)
  n=${n:-0}
  case "$op" in
    "==") [ "$n" -eq "$expected" ] && _record_pass "$desc (got $n)" || _record_fail "$desc (got $n)" ;;
    ">=") [ "$n" -ge "$expected" ] && _record_pass "$desc (got $n)" || _record_fail "$desc (got $n)" ;;
    "<=") [ "$n" -le "$expected" ] && _record_pass "$desc (got $n)" || _record_fail "$desc (got $n)" ;;
    *) _record_fail "$desc (bad op $op)" ;;
  esac
}

assert_eq() {
  local got="$1" expected="$2" desc="${3:-eq}"
  [ "$got" = "$expected" ] && _record_pass "$desc (got=$got)" || _record_fail "$desc (got=$got expected=$expected)"
}

assert_not_eq() {
  local got="$1" not_expected="$2" desc="${3:-not eq}"
  [ "$got" != "$not_expected" ] && _record_pass "$desc (got=$got)" || _record_fail "$desc (got=$got, expected NOT $not_expected)"
}

assert_int_le() {
  local got="$1" cap="$2" desc="${3:-int ≤ $cap}"
  [ "$got" -le "$cap" ] && _record_pass "$desc (got=$got)" || _record_fail "$desc (got=$got)"
}

assert_int_ge() {
  local got="$1" floor="$2" desc="${3:-int ≥ $floor}"
  [ "$got" -ge "$floor" ] && _record_pass "$desc (got=$got)" || _record_fail "$desc (got=$got)"
}

assert_grep_zero() {
  # Run grep across files; pass iff no matches. Used for cross-file regression checks.
  local pattern="$1"; shift
  local desc="${1:-no matches for /$pattern/}"; shift || true
  local n
  n=$(grep -rEnH -- "$pattern" "$@" 2>/dev/null | wc -l | tr -d ' ')
  [ "$n" -eq 0 ] && _record_pass "$desc" || _record_fail "$desc (got $n hits — first 3: $(grep -rEnH -- "$pattern" "$@" 2>/dev/null | head -3 | tr '\n' '|'))"
}

# Verdict for a scenario
pass_or_fail() {
  local label="$1"
  echo ""
  echo "─── $label: $ASSERT_PASS passed, $ASSERT_FAIL failed ───"
  if [ "$ASSERT_FAIL" -gt 0 ]; then
    echo -e "Failed checks:$ASSERT_FAILED_LIST"
    return 1
  fi
  return 0
}
