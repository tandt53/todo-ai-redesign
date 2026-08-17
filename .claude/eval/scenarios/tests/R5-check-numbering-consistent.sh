#!/usr/bin/env bash
# R5 — The reviewer's C-check count is consistent everywhere it is quoted.
#
# reviewer-agent.md is the source of truth: it defines the checks as `### C<n> — ...`
# headings. ORCHESTRATION.md, the metrics protocol, and the Layer-2 hook all
# quote that range as "C1-C8" / "C1–C9". When a check is added and a quote is
# missed, the metrics protocol tells reviewer-agent to self-report a checks_run
# that contradicts the checks it just ran, and Layer-2 dashboards under-count.
#
# This scenario derives N from reviewer-agent.md, then fails any file quoting
# a different upper bound.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
AGENTS_DIR="$CLAUDE_ROOT/agents"
REVIEWER="$AGENTS_DIR/reviewer-agent.md"

echo "─── R5 — C-check numbering consistent across template ───"

if [ ! -f "$REVIEWER" ]; then
  _record_fail "reviewer-agent.md missing — cannot derive check count"
  pass_or_fail "R5" || true
  echo "R5 VERDICT: FAIL"
  exit 1
fi

# Source of truth: the `### C<n> — ` headings in reviewer-agent.md.
N=$(grep -cE '^### C[0-9]+ ' "$REVIEWER" || true)
N=${N:-0}

if [ "$N" -lt 1 ]; then
  _record_fail "no '### C<n>' check headings found in reviewer-agent.md"
  pass_or_fail "R5" || true
  echo "R5 VERDICT: FAIL"
  exit 1
fi
_record_pass "reviewer-agent.md defines $N checks (C1–C${N})"

# Checks must be numbered contiguously from 1.
expected=1
while IFS= read -r n; do
  if [ "$n" -ne "$expected" ]; then
    _record_fail "check headings not contiguous: expected C${expected}, found C${n}"
    break
  fi
  expected=$((expected + 1))
done < <(grep -oE '^### C[0-9]+ ' "$REVIEWER" | grep -oE '[0-9]+')
[ "$expected" -eq $((N + 1)) ] && _record_pass "check headings contiguous C1–C${N}"

# Every quoted range elsewhere must end at N. Matches C1-C8 / C1–C9 / C1 - C7.
#
# The dash alternates as (-|–|—), NOT as a bracket class [-–—]. A bracket class
# holding a multibyte character is a set of its BYTES, so `[-–]` matches the
# ASCII hyphen and three stray bytes — never the en-dash itself. This check ran
# for months quoting "all ranges agree" while silently skipping every en-dash
# reference, which is most of them. If you touch this pattern, re-run the
# negative test: change one C1–CN quote and confirm R5 fails.
SEARCH=("$AGENTS_DIR" "$CLAUDE_ROOT/ORCHESTRATION.md" "$CLAUDE_ROOT/hooks")
BAD=0
while IFS= read -r hit; do
  [ -z "$hit" ] && continue
  quoted=$(printf '%s' "$hit" | grep -oE 'C1[[:space:]]*(-|–|—)[[:space:]]*C?[0-9]+' | grep -oE '[0-9]+$' | head -1)
  [ -z "$quoted" ] && continue
  if [ "$quoted" -ne "$N" ]; then
    _record_fail "stale check range in ${hit%%:*} — quotes C1–C${quoted}, reviewer defines C1–C${N}"
    BAD=$((BAD + 1))
  fi
done < <(grep -rEnH 'C1[[:space:]]*(-|–|—)[[:space:]]*C?[0-9]+' "${SEARCH[@]}" 2>/dev/null)

[ "$BAD" -eq 0 ] && _record_pass "all quoted C-ranges agree with reviewer-agent.md"

if pass_or_fail "R5"; then
  echo "R5 VERDICT: PASS"
  exit 0
else
  echo "R5 VERDICT: FAIL"
  exit 1
fi
