#!/usr/bin/env bash
# Refuse to commit another agent's in-flight work.
#
#   bash .claude/tools/staging-check/check-staged.sh
#
# `git add -A` and `git add <dir>` sweep whatever a running agent has written so
# far into an unrelated commit. It happened twice in one session. The second time
# an agent found its own work already committed, concluded someone else had done
# it, and declined credit for it — and the orchestrator then told the owner twice
# that it was deliberately not committing running agents' work, which was untrue
# when it was said.
#
# The data to prevent this already existed and nothing read it: STATUS.md
# ## In-Flight lists every dispatch and the subtree it owns.
#
# Exit: 0 = safe to commit, 1 = staged paths belong to a running agent.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
STATUS="$ROOT/.claude/state/STATUS.md"

cd "$ROOT" || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || { echo "check-staged: not a git repository — skipped."; exit 0; }

STAGED="$(git diff --cached --name-only 2>/dev/null)"
if [ -z "$STAGED" ]; then
  echo "check-staged: nothing staged."
  exit 0
fi

if [ ! -f "$STATUS" ]; then
  echo "check-staged: no STATUS.md — cannot tell which subtrees are in flight."
  exit 0
fi

# In-Flight rows: | Task | Agent | Module | Feature | Subtree | Started |
# The subtree column is what an agent owns for the duration of its dispatch.
INFLIGHT="$(awk '
  /^## In-Flight/ { inside = 1; next }
  /^## / { inside = 0 }
  inside && /^\| *T-/ { print }
' "$STATUS")"

if [ -z "$INFLIGHT" ]; then
  echo "check-staged: nothing in flight — $(printf '%s\n' "$STAGED" | grep -c .) path(s) safe to commit."
  exit 0
fi

CLASHES=0
while IFS= read -r row; do
  [ -z "$row" ] && continue
  task="$(printf '%s' "$row"  | awk -F'|' '{v=$2; gsub(/^ +| +$/,"",v); print v}')"
  agent="$(printf '%s' "$row" | awk -F'|' '{v=$3; gsub(/^ +| +$/,"",v); print v}')"
  subtree="$(printf '%s' "$row" | awk -F'|' '{v=$6; gsub(/^ +| +$/,"",v); print v}')"
  case "$subtree" in ""|"—"|"-") continue ;; esac

  while IFS= read -r f; do
    [ -z "$f" ] && continue
    case "$f" in
      "$subtree"*)
        printf '  FAIL  %s is staged, and %s (%s) is writing under %s\n' "$f" "$agent" "$task" "$subtree"
        CLASHES=$((CLASHES + 1)) ;;
    esac
  done <<< "$STAGED"
done <<< "$INFLIGHT"

echo
if [ "$CLASHES" -gt 0 ]; then
  echo "check-staged: $CLASHES staged path(s) belong to a running agent."
  echo "  Stage explicit files instead of a directory, or wait for the dispatch to return."
  echo "  Committing this now takes work the agent has not finished and attributes it"
  echo "  to whatever this commit says it is."
  exit 1
fi
echo "check-staged: staged paths clear of every in-flight subtree."
exit 0
