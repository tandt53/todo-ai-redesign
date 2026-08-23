#!/usr/bin/env bash
# R18 — The orchestrator is told how to talk to the person, and where.
#
# The defect: ORCHESTRATION.md ended two of its routing paths with the bare line
# "Report to user". No format, no length, no statement of who reads it. The
# orchestrator's working vocabulary is dispatch — task ids, gate codes, agent
# names, phase labels — so with nothing said, every report came out as a
# narration of the machinery. The person asked for a feature and got a list of
# which agents ran.
#
# The rules for this already existed. They lived in the maintainer's personal
# session config and reached the template not at all: the same shape as every
# other gap here, a rule written once and wired nowhere.
#
# What this pins is the wiring and the parts of the contract that are checkable.
# The quality of a sentence is not: the orchestrator's message is not a file, so
# nothing greps it. This scenario keeps the contract reachable and specific; a
# human reading a bad report is still the detector of last resort.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
PROTO="$CLAUDE_ROOT/agents/_communication.md"
ORCH="$CLAUDE_ROOT/ORCHESTRATION.md"

echo "─── R18 — the orchestrator has a communication contract ───"

assert_file_exists "$PROTO" "_communication.md present"

# Reachability. Dispatch appends nothing, so a protocol nobody names is dead —
# R6 enforces that generally; here we require the specific referrer that matters.
assert_file_contains "$ORCH" '_communication.md' "ORCHESTRATION references the contract"

# It has to be named before the reporting step, not only inside it. A rule the
# orchestrator meets at step 13 has already lost to the habit it is correcting.
first_ref="$(grep -n '_communication.md' "$ORCH" | head -1 | cut -d: -f1)"
first_report="$(grep -n 'Report to the person\|Report to user' "$ORCH" | head -1 | cut -d: -f1)"
if [ -n "$first_ref" ] && [ -n "$first_report" ] && [ "$first_ref" -lt "$first_report" ]; then
  _record_pass "the contract is named before the first reporting step"
else
  _record_fail "the contract appears only at the reporting step, too late to shape the habit"
fi

# The bare instruction must be gone. It is what produced the complaint.
if grep -qE '^\s*[0-9]+\.\s+Report to user\s*$' "$ORCH"; then
  _record_fail "ORCHESTRATION still ends a path with a bare 'Report to user'"
else
  _record_pass "no bare 'Report to user' instruction remains"
fi

# ── The contract's own content ─────────────────────────────────────────────
# Audience is the parameter the rules are written against; without cards the
# document is a style guide and applies to nobody in particular.
for card in 'orchestrator → the person' 'agent → orchestrator' 'reviewer →'; do
  if grep -qF "$card" "$PROTO"; then
    _record_pass "audience card present: $card"
  else
    _record_fail "no audience card for: $card"
  fi
done

# The file's stated reach must match its actual reach. Dispatch appends nothing,
# so a protocol reaches an agent only when that agent's Required reads names it.
# A title promising "every agent" while zero agents name it is a claim the wiring
# does not keep — and R6 will not catch it, because ORCHESTRATION.md counts as a
# referrer. Checked in both directions so neither half can drift alone.
agent_refs="$(grep -l '_communication.md' "$CLAUDE_ROOT"/agents/*-agent.md 2>/dev/null | wc -l | tr -d ' ')"
claims_orchestrator_only="$(grep -c 'Only the orchestrator reads this' "$PROTO")"
if [ "$agent_refs" -eq 0 ] && [ "$claims_orchestrator_only" -ge 1 ]; then
  _record_pass "no agent reads it, and the file says so"
elif [ "$agent_refs" -gt 0 ] && [ "$claims_orchestrator_only" -eq 0 ]; then
  _record_pass "$agent_refs agent file(s) name it, and the file makes no orchestrator-only claim"
elif [ "$agent_refs" -eq 0 ]; then
  _record_fail "no agent names this file, but it does not say so — it claims a reach dispatch will not give it"
else
  _record_fail "$agent_refs agent file(s) name it while the file still says only the orchestrator reads it"
fi

# The reviewer card must point at the file that actually holds the report shape.
# It pointed at _review-protocol.md, which is the Gate 1 / Gate 1.5 lens contract
# and defines no report shape — a pointer that sends the reader somewhere real,
# and wrong, which is worse than a broken link because nothing errors.
assert_file_contains "$PROTO" 'reviewer-agent.md ## Output' \
  "the reviewer card points at the file that defines the report shape"

# The two rules the owner asked for by name.
assert_file_contains "$PROTO" 'never travels alone' \
  "ids reaching the person carry a plain-words gloss"

# The gloss is the requirement, not removal. An id is the shortest way for the
# person to point back at something — "revert F-006" beats a sentence describing
# which feature they meant. A contract that strips ids takes that handle away and
# makes every follow-up a paragraph.
assert_file_contains "$PROTO" 'not to remove ids' \
  "the contract keeps ids rather than stripping them"

# The worked example has to show an id surviving into the sentence, or the rule
# reads as advice while the table teaches the opposite.
if grep -qF '(T-042)' "$PROTO"; then
  _record_pass "the example keeps the id alongside its gloss"
else
  _record_fail "no example shows an id kept — the table teaches removal"
fi
assert_file_contains "$PROTO" 'Depth on demand' \
  "the simplest true explanation leads; detail comes when asked"

# Result over activity — the rule that separates a report from a work log.
assert_file_contains "$PROTO" 'Report the result, not the activity' \
  "the contract distinguishes outcome from effort"

# A budget stated as a number. "Keep it short" is not enforceable by a reader
# either, and this template has already learned what an unmeasured cap is worth.
if grep -qE '\| Budget \| [0-9]+ lines' "$PROTO"; then
  _record_pass "the owner card states its budget as a number"
else
  _record_fail "the budget is prose — an unmeasured cap gets interpreted generously"
fi

# One table, not two. Two tables of the same shape teaching opposite habits —
# one keeping the code, one dropping it — read as contradictory direction, and
# the reader picks whichever they saw last. The reason has to sit in the row.
if [ "$(grep -c '^| Raw | To the person | The code |' "$PROTO")" -eq 1 ]; then
  _record_pass "codes are handled in one table with the reason per row"
else
  _record_fail "the code guidance is split across tables again — the rule becomes invisible"
fi

# The deciding question, stated. Without it the table is a list to memorise and
# says nothing about a code that is not on it.
assert_file_contains "$PROTO" 'would they ever say it back to you' \
  "the table states the test that decides an unlisted code"

# The translate table is the part that does the work: it names the specific
# strings that leak, next to what to say instead.
for leak in 'C5 PASS' 'status: PARTIAL' 'phase: author'; do
  if grep -qF "$leak" "$PROTO"; then
    _record_pass "translation given for a leaking term: $leak"
  else
    _record_fail "no translation for a term known to leak: $leak"
  fi
done

# Agents keep ids bare — rule 2 is about the reader's vocabulary, not a ban on
# identifiers. If this inverts, the envelope grows prose and the router breaks.
assert_file_contains "$PROTO" '_completion-protocol.md' \
  "the agent card defers to the envelope rather than redefining it"

if pass_or_fail "R18"; then
  echo "R18 VERDICT: PASS"
  exit 0
else
  echo "R18 VERDICT: FAIL"
  exit 1
fi
