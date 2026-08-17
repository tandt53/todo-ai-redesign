#!/usr/bin/env bash
# R2 — Every agent definition opens with well-formed YAML frontmatter whose
# `name:` matches its filename, and carries a non-empty `description:`.
#
# Catches: a broken/missing `---` fence (the whole block then renders as body
# text), and a `name:` that drifted from the filename after a rename.
#
# Note: the orchestrator dispatches by reading the file and passing its content
# as the prompt, so `model:`/`tools:` in frontmatter are never enforced at
# runtime — this scenario deliberately does not assert on them. It only checks
# the fields a human reader relies on to pick the right agent.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
AGENTS_DIR="$CLAUDE_ROOT/agents"

echo "─── R2 — agent frontmatter well-formed ───"

for f in "$AGENTS_DIR"/*-agent.md; do
  base="$(basename "$f" .md)"

  if [ "$(head -1 "$f")" != "---" ]; then
    _record_fail "${base}: first line is not '---' (frontmatter missing or shifted)"
    continue
  fi

  # Line number of the closing fence.
  close=$(awk 'NR>1 && $0=="---" {print NR; exit}' "$f")
  if [ -z "$close" ]; then
    _record_fail "${base}: frontmatter opened but never closed"
    continue
  fi

  fm=$(sed -n "2,$((close - 1))p" "$f")

  name=$(printf '%s\n' "$fm" | grep -E '^name:' | head -1 | sed -E 's/^name:[[:space:]]*//' | tr -d '"'"'"' ')
  if [ -z "$name" ]; then
    _record_fail "${base}: no 'name:' field in frontmatter"
  elif [ "$name" != "$base" ]; then
    _record_fail "${base}: name '${name}' does not match filename"
  else
    _record_pass "${base}: frontmatter valid, name matches filename"
  fi

  desc=$(printf '%s\n' "$fm" | grep -E '^description:' | head -1 | sed -E 's/^description:[[:space:]]*//')
  if [ -z "$desc" ]; then
    _record_fail "${base}: no 'description:' field (the orchestrator uses it to route)"
  fi
done

if pass_or_fail "R2"; then
  echo "R2 VERDICT: PASS"
  exit 0
else
  echo "R2 VERDICT: FAIL"
  exit 1
fi
