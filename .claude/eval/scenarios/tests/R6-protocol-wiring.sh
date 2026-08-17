#!/usr/bin/env bash
# R6 — Every shared protocol is reachable from at least one agent in one hop.
#
# The orchestrator dispatches by passing the agent file's content + BRIEFING as
# the prompt. Nothing appends the protocols automatically. So a protocol that no
# agent file names is dead weight: the agent never reads it, never follows it,
# and no error is raised — the dispatch just silently loses that discipline.
#
# This was a real failure: _ethos, _startup-protocol, _memory-protocol,
# _self-improvement-protocol and _stack-detection were referenced by ZERO of the
# 12 agents. The `---METRICS---` return block was defined only inside
# _startup-protocol.md, so no agent ever emitted it and the Layer-1 dashboard
# recorded every dispatch as status: unknown.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
AGENTS_DIR="$CLAUDE_ROOT/agents"

echo "─── R6 — protocols are reachable from agent files ───"

# Protocols every single agent must name directly.
UNIVERSAL=(_ethos.md _completion-protocol.md)
# Protocols required only for a role.
IMPLEMENTERS=(web-agent mobile-agent backend-agent)

AGENT_FILES=$(find "$AGENTS_DIR" -maxdepth 1 -name '*-agent.md' | sort)

for proto in "${UNIVERSAL[@]}"; do
  missing=""
  for f in $AGENT_FILES; do
    grep -q "$proto" "$f" || missing="${missing}$(basename "$f" .md) "
  done
  if [ -z "$missing" ]; then
    _record_pass "every agent references ${proto}"
  else
    _record_fail "${proto} not referenced by: ${missing}"
  fi
done

for impl in "${IMPLEMENTERS[@]}"; do
  assert_file_contains "$AGENTS_DIR/${impl}.md" "_stack-detection.md" \
    "${impl} references _stack-detection.md"
done

for qa in qa-api-agent qa-web-agent qa-mobile-agent; do
  assert_file_contains "$AGENTS_DIR/${qa}.md" "_qa-foundations.md" \
    "${qa} references _qa-foundations.md"
done

# No protocol may be orphaned. "Referenced by another protocol" does NOT count:
# a protocol only reachable from a second protocol that no agent reads is still
# dead at dispatch time. The referrer must be an agent file (the thing actually
# passed as the prompt) or ORCHESTRATION.md (which the orchestrator itself reads).
#
# This is the check that catches the subtle case: _startup-protocol.md was named
# only by _qa-workspace-protocol.md, so a naive "is anyone pointing at it" test
# went green while zero agents could ever reach it.
while IFS= read -r proto; do
  base="$(basename "$proto")"
  agent_refs=$(grep -l "$base" "$AGENTS_DIR"/*-agent.md 2>/dev/null | wc -l | tr -d ' ')
  orch_ref=0
  grep -q "$base" "$CLAUDE_ROOT/ORCHESTRATION.md" 2>/dev/null && orch_ref=1
  if [ "$agent_refs" -gt 0 ]; then
    _record_pass "${base} reachable from ${agent_refs} agent file(s)"
  elif [ "$orch_ref" -eq 1 ]; then
    _record_pass "${base} reachable from ORCHESTRATION.md (orchestrator-owned)"
  else
    _record_fail "${base} is UNREACHABLE at dispatch — named by no agent file and not by ORCHESTRATION.md"
  fi
done < <(find "$AGENTS_DIR" -maxdepth 1 -name '_*.md' | sort)

# LEARNINGS.md is a documented cross-session loop: reviewer-agent appends to it
# and every agent is supposed to skim it. That only happens if agents say so.
for f in "$AGENTS_DIR"/*-agent.md; do
  b="$(basename "$f" .md)"
  if grep -q 'LEARNINGS' "$f"; then
    _record_pass "${b} knows about LEARNINGS.md"
  else
    _record_fail "${b} never mentions LEARNINGS.md — the cross-feature lesson loop is broken for it"
  fi
done

if pass_or_fail "R6"; then
  echo "R6 VERDICT: PASS"
  exit 0
else
  echo "R6 VERDICT: FAIL"
  exit 1
fi
