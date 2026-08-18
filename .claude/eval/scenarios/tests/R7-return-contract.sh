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
