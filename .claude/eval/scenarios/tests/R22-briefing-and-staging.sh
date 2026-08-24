#!/usr/bin/env bash
# R22 — The two mechanical remedies from the orchestrator defect review.
#
# From one session's defects: six briefings sent an agent after something that
# was not there, and twice a directory-wide `git add` swept a running agent's
# work into an unrelated commit. Five of the six briefing defects were found by
# the agent — which means after the dispatch was paid for — and the staging one
# ended with an agent finding its own work already committed and declining
# credit for it.
#
# Both remedies are mechanical, which is the only kind that survives. This
# project has recorded three times that a fix depending on someone remembering
# is not a fix, so these are checks or they are nothing.
#
# The fixtures are the real defect shapes, not invented ones.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
BRIEF_TOOL="$CLAUDE_ROOT/tools/briefing-check/check-briefing.sh"
STAGE_TOOL="$CLAUDE_ROOT/tools/staging-check/check-staged.sh"
ORCH="$CLAUDE_ROOT/ORCHESTRATION.md"

echo "─── R22 — briefings are verified, in-flight work is not committed ───"

assert_file_exists "$BRIEF_TOOL" "check-briefing.sh present"
assert_file_exists "$STAGE_TOOL" "check-staged.sh present"
assert_file_contains "$ORCH" 'check-briefing.sh' "the dispatch protocol runs the briefing check"

# The check must sit before the dispatch, or it reports on a briefing already paid for.
brief_line="$(grep -n 'check-briefing.sh' "$ORCH" | head -1 | cut -d: -f1)"
dispatch_line="$(grep -n '^### Step 4: Dispatch Agent' "$ORCH" | head -1 | cut -d: -f1)"
if [ -n "$brief_line" ] && [ -n "$dispatch_line" ] && [ "$brief_line" -lt "$dispatch_line" ]; then
  _record_pass "the briefing check runs before the dispatch step"
else
  _record_fail "the briefing check is not positioned before dispatch"
fi

# The limit has to be stated. A check that silently covers only half the failure
# class invites the other half to be treated as covered.
assert_file_contains "$ORCH" 'brief the measurement, not the mechanism' \
  "the protocol states what the check cannot catch"

FIX="$(mktemp -d)"
trap 'rm -rf "$FIX"' EXIT

# ── Briefing: the real defect shapes ───────────────────────────────────────
mkdir -p "$FIX/.claude/tools/briefing-check" "$FIX/docs/design/_shared" "$FIX/tests/harness"
cp "$BRIEF_TOOL" "$FIX/.claude/tools/briefing-check/"
printf 'x\n%.0s' $(seq 1 40) > "$FIX/docs/design/_shared/information-architecture.md"
echo 'harness' > "$FIX/tests/harness/qa-doors.ts"

# A4: a spec path off by two directories. A5: a citation past the end of a file
# that does not exist. A6: an endpoint's file in scope while its tree is denied.
cat > "$FIX/bad.md" <<'MD'
# BRIEFING — T-200
## Read these files first
- `docs/specs/assistant/information-architecture.md`
- `tests/harness/qa-doors.ts`
- `F-006-recently-deleted.md:764`
## Do not touch
- `tests/`
MD
OUT="$( cd "$FIX" && bash .claude/tools/briefing-check/check-briefing.sh bad.md 2>&1 || true )"

# Each probe requires the FAIL line, not merely the path. Grepping the path
# alone passes against `ok  docs/specs/...` too, so a checker that stopped
# failing would still look caught — which is how a check certifies whatever it
# is handed.
for probe in \
  'FAIL  docs/specs/assistant:a read path that does not exist' \
  'FAIL  F-006-recently-deleted.md:764 cites:a citation into a missing file' \
  'FAIL  tests/harness/qa-doors.ts is in scope:a path both in scope and off-limits'
do
  pat="${probe%%:*}"; label="${probe##*:}"
  if printf '%s' "$OUT" | grep -qF "$pat"; then
    _record_pass "catches $label"
  else
    _record_fail "missed $label"
  fi
done

if ( cd "$FIX" && bash .claude/tools/briefing-check/check-briefing.sh bad.md ) >/dev/null 2>&1; then
  _record_fail "exited 0 on a briefing with three defects"
else
  _record_pass "exits non-zero on a defective briefing"
fi

# A briefing that is right must pass, or the check gets switched off in a week.
cat > "$FIX/good.md" <<'MD'
# BRIEFING — T-201
## Read these files first
- `docs/design/_shared/information-architecture.md`
- `tests/harness/qa-doors.ts`
## Write to
- `docs/design/_shared/new-page.md`
MD
if ( cd "$FIX" && bash .claude/tools/briefing-check/check-briefing.sh good.md ) >/dev/null 2>&1; then
  _record_pass "a briefing whose paths resolve passes"
else
  _record_fail "false positive on a correct briefing"
fi

# An output path may legitimately not exist yet — only inputs must resolve.
if printf '%s' "$( cd "$FIX" && bash .claude/tools/briefing-check/check-briefing.sh good.md 2>&1 )" \
   | grep -q 'new-page.md does not exist'; then
  _record_fail "treated a write target as a missing input"
else
  _record_pass "a write target is not required to exist"
fi

# ── Staging: the D2 shape ──────────────────────────────────────────────────
W="$FIX/repo"
mkdir -p "$W/.claude/state" "$W/.claude/tools/staging-check" "$W/docs" "$W/src/auth"
cp "$STAGE_TOOL" "$W/.claude/tools/staging-check/"
( cd "$W" && git init -q . && git config user.email r22@test && git config user.name r22 ) >/dev/null 2>&1
cat > "$W/.claude/state/STATUS.md" <<'MD'
## In-Flight
| Task | Agent | Module | Feature | Subtree | Started |
|------|-------|--------|---------|---------|---------|
| T-101 | design-agent | auth | F-006 | docs/ | 10:00 |

## Other
MD
echo spec > "$W/docs/ia.md"; echo other > "$W/README.md"

( cd "$W" && git add -A ) >/dev/null 2>&1
if ( cd "$W" && bash .claude/tools/staging-check/check-staged.sh ) >/dev/null 2>&1; then
  _record_fail "allowed a commit staging a running agent's subtree"
else
  _record_pass "refuses a commit that stages an in-flight subtree"
fi

STAGE_OUT="$( cd "$W" && bash .claude/tools/staging-check/check-staged.sh 2>&1 || true )"
if printf '%s' "$STAGE_OUT" | grep -q 'design-agent (T-101)'; then
  _record_pass "names the agent and task whose work was about to be committed"
else
  _record_fail "did not name which dispatch owns the staged path"
fi

( cd "$W" && git reset -q && git add README.md ) >/dev/null 2>&1
if ( cd "$W" && bash .claude/tools/staging-check/check-staged.sh ) >/dev/null 2>&1; then
  _record_pass "an unrelated file stages cleanly while an agent runs"
else
  _record_fail "false positive: blocked a file outside every in-flight subtree"
fi

# Nothing in flight must not block anything, or the check becomes noise and dies.
cat > "$W/.claude/state/STATUS.md" <<'MD'
## In-Flight
| Task | Agent | Module | Feature | Subtree | Started |
|------|-------|--------|---------|---------|---------|

## Other
MD
( cd "$W" && git add -A ) >/dev/null 2>&1
if ( cd "$W" && bash .claude/tools/staging-check/check-staged.sh ) >/dev/null 2>&1; then
  _record_pass "with nothing in flight, everything stages cleanly"
else
  _record_fail "blocked a commit while no dispatch was running"
fi

if pass_or_fail "R22"; then
  echo "R22 VERDICT: PASS"
  exit 0
else
  echo "R22 VERDICT: FAIL"
  exit 1
fi
