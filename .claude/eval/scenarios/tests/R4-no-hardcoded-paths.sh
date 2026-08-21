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

# --- roots are referenced as tokens, never as bare literals ---
#
# MANIFEST ## Paths is the single source of truth for where artifacts live, and
# that only holds if agents resolve THROUGH it. A bare `specs/` or `qa/` in an
# agent file is a second source of truth that agrees with the first only while
# the default layout is untouched — and it fails silently the moment a project
# moves a root, because the agent looks in a directory that simply is not there.
#
# Found by moving three roots under docs/ in a real project: the tokens followed,
# 170 bare literals did not, and an upgrade quietly restored them.
assert_grep_zero '(^|[^A-Za-z0-9/{_.-])(specs|design|qa|reports)/' \
  "no bare root literals in prompts — roots are {tokens}" "${TARGETS[@]}"

# --- executable automation belongs under {tests}, cases under {qa} ---
#
# Three QA agent files have to agree about where automation lives, and nothing
# forces them to. One drifting back to `{qa}/.../automation/` is silent: that
# agent files source in a tree the code tooling does not reach, the others do
# not, and the divergence only shows up when someone wonders why one suite is
# not typechecked.
#
# The split is between two things that read alike: a test CASE is authored from
# the spec and traced to an AC; a test SCRIPT is source that imports from {src}.
assert_grep_zero '\{qa\}/\{module\}/automation' \
  "no agent files executable automation under {qa}" "${TARGETS[@]}"

assert_file_contains "$(cd "$CLAUDE_ROOT/.." && pwd)/MANIFEST.md" 'tests: tests/' \
  "MANIFEST declares the tests root that automation resolves through"

if pass_or_fail "R4"; then
  echo "R4 VERDICT: PASS"
  exit 0
else
  echo "R4 VERDICT: FAIL"
  exit 1
fi
