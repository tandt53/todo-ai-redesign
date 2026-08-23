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
PROJ_MD="$CLAUDE_ROOT/../CLAUDE.md"

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

# ── A request is not a task ────────────────────────────────────────────────
# The complaint that produced this: a request arrived, the orchestrator studied
# it and dispatched. No evaluation, no ordering against what was queued, no
# pushback. The only guidance in that region of the file was "Prefer Dispatching
# Agents", which taught exactly that, and tasks in this playbook were only ever
# created by the pipeline reacting to itself — from a PARTIAL return, a HIGH
# finding, a REJECT. Nothing described a request arriving from the owner at all.
assert_file_contains "$ORCH" 'When a request arrives' \
  "there is a step between a request and a task"
assert_file_contains "$ORCH" 'A request is not a task' \
  "intake states the distinction it exists to enforce"

intake="$(grep -n '^## When a request arrives' "$ORCH" | head -1 | cut -d: -f1)"
nextcmd="$(grep -n '^## When User Says' "$ORCH" | head -1 | cut -d: -f1)"
if [ -n "$intake" ] && [ -n "$nextcmd" ] && [ "$intake" -lt "$nextcmd" ]; then
  _record_pass "intake is defined before the queue-advancing command"
else
  _record_fail "intake comes after 'next' — the queue moves before anything is evaluated"
fi

# Intake must end in the owner, not in TASKS.md. Without this it becomes a
# checklist the orchestrator ticks on its way to the dispatch it already chose.
assert_file_contains "$ORCH" 'creates rows in `TASKS.md`' \
  "the owner's answer is what creates tasks, not the orchestrator's reading"
assert_file_contains "$ORCH" 'Until then nothing is dispatched' \
  "intake blocks dispatch rather than advising it"

# A threshold, or every typo costs a round trip and the step gets skipped whole.
assert_file_contains "$ORCH" 'it is the first kind' \
  "an ambiguous request defaults to being evaluated, not waved through"

# Priority needs something to judge against, and it is not the orchestrator's
# opinion. A bracketed placeholder must stop the run rather than be invented.
assert_file_contains "$ORCH" 'CLAUDE.md ## Project' \
  "intake reads the product statement before judging priority"
assert_file_contains "$ORCH" 'Stop and ask for it' \
  "an unanswered product line stops intake instead of being guessed"
for field in '**Is**' '**For**' '**Must**' '**Is not**' '**Succeeds when**'; do
  assert_file_contains "$PROJ_MD" "$field" "product statement has the field: $field"
done
assert_file_contains "$PROJ_MD" 'makes a request refusable' \
  "the product statement says why Is not is the load-bearing line"

# The two judgements that make this project management rather than a form.
assert_file_contains "$ORCH" 'What does it collide with' \
  "intake looks for queued work the request obsoletes"
assert_file_contains "$ORCH" 'What is it competing with' \
  "intake places the request against what is already pending"
assert_file_contains "$ORCH" 'you recommend and they confirm' \
  "priority is recommended by the orchestrator and decided by the owner"
assert_file_contains "$ORCH" 'smallest version' \
  "intake asks for the cheapest version that still delivers"

# Pushback, bounded. Absent, the orchestrator builds whatever it is handed;
# unbounded, it relitigates a decision the owner already made.
assert_file_contains "$ORCH" 'it is spent once' \
  "disagreement is stated, and stated once"
assert_file_contains "$ORCH" 'Repeating a rejected argument is not diligence' \
  "the bound on disagreement is stated, not left to judgement"

# The dispatch-preference section must defer to intake, or the two contradict and
# the reader follows whichever they reach first.
assert_file_contains "$ORCH" 'whether a request should become a task at all' \
  "the dispatch-preference section defers to intake instead of competing"

if pass_or_fail "R19"; then
  echo "R19 VERDICT: PASS"
  exit 0
else
  echo "R19 VERDICT: FAIL"
  exit 1
fi
