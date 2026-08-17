#!/usr/bin/env bash
# R10 — Nothing in the template asks parallel agents to write the same thing.
#
# The pipeline dispatches agents concurrently: 2 in the architecture phase, 6 in
# the implementation phase. The orchestrator's only overlap guard covers
# `{src}/{module}/` subtrees. Anything else that multiple agents are told to write
# — or to read from a single-slot file — is a race the template creates itself.
#
# Both cases below were found by dispatching the real agents:
#   - Seven agents were granted append rights on the feature spec's one `## Links`
#     YAML block. architect-agent and design-agent independently spotted the hazard
#     and both declined to write, so every Links field stayed empty and
#     reviewer-agent's C1 failed.
#   - Every agent was told to "Read BRIEFING.md (always first)" while the
#     orchestrator overwrites that single file per dispatch. qa-explorer-agent
#     reported that the on-disk file held another agent's task and that following
#     the protocol literally would have run the wrong work.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
AGENTS_DIR="$CLAUDE_ROOT/agents"
ORCH="$CLAUDE_ROOT/ORCHESTRATION.md"

echo "─── R10 — no concurrent-write hazards in the dispatch contract ───"

# Fail loudly if the agent glob is empty. Loop-based checks below would otherwise
# report PASS on zero files — a green run that proves nothing.
agent_count=$(find "$AGENTS_DIR" -maxdepth 1 -name '*-agent.md' 2>/dev/null | wc -l | tr -d ' ')
if [ "$agent_count" -lt 1 ]; then
  _record_fail "no agent files found at ${AGENTS_DIR} — path resolution is broken, every check below would false-pass"
  pass_or_fail "R10" || true
  echo "R10 VERDICT: FAIL"
  exit 1
fi
_record_pass "found ${agent_count} agent files to check"

# --- A. The feature spec's ## Links block has exactly one writer ---

# No agent file may instruct the agent to write/append/update the Links block.
offenders=""
for f in "$AGENTS_DIR"/*-agent.md; do
  b="$(basename "$f" .md)"
  if grep -qiE '(append|write|update|edit)[^.]{0,40}(to )?(the )?`?## Links' "$f"; then
    offenders="${offenders}${b} "
  fi
done
if [ -z "$offenders" ]; then
  _record_pass "no agent is told to write the feature spec's ## Links block"
else
  _record_fail "agent(s) instructed to write ## Links directly: ${offenders}— the orchestrator owns that block"
fi

# The contract must name the reporting mechanism that replaces writing.
assert_file_contains "$AGENTS_DIR/_completion-protocol.md" 'links_to_record' \
  "completion protocol defines links_to_record: (agents report, orchestrator writes)"
assert_file_contains "$AGENTS_DIR/_completion-protocol.md" 'No sub-agent writes the feature spec' \
  "completion protocol states no sub-agent writes ## Links"

# And the orchestrator must actually be told to do the writing.
assert_file_contains "$ORCH" 'links_to_record' \
  "ORCHESTRATION records links_to_record into the spec"

# --- B. The briefing reaches agents inline, not via a shared single-slot file ---

stale=""
for f in "$AGENTS_DIR"/*-agent.md; do
  b="$(basename "$f" .md)"
  # The old form told the agent the on-disk file is authoritative.
  if grep -qE 'Read BRIEFING\.md \(always first\)' "$f"; then
    stale="${stale}${b} "
  fi
done
if [ -z "$stale" ]; then
  _record_pass "no agent treats the on-disk BRIEFING.md as its task contract"
else
  _record_fail "agent(s) still told to read BRIEFING.md as the contract: ${stale}— parallel dispatch makes that file unreliable"
fi

inline=0
for f in "$AGENTS_DIR"/*-agent.md; do
  grep -q 'inlined at the end of this prompt' "$f" && inline=$((inline + 1))
done
total=$(find "$AGENTS_DIR" -maxdepth 1 -name '*-agent.md' | wc -l | tr -d ' ')
if [ "$inline" -eq "$total" ]; then
  _record_pass "all ${total} agents take the inlined briefing as their contract"
else
  _record_fail "only ${inline}/${total} agents name the inlined briefing as their contract"
fi

# The orchestrator must still concatenate the briefing into the prompt.
assert_file_contains "$ORCH" 'BRIEFING_CONTENT' \
  "ORCHESTRATION concatenates the briefing into the dispatch prompt"

if pass_or_fail "R10"; then
  echo "R10 VERDICT: PASS"
  exit 0
else
  echo "R10 VERDICT: FAIL"
  exit 1
fi
