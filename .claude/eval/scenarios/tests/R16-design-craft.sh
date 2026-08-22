#!/usr/bin/env bash
# R16 — design-agent keeps its craft, and the craft stays anchored to the subject.
#
# Measured before this existed: the same agent, same brief, produced a competent
# but identity-free screen — white cards, one accent, the layout of every CRUD
# app. Nothing in its file asked for more, and the DESIGN.md template itself
# taught the cliché (Inter + framework blue as the worked example). After the
# craft section landed, the same brief produced a screen whose subject shows in
# the first second (library → cream paper, rubber stamps, serif wordmark) while
# every AC treatment survived unchanged.
#
# These greps pin the load-bearing parts so an edit cannot quietly regress them.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
AGENT="$CLAUDE_ROOT/agents/design-agent.md"
TPL="$CLAUDE_ROOT/templates/design/DESIGN.md"

echo "─── R16 — design craft is wired and de-clichéd ───"

assert_file_exists "$AGENT" "design-agent.md present"
assert_file_exists "$TPL"   "DESIGN.md template present"

# --- the craft section and its load-bearing ideas ---
# Aesthetic direction is delegated to two vendored skills; the agent must point
# at them and they must exist with their load-bearing sections intact.
SKILL_FD="$CLAUDE_ROOT/skills/design/frontend-design.md"
SKILL_SC="$CLAUDE_ROOT/skills/design/screen-content.md"
assert_file_exists "$SKILL_FD" "vendored frontend-design skill present"
assert_file_exists "$SKILL_SC" "screen-content skill present"
assert_file_contains "$AGENT" 'skills/design/frontend-design.md' \
  "design-agent reads the frontend-design skill"
assert_file_contains "$AGENT" 'skills/design/screen-content.md' \
  "design-agent reads the screen-content skill"
assert_file_contains "$SKILL_FD" 'Ground it in the subject' \
  "frontend-design skill keeps subject-grounding"
assert_file_contains "$SKILL_SC" 'Fabrication posing as real data' \
  "screen-content keeps the no-fabricated-data rule"

# --- no catalogue of design movements ---
# A named movement carries implications the brief never stated (Swiss => 1px
# rules, no shadows). The agent must derive direction from the product instead,
# so no agent or skill file may offer movements as a menu to pick from.
assert_file_contains "$AGENT" 'never picked from a catalogue' \
  "direction is derived from the product, not chosen from a list"
assert_file_contains "$AGENT" 'Do not name a design movement and commit to it' \
  "committing to a named movement is barred outright"
mv_files="$(ls "$CLAUDE_ROOT"/skills/design/*.md 2>/dev/null | grep -v 'frontend-design.md')"
# shellcheck disable=SC2086
assert_grep_zero '[Bb]rutalis|[Rr]etro-[Ff]uturis|[Aa]urora [Mm]aximalis|[Cc]haotic [Mm]aximalis' \
  "no design skill offers movements as a menu" $mv_files
assert_file_contains "$AGENT" 'audience override' \
  "the audience override exists — product UI answers to the audience's daily apps"
assert_file_contains "$AGENT" 'audience wins' \
  "on product screens, audience beats unexpectedness"
assert_file_contains "$AGENT" 'novelty budget' \
  "the novelty-budget rule exists (bold in one place, quiet elsewhere)"
assert_file_contains "$AGENT" 'Interaction patterns are NOT where novelty lives' \
  "novelty is barred from interaction patterns — recognition is a UX asset"
assert_file_contains "$AGENT" 'One signal per meaning' \
  "one-signal-per-meaning rule present"
assert_file_contains "$AGENT" 'Empty is the first thing a new user sees' \
  "empty state treated as a designed moment"
assert_file_contains "$AGENT" 'Flow before screens' \
  "journey is designed before screens"

# --- self-review with eyes ---
assert_file_contains "$AGENT" 'Self-review with eyes' \
  "the agent must look at its own rendered output"
assert_file_contains "$AGENT" 'Squint test' \
  "the six-question visual rubric is present"
assert_file_contains "$AGENT" 'review_guide' \
  "the agent hands the human a short review guide"
# An unreviewable mockup must degrade loudly, not silently pass.
assert_file_contains "$AGENT" 'PARTIAL' \
  "no browser available degrades to PARTIAL, not silent DONE"

# --- the clichés must not return as worked examples ---
assert_grep_zero '#3B82F6' \
  "framework blue is not offered as the example primary" "$AGENT"
assert_grep_zero 'Inter \(body\), Inter \(heading\)' \
  "single-family Inter is not offered as the example font pairing" "$AGENT"

# --- the template demands an identity, so phase:system cannot skip it ---
assert_file_contains "$TPL" '## Identity' \
  "DESIGN.md template requires an Identity section"
assert_file_contains "$TPL" 'novelty budget' \
  "template asks where the novelty budget is spent"

assert_file_contains "$AGENT" 'skills/design/motion.md' \
  "design-agent reads the motion skill when something moves"
assert_file_contains "$AGENT" 'skills/design/accessible-components.md' \
  "design-agent reads the component-accessibility skill for dialogs, menus and tabs"
SKILLS="$CLAUDE_ROOT/skills/design"
assert_file_contains "$SKILLS/motion.md" 'explain a change' \
  "motion is tied to a state change rather than treated as decoration"
assert_file_contains "$SKILLS/motion.md" 'not a missing one' \
  "reduced motion replaces the feedback rather than removing it"
assert_file_contains "$SKILLS/accessible-components.md" 'use the native element' \
  "the skill reaches for HTML before ARIA"
assert_file_contains "$SKILLS/accessible-components.md" 'Focus is a design decision' \
  "focus movement on open and close is designed, not left to the implementer"

assert_file_contains "$AGENT" 'Return an edge table' \
  "every navigation edge is drawn and evidenced, not asserted as covered"
assert_file_contains "$AGENT" 'enumerates its own states' \
  "each screen lists the states it can reach, not the states the author recalled"
assert_file_contains "$AGENT" 'deliberately do not draw' \
  "a state omitted on purpose is named, so it is distinguishable from one forgotten"

if pass_or_fail "R16"; then
  echo "R16 VERDICT: PASS"
  exit 0
else
  echo "R16 VERDICT: FAIL"
  exit 1
fi
