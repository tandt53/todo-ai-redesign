#!/usr/bin/env bash
# R17 — a protocol that names an executor must be named in that executor's playbook.
#
# R6 checks one direction: a protocol no agent references is dead, because
# dispatch appends nothing. This is the OTHER direction, and nothing checked it.
#
# `_memory-protocol.md` specifies five read layers in detail, every agent file
# names it, and every agent runs its startup reads. Four of those five layers read
# from `.claude/memory/`. The write half is one sentence — "the write goes through the
# orchestrator" — and ORCHESTRATION.md mentioned memory nowhere. So the sole
# writer was never told it was the writer: agents kept returning `memory_entry:`
# fields, the orchestrator had no step that read them, and `.claude/memory/` did not exist
# after ~140 dispatches in a real project. Every read returned empty, forever,
# which is what teaches an agent to stop reading.
#
# Nothing failed. The reads are guarded (`2>/dev/null || echo "No memory yet"`),
# so an empty memory directory is indistinguishable from a young project.
#
# The general rule this enforces: **a responsibility stated in one file and
# absent from the file that would execute it is not a responsibility.** It is the
# same shape as the impact gap R15 now covers — named in a protocol, executed by
# nobody.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
PROJECT_ROOT="$(cd "$CLAUDE_ROOT/.." && pwd)"
AGENTS="$CLAUDE_ROOT/agents"
ORCH="$CLAUDE_ROOT/ORCHESTRATION.md"
MANIFEST="$PROJECT_ROOT/MANIFEST.md"

echo "─── R17 — every protocol's executor half has an executor ───"

assert_file_exists "$ORCH" "ORCHESTRATION.md present"

# --- the general rule, applied to every protocol that delegates a write ---
#
# A protocol that says its write "goes through the orchestrator" is naming an
# executor. The executor's playbook has to mention that protocol's artifact, or
# the sentence is decoration.
# The pattern tolerates markdown emphasis: the sentence in _memory-protocol.md
# reads "goes through the **orchestrator**", and a literal-space pattern matched
# nothing — which made this loop PASS by examining zero protocols. A sweep that
# passes because its filter matched nothing is the vacuous green this repo has
# now caught four times, so the count is asserted below rather than assumed.
DELEGATES=0
orphaned=""
for proto in "$AGENTS"/_*.md; do
  [ -f "$proto" ] || continue
  grep -qiE 'through the \*{0,2}orchestrator' "$proto" || continue
  DELEGATES=$((DELEGATES + 1))
  base="$(basename "$proto" .md)"          # e.g. _memory-protocol
  keyword="${base#_}"; keyword="${keyword%%-protocol}"   # e.g. memory
  grep -qi "$keyword" "$ORCH" || orphaned="${orphaned}${base}(no '${keyword}' in ORCHESTRATION.md) "
done

# Non-vacuity: at least one protocol must delegate, or the loop above proved
# nothing and would keep proving nothing after someone rewrote the sentence.
[ "$DELEGATES" -gt 0 ] \
  && _record_pass "the delegation sweep examined ${DELEGATES} protocol(s) — not a vacuous pass" \
  || _record_fail "no protocol matched the delegation pattern — the sweep below checked nothing"

[ -z "$orphaned" ] \
  && _record_pass "every protocol delegating a write to the orchestrator is named in its playbook" \
  || _record_fail "protocol(s) whose executor was never told: ${orphaned}"

# --- the memory protocol specifically: read side, write side, and the paths ---
PROTO="$AGENTS/_memory-protocol.md"
assert_file_exists "$PROTO" "_memory-protocol.md present"
if [ -f "$PROTO" ]; then
  if grep -qiE 'through the \*{0,2}orchestrator' "$PROTO"; then
    _record_pass "the memory protocol delegates the write to the orchestrator"
  else
    _record_fail "the memory protocol no longer names the orchestrator as its writer"
  fi
fi

# The two return fields are the whole interface between agent and writer. If the
# playbook does not name them, the fields arrive and are dropped.
assert_file_contains "$ORCH" 'memory_entry' \
  "ORCHESTRATION names the project-wide return field it must record"
assert_file_contains "$ORCH" 'agent_memory_entry' \
  "ORCHESTRATION names the per-agent return field it must record"
assert_file_contains "$ORCH" 'sole writer of `.claude/memory/`' \
  "ORCHESTRATION states the orchestrator owns .claude/memory/, as it owns the Links block"

# An absent directory must not read as "young project". This is the sentence that
# stops the failure recurring, so it is asserted rather than assumed.
assert_file_contains "$ORCH" 'Create the file if it does not exist' \
  "ORCHESTRATION tells the writer to create the file rather than skip"

# --- a return field nobody consumes is the same defect, one shape over ---
#
# The memory case above is one instance of a general failure: an agent is told to
# produce something, and no reader is named. It has now happened three times in
# this template — memory_entry, agent_memory_entry, and review_guide, which
# design-agent produces while its own file calls the human "the only real taste
# gate in this pipeline". Nothing read it.
#
# These are the fields where the AGENT produces and the ORCHESTRATOR is the
# consumer. A field listed here and absent from the playbook is written into a
# return and dropped on the floor.
for field in memory_entry agent_memory_entry links_to_record review_guide; do
  if grep -q "$field" "$ORCH"; then
    _record_pass "ORCHESTRATION consumes the return field ${field}"
  else
    _record_fail "no step reads ${field} — agents produce it and it is dropped"
  fi
done

# The taste gate specifically: it must block, and silence must not read as yes.
assert_file_contains "$ORCH" 'design_signoff' "ORCHESTRATION reads the design sign-off switch"
assert_file_contains "$ORCH" 'No implementer is dispatched until this returns' \
  "the owner's design review blocks implementation rather than trailing it"
# Single-line anchor: the sentence wraps, and 'is not an answer' lands alone on
# the next line. Three assertions in this session matched nothing for exactly
# that reason — write them against how the prose wraps, not how it reads.
assert_file_contains "$ORCH" 'Do not infer approval from silence' \
  "silence may not be read as the owner approving a design"
assert_file_contains "$MANIFEST" 'design_signoff' "MANIFEST declares design_signoff"

# --- paths resolve, or agents look in a place MANIFEST never declared ---
#
# ANCHORED, and the anchoring is not pedantry: an unanchored `memory_agent:`
# still matches `disabled_memory_agent:`, so the first version of this check
# passed against a MANIFEST with the key renamed out of existence. The mutation
# sweep is what found it. A substring match on a YAML key tests almost nothing —
# the key is only declared if it is the key.
for key in memory memory_log memory_agent; do
  if grep -qE "^[[:space:]]*${key}:" "$MANIFEST"; then
    _record_pass "MANIFEST declares ${key}:"
  else
    _record_fail "MANIFEST no longer declares ${key}: — the read layers resolve to nothing"
  fi
done

if pass_or_fail "R17"; then
  echo "R17 VERDICT: PASS"
  exit 0
else
  echo "R17 VERDICT: FAIL"
  exit 1
fi
