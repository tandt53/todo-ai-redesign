#!/usr/bin/env bash
# R20 — the orchestrator takes stock when a feature closes.
#
# The defect: the queue was only ever read one row at a time. Selection takes the
# head of the PENDING list, so a row that stops being picked is never picked
# again and nothing says so. Measured on a real project at T-302: sixteen rows
# half-finished, four abandoned around 280 rows earlier (T-020/021/022 QA mobile,
# T-047 Gate 1), and three BLOCKED waiting on an owner who had not been told they
# were waiting — the oldest for 242 rows.
#
# Two properties matter more than the rest and are asserted separately because
# they die separately. The review must run BEFORE sign-off, or it documents a
# decision already taken. And it must END in the owner: a step that cancels
# pending work on its own is worse than no step, because the owner asked for that
# work and would not see it go.
#
# What this cannot pin: whether the summary is honest about its own scope. It
# counts rows in TASKS.md, and a row saying DONE does not say the feature works.
# The assertion below requires that limit to be stated; it cannot require that
# the orchestrator means it.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ORCH="$CLAUDE_ROOT/ORCHESTRATION.md"
LIB="$CLAUDE_ROOT/lib/tasks.sh"

echo "─── R20 — a feature does not close without taking stock ───"

assert_file_exists "$ORCH" "ORCHESTRATION.md present"
assert_file_contains "$ORCH" 'When a feature closes' "the feature-close review exists"

# Reachable from where the orchestrator already looks. A section nothing points
# at is the same as absent — this template has learned that repeatedly.
assert_file_contains "$ORCH" 'preceded by `## When a feature closes`' \
  "the pipeline table's sign-off row points at the review"

# Ordering: before sign-off, not after.
assert_file_contains "$ORCH" 'before you ask the owner to sign' \
  "the review runs before sign-off rather than documenting it"

# The four questions, each named. A review that lists three of them silently
# drops the class of drift the fourth was for.
assert_file_contains "$ORCH" 'still half-done' \
  "q1: half-finished rows inside the feature"
assert_file_contains "$ORCH" 'What did it leave behind' \
  "q2: follow-ups raised during the feature and still pending"
assert_file_contains "$ORCH" 'What did it make unnecessary' \
  "q3: pending rows the feature obsoleted"
assert_file_contains "$ORCH" 'What is the owner blocking' \
  "q4: BLOCKED rows, including ones outside this feature"

# The sign-off consequence. Without it q1 is a note rather than a gate.
assert_file_contains "$ORCH" 'signed off on a false claim' \
  "a PARTIAL row inside the feature blocks a clean sign-off"

# It ends in the owner. Cancelling requested work silently is the failure mode
# that would make this step worse than nothing.
assert_file_contains "$ORCH" 'the owner confirms' \
  "cancellation is recommended, not performed"
assert_file_contains "$ORCH" 'Nothing here edits `TASKS.md` on its own' \
  "the review writes no state"

# Ageing without a schema change. R9 holds four parsers to one column order, so
# a date column is not a small addition — ID distance costs nothing.
assert_file_contains "$ORCH" 'ID distance' \
  "age is derived from ID distance rather than a new column"
assert_file_contains "$LIB" 'tasks_get' "the shared reader exists to read rows through"
assert_file_contains "$ORCH" 'never re-derive column positions' \
  "the review reads through tasks.sh instead of hardcoding fields"

# Scope honesty. A queue count presented as project status is the self-assessment
# the two-layer metric design exists to avoid.
assert_file_contains "$ORCH" 'summarises the queue, not the project' \
  "the review states what it does not measure"
assert_file_contains "$ORCH" 'does not say the feature works' \
  "a DONE row is not evidence the feature works"

# The snippet has to be runnable, not illustrative. Extract it and parse it.
# Extract from inside the section, not from the first tasks.sh line in the file —
# Step 2 has one too, and anchoring on it drags in a hundred unrelated lines.
SNIP="$(mktemp)"
awk '/^## When a feature closes$/{s=1} s&&/^## Optional:/{exit} s&&/^```bash$/{f=1;next} f&&/^```$/{f=0} f{print}' "$ORCH" > "$SNIP"
if [ -s "$SNIP" ] && bash -n "$SNIP" 2>/dev/null; then
  _record_pass "the review's shell block parses"
else
  _record_fail "the review's shell block has a syntax error — it would abort at sign-off"
fi
rm -f "$SNIP"

if pass_or_fail "R20"; then
  echo "R20 VERDICT: PASS"
  exit 0
else
  echo "R20 VERDICT: FAIL"
  exit 1
fi
