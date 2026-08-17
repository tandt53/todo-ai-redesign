#!/usr/bin/env bash
# R3 — Every shared protocol file referenced from a prompt actually exists.
#
# Agents are told to "Read agents/_qa-foundations.md" as a hard step in their
# startup protocol. If a protocol is renamed and a caller is missed, the agent
# reads nothing, silently loses that protocol, and no error is ever raised —
# the dispatch just produces lower-quality output. This is the cheapest
# possible guard against that failure mode.
#
# Real example this was written for: ORCHESTRATION.md referenced
# `_agent-comms.md` while the file on disk was `_agent-comms-template.md`.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
AGENTS_DIR="$CLAUDE_ROOT/agents"

echo "─── R3 — protocol references resolve to files on disk ───"

# The 9 protocols this template ships.
EXPECTED_PROTOCOLS=(
  _ethos _startup-protocol _completion-protocol _memory-protocol
  _qa-foundations _self-improvement-protocol _stack-detection
  _agent-comms-template _qa-workspace-protocol
)

for p in "${EXPECTED_PROTOCOLS[@]}"; do
  assert_file_exists "$AGENTS_DIR/${p}.md" "protocol present: ${p}.md"
done

# Any `_foo.md` token mentioned in a prompt must resolve under agents/.
SEARCH_FILES=("$AGENTS_DIR"/*.md "$CLAUDE_ROOT/ORCHESTRATION.md")
[ -f "$CLAUDE_ROOT/README.md" ] && SEARCH_FILES+=("$CLAUDE_ROOT/README.md")

UNRESOLVED=""
while IFS= read -r ref; do
  [ -z "$ref" ] && continue
  [ -f "$AGENTS_DIR/$ref" ] && continue
  UNRESOLVED="${UNRESOLVED}${ref} "
done < <(grep -rhoE '_[a-z][a-z0-9-]*\.md' "${SEARCH_FILES[@]}" 2>/dev/null | sort -u)

if [ -z "$UNRESOLVED" ]; then
  _record_pass "every _protocol.md reference resolves under agents/"
else
  for u in $UNRESOLVED; do
    hit=$(grep -rEnH "$u" "${SEARCH_FILES[@]}" 2>/dev/null | head -1)
    _record_fail "unresolved protocol reference '${u}' (first hit: ${hit})"
  done
fi

# Every QA agent must require _qa-foundations.md — that is the whole point of
# having a shared QA protocol.
for qa in qa-api-agent qa-web-agent qa-mobile-agent; do
  assert_file_contains "$AGENTS_DIR/${qa}.md" "_qa-foundations.md" \
    "${qa} requires _qa-foundations.md"
done


# Protocol references must be resolvable FROM THE PROJECT ROOT, which is where a
# dispatched agent's cwd is. The files live at `.claude/agents/`, so a bare
# `agents/_ethos.md` is a path that does not exist — every agent then has to
# guess. This was real: all 12 agent files shipped the bare form, and an agent
# reported it back as a defect during a live eval.
bare=$(grep -rhoE '(^|[^./[:alnum:]])agents/_[a-z0-9-]+\.md' "$AGENTS_DIR"/*.md "$CLAUDE_ROOT/ORCHESTRATION.md" 2>/dev/null \
       | grep -v '\.claude/' | wc -l | tr -d ' ')
if [ "$bare" -eq 0 ]; then
  _record_pass "protocol references use the root-resolvable .claude/agents/ prefix"
else
  _record_fail "${bare} protocol reference(s) use a bare 'agents/...' path that does not resolve from the project root"
fi

if pass_or_fail "R3"; then
  echo "R3 VERDICT: PASS"
  exit 0
else
  echo "R3 VERDICT: FAIL"
  exit 1
fi
