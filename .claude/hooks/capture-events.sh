#!/usr/bin/env bash
# Append-only event log (delegates to Node.js)
# Writes: .claude/eval/events.jsonl — one JSON line per observed transition.
#
# Written by this hook, never by an agent. That separation is the point:
#   - STATUS.md / TASKS.md record what the agent claimed
#   - events.jsonl records what the harness observed
# Comparing the two is how mis-reporting is detected. An agent cannot forge or
# forget an entry here, because it never writes one.
#
# The log also survives a corrupted state file (the sequence needed to rebuild
# TASKS.md is here), and it is what dashboards read — so no agent has to spend
# prompt budget reporting metrics.
#
# Wired to PostToolUse:Task|Agent and Stop in settings.json.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# A hook must never break the session it observes.
cat | node "$SCRIPT_DIR/capture-events.cjs" 2>/dev/null
exit 0
