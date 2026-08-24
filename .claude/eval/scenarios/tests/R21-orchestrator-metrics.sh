#!/usr/bin/env bash
# R21 — The orchestrator is measured, and the measurement is not self-reported.
#
# Every other hook in this template captures a dispatched agent. The thing
# choosing what to dispatch was invisible, which is the wrong way round: a
# question answered with three agent runs costs more than a weak test case ever
# will. Dispatches were logged all along — they were never grouped by the request
# they were serving, so waste had no unit to be counted in.
#
# An episode is that unit: one request, opened by the person speaking and closed
# at Stop. This scenario runs the real hook over a real sequence and requires the
# summary to come out right, because a metric nobody has watched produce a wrong
# number is not evidence either.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
HOOK="$CLAUDE_ROOT/hooks/capture-events.cjs"
SETTINGS="$CLAUDE_ROOT/settings.json"
REPORT="$CLAUDE_ROOT/eval/orchestrator-report.sh"

echo "─── R21 — orchestrator episodes are recorded ───"

assert_file_exists "$HOOK" "capture-events.cjs present"
assert_file_exists "$REPORT" "orchestrator-report.sh present"

# Without the UserPromptSubmit hook nothing opens an episode, and the summary
# silently never runs — dispatches keep logging and the orchestrator stays
# unmeasured, which looks identical to "no waste".
if grep -q 'UserPromptSubmit' "$SETTINGS"; then
  _record_pass "UserPromptSubmit is wired — episodes have a start"
else
  _record_fail "UserPromptSubmit is not wired; no episode is ever opened"
fi

# The measurement must stay hook-observed. This template already learned that a
# self-assessed metric reads HIGH every time.
assert_file_contains "$HOOK" 'Nothing here is self-reported' \
  "the hook states that the orchestrator is not asked to grade itself"

command -v node >/dev/null 2>&1 || { _record_fail "node required"; pass_or_fail "R21" && exit 0 || exit 1; }

FIX="$(mktemp -d)"
trap 'rm -rf "$FIX"' EXIT
mkdir -p "$FIX/.claude/hooks" "$FIX/.claude/eval"
cp "$HOOK" "$FIX/.claude/hooks/"

feed() { ( cd "$FIX" && printf '%s' "$1" | node .claude/hooks/capture-events.cjs ) >/dev/null 2>&1; }

req='{"hook_event_name":"UserPromptSubmit","session_id":"s1","prompt":"four colour options please"}'
ret='{"hook_event_name":"PostToolUse","tool_name":"Task","session_id":"s1","tool_input":{"description":"T-101 — design-agent pick colours"},"tool_response":"Looked at it.\n\n---METRICS---\nstatus: DONE\nfiles_created: []\nfiles_modified: []\n"}'
stop='{"hook_event_name":"Stop","session_id":"s1"}'

# An ask that consumed two agent runs and produced nothing — the shape R19 was
# written against, which until now left no record a query could find.
feed "$req"; feed "$ret"; feed "$ret"; feed "$stop"

EP="$(grep '"event":"episode"' "$FIX/.claude/eval/events.jsonl" 2>/dev/null | head -1)"
if [ -z "$EP" ]; then
  _record_fail "Stop did not close the episode — no summary written"
else
  _record_pass "Stop closes the episode with a summary"

  field() { printf '%s' "$EP" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s)[process.argv[1]])}catch{console.log('')}})" "$1"; }

  assert_eq "$(field dispatches)" "2" "counts the dispatches that one request consumed"
  assert_eq "$(field artifacts)" "0" "counts artifacts produced across the episode"
  assert_eq "$(field zero_artifact_returns)" "2" "counts returns that claimed done and wrote nothing"

  # The same task twice inside one ask is rework the orchestrator caused: a
  # briefing that did not carry what the agent needed.
  if printf '%s' "$EP" | grep -q '"repeated_tasks":\["T-101"\]'; then
    _record_pass "names the task that was dispatched twice"
  else
    _record_fail "did not record the repeated dispatch as rework"
  fi

  # The prompt is a project file that may be committed. Its size is the useful
  # part; its wording is the part that should not leak by default.
  if printf '%s' "$EP" | grep -q '"prompt_chars":26'; then
    _record_pass "records prompt size"
  else
    _record_fail "prompt size not recorded"
  fi
  if grep -q '"prompt":"four colour' "$FIX/.claude/eval/events.jsonl"; then
    _record_fail "prompt text was stored without being asked for"
  else
    _record_pass "prompt text is not stored by default"
  fi
fi

# Stop firing twice must not double-count. The summariser stops at the previous
# episode marker for exactly this reason.
feed "$stop"
COUNT="$(grep -c '"event":"episode"' "$FIX/.claude/eval/events.jsonl" 2>/dev/null | head -1)"
COUNT="${COUNT:-0}"
assert_eq "$COUNT" "1" "a second Stop does not write a second summary"

# A turn with no request opened — a hook firing outside an episode — must record
# nothing rather than inventing an episode with zero everything.
rm -f "$FIX/.claude/eval/events.jsonl"
feed "$ret"; feed "$stop"
ORPHAN="$(grep -c '"event":"episode"' "$FIX/.claude/eval/events.jsonl" 2>/dev/null | head -1)"
ORPHAN="${ORPHAN:-0}"
assert_eq "$ORPHAN" "0" "no episode is written when no request opened one"

if pass_or_fail "R21"; then
  echo "R21 VERDICT: PASS"
  exit 0
else
  echo "R21 VERDICT: FAIL"
  exit 1
fi
