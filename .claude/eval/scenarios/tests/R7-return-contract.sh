#!/usr/bin/env bash
# R7 — One return contract, agreed on by the agents, the orchestrator, and the hook.
#
# Three parties must agree or metrics silently break:
#   1. agents            — must emit the ---METRICS--- block
#   2. ORCHESTRATION.md  — routes on `status:` from that block
#   3. capture-agent-metrics.cjs — parses the block's fields
#
# The failure this guards against: the contract was defined in one file that no
# agent read, ORCHESTRATION branched on a "Status field" that 10 of 12 agents
# never emitted, and the vocabularies disagreed (DONE-with-followup vs PARTIAL,
# STRUCTURAL-PASS vs APPROVE).

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
AGENTS_DIR="$CLAUDE_ROOT/agents"
CONTRACT="$AGENTS_DIR/_completion-protocol.md"
HOOK="$CLAUDE_ROOT/hooks/capture-agent-metrics.cjs"

echo "─── R7 — return contract agreed across agents / orchestrator / hook ───"

assert_file_exists "$CONTRACT" "_completion-protocol.md present"
assert_file_contains "$CONTRACT" '---METRICS---' "contract defines the ---METRICS--- block"

# Exactly one PROTOCOL file may define the contract. Agent files are expected to
# reference the block (and may extend it with role-specific fields); a second
# _protocol.md defining its own return shape is how the two formats drifted
# apart last time.
# A *definition* is the delimiter immediately followed by a `status:` line —
# i.e. a worked example of the block. A prose *reference* ("see the
# ---METRICS--- block in _completion-protocol.md") is fine and expected.
definers=""
for pf in "$AGENTS_DIR"/_*.md; do
  case "$(basename "$pf")" in _completion-protocol.md) continue ;; esac
  if awk '/^---METRICS---$/{getline; if ($0 ~ /^status:/) found=1} END{exit !found}' "$pf"; then
    definers="${definers}$(basename "$pf") "
  fi
done
if [ -z "$definers" ]; then
  _record_pass "only _completion-protocol.md defines the return block"
else
  _record_fail "competing return-format definition in protocol file(s): ${definers}"
fi

# Every agent must bind itself to the block AT ITS RETURN SECTION.
#
# A passing mention elsewhere is not enough. The `## Required reads` table names
# _completion-protocol.md and so contains the literal `---METRICS---` — an
# earlier version of this check accepted that and went green while the actual
# binding at the return site was missing from all 12 agents.
for f in "$AGENTS_DIR"/*-agent.md; do
  b="$(basename "$f" .md)"
  start=$(grep -niE '^## (returning to the orchestrator|return summary format)' "$f" | head -1 | cut -d: -f1)
  if [ -z "$start" ]; then
    _record_fail "${b} has no return section at all"
    continue
  fi
  if tail -n +"$start" "$f" | head -20 | grep -q 'Your return MUST end with'; then
    _record_pass "${b} binds the ---METRICS--- block at its return section"
  else
    _record_fail "${b} return section does not require the ---METRICS--- block"
  fi
done

# The orchestrator must route on status: from the block, not on prose.
# --- the head of a return, and the report it becomes ---
#
# The return is read twice: the orchestrator acts on it, and a human reads the
# report the orchestrator writes from it. A return that buries its answer
# produces a report that buries it too, so the shape is fixed at the source
# rather than repaired downstream.
#
# SELF-DECIDED is the line agents skip and owners need: a call surfaced in a
# return costs one revision, the same call found after implementation costs a
# rebuild.
assert_file_contains "$CONTRACT" 'SELF-DECIDED' \
  "contract requires agents to declare the calls no source answered"
assert_file_contains "$CONTRACT" 'NEEDS-OWNER' \
  "contract requires agents to name what only a human can decide"
assert_file_contains "$CONTRACT" 'could NOT check' \
  "the verdict line must carry the gap, not only the pass"
assert_file_contains "$CONTRACT" 'Common practice' \
  "a decision handed to the owner carries what comparable products do"
assert_file_contains "$CONTRACT" 'never travels alone' \
  "every id reaching the owner carries plain words, on every line not just the subject"
assert_file_contains "$CONTRACT" 'Never an id alone' \
  "the head opens with the work in plain words, not a bare feature id"
assert_file_contains "$CONTRACT" 'the RESULT, not the activity' \
  "the verdict reports what came back, not what was read"
assert_file_contains "$CONTRACT" 'a number rather than a feeling' \
  "the head carries a countable line budget, not a qualitative one"
assert_file_contains "$CONTRACT" 'Interesting is not a zone' \
  "nothing outside the named zones reaches the head"
assert_file_contains "$CONTRACT" 'the case, not the category' \
  "explanations name what happened, not the class of problem"
assert_file_contains "$CONTRACT" 'a label, not a sentence' \
  "zone labels may not become narrative headings"
assert_file_contains "$CONTRACT" 'One fact per line' \
  "zones are lines, not paragraphs — a wall of text is unreadable in a terminal"
assert_file_contains "$CONTRACT" 'Bare numbers are not a measurement' \
  "unlabelled figures are dropped rather than printed"
assert_file_contains "$CONTRACT" 'Not internal procedure' \
  "SELF-DECIDED is for calls the owner could overturn, not lens etiquette"
assert_file_contains "$CONTRACT" 'One line means one line' \
  "each head entry is one line — the shape without a length cap produced paragraphs"
assert_file_contains "$CONTRACT" 'not a defence' \
  "a self-decided call gets a line, not the brief reserved for owner decisions"
assert_file_contains "$CONTRACT" 'Never ask cold' \
  "the brief precedes the question rather than hiding in the options"
assert_file_contains "$CONTRACT" 'expand every code the first time' \
  "internal vocabulary is expanded before it reaches the owner"
assert_file_contains "$CONTRACT" 'Do not bundle unrelated decisions' \
  "the contract forbids bundling unrelated decisions into one question"

ORCH_F="$CLAUDE_ROOT/ORCHESTRATION.md"
assert_file_contains "$ORCH_F" 'does this change what the owner does next' \
  "the report filter is stated: relevance to the next action, not completeness"
assert_file_contains "$ORCH_F" 'one at a time' \
  "decisions are put to the owner singly, not bundled"
assert_file_contains "$ORCH_F" 'wearing the agent' \
  "the orchestrator may not substitute its own reasoning for the agent's analysis"

assert_file_contains "$CLAUDE_ROOT/ORCHESTRATION.md" '---METRICS---' \
  "ORCHESTRATION.md routes on the ---METRICS--- block"

# Vocabulary agreement: every status the contract allows must be one the hook
# recognises in its fallback regex, and vice versa.
if [ -f "$HOOK" ]; then
  hook_vocab=$(grep -oE '\(DONE\|BLOCKED\|PARTIAL\|ERROR\|APPROVE\|REJECT\)' "$HOOK" | head -1)
  if [ -n "$hook_vocab" ]; then
    for v in DONE PARTIAL BLOCKED APPROVE REJECT; do
      if printf '%s' "$hook_vocab" | grep -q "$v"; then
        _record_pass "hook accepts status: ${v}"
      else
        _record_fail "contract allows status: ${v} but the hook does not parse it"
      fi
    done
  else
    _record_fail "could not find the hook's status vocabulary — did capture-agent-metrics.cjs change shape?"
  fi
else
  _record_fail "capture-agent-metrics.cjs missing — Layer-1 metrics cannot be captured"
fi

# The retired value must not come back as a usable status. The contract is
# allowed to name it once in order to retire it ("There is no DONE-with-followup").
assert_grep_zero '(status:|Status:|\|) *DONE-with-followup' \
  "retired status 'DONE-with-followup' is not offered as a value" "$AGENTS_DIR" "$CLAUDE_ROOT/ORCHESTRATION.md"

# Every field the hook parses must be documented in the contract, or agents will
# omit it and the dashboard column stays empty.
for field in status confidence files_created files_modified tests_passing tests_total acs_covered blockers bugs_filed; do
  assert_file_contains "$CONTRACT" "${field}" "contract documents metrics field: ${field}"
done

if pass_or_fail "R7"; then
  echo "R7 VERDICT: PASS"
  exit 0
else
  echo "R7 VERDICT: FAIL"
  exit 1
fi
