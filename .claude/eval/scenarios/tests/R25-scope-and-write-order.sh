#!/usr/bin/env bash
# R25 — Three remedies from the orchestrator defect review that are checkable,
# and one that is not.
#
# C1/C2 — a task scoped to the file that happened to be looked at. A mobile test
# was fixed while the web twin carried the identical defect and went red the same
# day; a task scoped to colour left five motion literals behind. Both were one
# grep from complete before the row was written.
#
# E2 — a script removed 38 rows from the queue and truncated the archive in the
# same run, then crashed between the two writes. The rows existed nowhere. An
# ordering bug, not a selection bug.
#
# E5 — an unquoted heredoc let bash expand backticks inside a task row and wrote
# mangled data, silently.
#
# E3 has no check here and is not going to get one: a failure that resembles a
# known, documented tension gets attributed to that tension, and the remedy is to
# read whether the documented fix is already in the code. That is judgement. This
# file says so rather than inventing a check that would pass regardless.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SWEEP="$CLAUDE_ROOT/tools/sibling-sweep/find-siblings.sh"
LIB="$CLAUDE_ROOT/lib/tasks.sh"

echo "─── R25 — sibling scope, safe write order, quoted heredocs ───"

assert_file_exists "$SWEEP" "find-siblings.sh present"

FIX="$(mktemp -d)"
trap 'rm -rf "$FIX"' EXIT
mkdir -p "$FIX/src/web" "$FIX/src/mobile"
echo '.list { transition: opacity 200ms ease; }' > "$FIX/src/web/list.css"
echo '.card { transition: transform 150ms; }'    > "$FIX/src/mobile/card.css"

# Non-zero is the expected result for two of the three cases, so every call
# absorbs its own status rather than letting `set -e` end the scenario on a
# correct answer.
run_sweep() { ( cd "$FIX" && bash "$SWEEP" --pattern "$1" --found-in "$2" --scope src 2>&1 ) || true; }
sweep_code() {
  local rc=0
  ( cd "$FIX" && bash "$SWEEP" --pattern "$1" --found-in "$2" --scope src >/dev/null 2>&1 ) || rc=$?
  echo "$rc"
}

OUT="$(run_sweep 'transition:[^;]*[0-9]+ms' src/web/list.css)"
if printf '%s' "$OUT" | grep -q 'src/mobile/card.css'; then
  _record_pass "names the twin file carrying the same shape"
else
  _record_fail "missed a sibling with the identical defect"
fi
assert_eq "$(sweep_code 'transition:[^;]*[0-9]+ms' src/web/list.css)" "1" \
  "exits non-zero when siblings exist, so the row cannot be written unaware"

assert_eq "$(sweep_code 'opacity 200ms' src/web/list.css)" "0" \
  "exits 0 when the origin really is the only place"

# The origin is the canary. A pattern that cannot find the defect where the
# defect is known to be would report a clean tree — which is what six wrong
# predicates did, six times, in this project.
CANARY_OUT="$(run_sweep 'animation-duration' src/web/list.css)"
if printf '%s' "$CANARY_OUT" | grep -q 'does not match'; then
  _record_pass "refuses a pattern that does not match its own origin"
else
  _record_fail "a pattern blind to its own origin was allowed to report"
fi
assert_eq "$(sweep_code 'animation-duration' src/web/list.css)" "2" \
  "a blind pattern exits 2 — distinct from a clean tree"

# ── E2: the write order ────────────────────────────────────────────────────
assert_file_contains "$LIB" 'tasks_archive' "the reader owns the archival ordering"

W="$FIX/proj"
mkdir -p "$W/.claude/lib" "$W/.claude/state"
cp "$LIB" "$W/.claude/lib/"
cat > "$W/.claude/state/TASKS.md" <<'MD'
| ID | Title | Module | Feature | Agent | Pri | Depends | Status | Artifacts | Outcome |
|----|-------|--------|---------|-------|-----|---------|--------|-----------|---------|
| T-001 | Spec | auth | F-001 | spec-agent | P0 | — | DONE | specs/a.md | 7 AC |
| T-003 | Live | auth | F-001 | web-agent | P1 | — | PENDING | — | — |
MD
printf '# Archived tasks\n\n| T-000 | Ancient | x | y | z | P3 | — | DONE | a.md | done |\n' \
  > "$W/.claude/state/TASKS-archive.md"

( cd "$W" && bash .claude/lib/tasks.sh archive T-001 ) >/dev/null 2>&1
if grep -q 'T-001' "$W/.claude/state/TASKS-archive.md" && ! grep -q '^| T-001' "$W/.claude/state/TASKS.md"; then
  _record_pass "a row reaches the archive and leaves the queue"
else
  _record_fail "the row did not move correctly"
fi

# The archive is the only copy of everything moved before. A rewrite that
# truncates it loses all of that; append is the only safe verb.
if grep -q 'T-000' "$W/.claude/state/TASKS-archive.md"; then
  _record_pass "existing archive rows survive the move"
else
  _record_fail "the archive was truncated — the defect this ordering exists to stop"
fi

# An id that is not in the queue must move nothing at all, rather than
# half-writing and then failing.
BEFORE="$(grep -c '^| T-' "$W/.claude/state/TASKS.md")"
( cd "$W" && bash .claude/lib/tasks.sh archive T-999 ) >/dev/null 2>&1 || true
AFTER="$(grep -c '^| T-' "$W/.claude/state/TASKS.md")"
assert_eq "$AFTER" "$BEFORE" "an unknown id moves nothing"
if grep -q 'T-999' "$W/.claude/state/TASKS-archive.md" 2>/dev/null; then
  _record_fail "an unknown id was appended to the archive before the check"
else
  _record_pass "an unknown id never reaches the archive"
fi

# ── E5: heredocs that execute what they were meant to write ────────────────
# `$VAR` expansion is often wanted. Command substitution inside a heredoc that
# writes data almost never is, and it corrupts silently.
OFFENDERS=""
while IFS= read -r f; do
  case "$f" in */eval/scenarios/*) continue ;; esac
  awk '
    /<<[A-Za-z_]/ && !/<<-?[\x27"]/ { inhd = 1; next }
    inhd && /^[A-Za-z_]+$/ { inhd = 0; next }
    inhd && (/`/ || /\$\(/) { print FILENAME; exit }
  ' "$f" 2>/dev/null | while IFS= read -r hit; do [ -n "$hit" ] && echo "$hit"; done
done < <(find "$CLAUDE_ROOT" -type f -name '*.sh' 2>/dev/null) > "$FIX/offenders.txt"
OFFENDERS="$(grep -v '^$' "$FIX/offenders.txt" || true)"

if [ -z "$OFFENDERS" ]; then
  _record_pass "no unquoted heredoc runs command substitution in its body"
else
  for o in $OFFENDERS; do
    _record_fail "${o#"$CLAUDE_ROOT"/} has an unquoted heredoc whose body executes — quote the delimiter"
  done
fi

# And the detection must be able to fire, or its zero says nothing.
CAN="$FIX/canary.sh"
printf '#!/usr/bin/env bash\ncat <<EOF > /tmp/x\nrow `date`\nEOF\n' > "$CAN"
if awk '
    /<<[A-Za-z_]/ && !/<<-?[\x27"]/ { inhd = 1; next }
    inhd && /^[A-Za-z_]+$/ { inhd = 0; next }
    inhd && (/`/ || /\$\(/) { found = 1; exit }
    END { exit !found }
  ' "$CAN" 2>/dev/null; then
  _record_pass "the heredoc detection finds a planted offender"
else
  _record_fail "the heredoc detection missed a planted offender"
fi

if pass_or_fail "R25"; then
  echo "R25 VERDICT: PASS"
  exit 0
else
  echo "R25 VERDICT: FAIL"
  exit 1
fi
