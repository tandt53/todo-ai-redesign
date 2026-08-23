#!/usr/bin/env bash
# R19 — the orchestrator is told what not to dispatch, and what not to put in a
# briefing.
#
# The defect: ORCHESTRATION.md described how to dispatch and never once said
# whether to. Every phase in its pipeline table is a dispatch, so the default
# answer to any question was a full agent run. Measured on todo-ai-redesign over
# one day: an agent asked for four colour options ran 25 minutes and wrote zero
# bytes, the owner redid the work by hand in two; briefings carrying scope
# nobody requested got that scope built and then removed; and declarations
# written from memory rather than read cost eight re-dispatches across three
# items — three rounds on a checkbox, two on a time column, three on a keyboard.
#
# All three are the dispatcher's, and none of them are visible to any agent: an
# agent handed a bloated briefing does the bloated task correctly.
#
# What this cannot pin is whether a given dispatch was worth making. It pins
# that the question is asked before the briefing is written, and that the three
# named failure modes stay named.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ORCH="$CLAUDE_ROOT/ORCHESTRATION.md"

echo "─── R19 — the orchestrator has dispatch discipline ───"

assert_file_exists "$ORCH" "ORCHESTRATION.md present"

# ── The gate before the briefing ───────────────────────────────────────────
# It has to come BEFORE the briefing step. A rule met while writing a briefing
# has already lost — the decision to dispatch was taken when the step began.
assert_file_contains "$ORCH" 'Is this a dispatch at all?' \
  "a step asks whether to dispatch before asking how"

step_gate="$(grep -n 'Is this a dispatch at all?' "$ORCH" | head -1 | cut -d: -f1)"
step_brief="$(grep -n '^### Step 3: Write the briefing' "$ORCH" | head -1 | cut -d: -f1)"
if [ -n "$step_gate" ] && [ -n "$step_brief" ] && [ "$step_gate" -lt "$step_brief" ]; then
  _record_pass "the dispatch gate precedes the briefing step"
else
  _record_fail "the gate is at or after the briefing step — the decision was already taken"
fi

# The refusal must name the shapes, or it reads as advice. A list, a comparison
# and a set of options are the three that look like work and produce none.
assert_file_contains "$ORCH" 'do not dispatch it' \
  "the gate refuses, rather than suggesting"
for shape in 'a list, a comparison, a set of options'; do
  assert_file_contains "$ORCH" "$shape" "the refused shapes are named"
done

# The artifact question is what makes the gate decidable.
assert_file_contains "$ORCH" 'name the artifact' \
  "the gate is decided by naming what lands on disk, not by judgement"

# ── Declarations are read, not remembered ──────────────────────────────────
# The most expensive mistake available to a dispatcher: the agent builds against
# the wrong claim and the cost is paid in whole re-dispatches, not in one edit.
assert_file_contains "$ORCH" 'must be one you just read' \
  "every factual claim in a briefing must have just been read"
assert_file_contains "$ORCH" 'Open the file and confirm before you write the line' \
  "the rule states the action, not only the principle"

# ── Briefing bloat is added scope, not length ──────────────────────────────
# A line budget measures the wrong thing: a short briefing that quietly adds a
# feature costs more than a long one that does not.
assert_file_contains "$ORCH" 'carries the task, not your understanding of it' \
  "the briefing rule targets content rather than length"
for bloat in 'Context the agent will read anyway' 'Your reasoning' 'Scope you added'; do
  assert_file_contains "$ORCH" "$bloat" "named bloat source: $bloat"
done

# The marker is what makes added scope cheap to revert — one line of the return
# tells the owner what to remove.
assert_file_contains "$ORCH" 'Not asked for — my call:' \
  "scope the owner did not request is marked, not silently included"

# The test has to be executable by the orchestrator on its own briefing.
assert_file_contains "$ORCH" 'read the briefing back' \
  "the rule ends in a check the dispatcher can actually run"

# No line budget. It was tried, the numbers were invented, and a count of lines
# certifies a briefing that adds a feature in few words.
if grep -qE 'Length budget: [0-9]+ lines' "$ORCH"; then
  _record_fail "a line budget is back — it measures length, not the scope that costs"
else
  _record_pass "no invented line budget on briefings"
fi

if pass_or_fail "R19"; then
  echo "R19 VERDICT: PASS"
  exit 0
else
  echo "R19 VERDICT: FAIL"
  exit 1
fi
