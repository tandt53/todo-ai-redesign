#!/usr/bin/env bash
# R4 — No machine-specific absolute paths in prompt bodies.
#
# `MANIFEST.md ## Paths` is the single source of truth for artifact locations.
# An agent prompt that hardcodes `/Users/someone/projects/...` works on exactly
# one laptop and silently misdirects writes everywhere else. Same for a
# hardcoded home dir or a stray reference to this template's own repo path.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
AGENTS_DIR="$CLAUDE_ROOT/agents"

echo "─── R4 — no hardcoded absolute paths in prompts ───"

TARGETS=("$AGENTS_DIR" "$CLAUDE_ROOT/ORCHESTRATION.md")

assert_grep_zero '/Users/[a-z]' \
  "no /Users/... absolute paths" "${TARGETS[@]}"

assert_grep_zero '/home/[a-z]' \
  "no /home/... absolute paths" "${TARGETS[@]}"

# The template must not point at the repo it was authored in.
assert_grep_zero 'claude-agents-final' \
  "no references to the authoring repo" "${TARGETS[@]}"

# Sibling templates that no longer exist in this repo.
assert_grep_zero 'templates/(qa-starter|qa-agent)' \
  "no references to removed sibling templates" "${TARGETS[@]}"

if pass_or_fail "R4"; then
  echo "R4 VERDICT: PASS"
  exit 0
else
  echo "R4 VERDICT: FAIL"
  exit 1
fi
