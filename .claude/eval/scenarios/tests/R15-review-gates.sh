#!/usr/bin/env bash
# R15 — the review gates (1 and 1.5) are wired, scoped, and cannot pass by silence.
#
# The gate's whole value rests on two properties that are easy to lose in an edit:
#
#   1. Every lens knows what it may NOT assess. At Gate 1 the spec is the only
#      artifact — no mockup, no contracts, no code. A lens that reviews things
#      that do not exist yet produces noise, and noise is what gets a review gate
#      switched off.
#   2. A lens cannot pass by saying nothing. "Looks fine" from four agents is
#      pure cost. The protocol requires findings OR an explicit checked: list, and
#      that rule is worth nothing if an agent file never carries it.
#
# Neither is checkable by reading one file, which is why it lives here.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
PROJECT_ROOT="$(cd "$CLAUDE_ROOT/.." && pwd)"
AGENTS="$CLAUDE_ROOT/agents"
PROTO="$AGENTS/_review-protocol.md"
ORCH="$CLAUDE_ROOT/ORCHESTRATION.md"
MANIFEST="$PROJECT_ROOT/MANIFEST.md"

echo "─── R15 — multi-lens review gates (spec + design) ───"

# The lenses that must carry a review-spec section, and the lens each declares.
LENSES="architect-agent:architect backend-agent:dev web-agent:dev mobile-agent:dev \
design-agent:design qa-api-agent:tester qa-web-agent:tester qa-mobile-agent:tester"

assert_file_exists "$PROTO" "_review-protocol.md present"

# --- the protocol states the boundary, or lenses will review thin air ---
assert_file_contains "$PROTO" 'only artifact' "protocol states the spec is the only artifact at Gate 1"
for gate2 in C14 C11 C3 C9; do
  assert_file_contains "$PROTO" "$gate2" "protocol defers ${gate2} to Gate 2"
done
assert_file_contains "$PROTO" 'would_not_be_a_finding_if' \
  "protocol requires every finding to be falsifiable"

# --- anti-theatre: the rule exists and reaches every lens ---
assert_file_contains "$PROTO" 'checked' "protocol defines the checked: list for a lens that finds nothing"

missing_proto=""
missing_section=""
wrong_lens=""
for pair in $LENSES; do
  agent="${pair%%:*}"; lens="${pair##*:}"
  f="$AGENTS/${agent}.md"
  [ -f "$f" ] || { _record_fail "missing agent file: ${agent}.md"; continue; }
  grep -q '_review-protocol.md' "$f" || missing_proto="${missing_proto}${agent} "
  grep -q 'Phase: `review-spec`' "$f"     || missing_section="${missing_section}${agent} "
  grep -q "Gate 1 lens — ${lens}" "$f"    || wrong_lens="${wrong_lens}${agent}(want ${lens}) "
done

[ -z "$missing_proto" ]   && _record_pass "every lens references _review-protocol.md" \
                          || _record_fail "lens(es) not referencing the protocol: ${missing_proto}"
[ -z "$missing_section" ] && _record_pass "every lens carries a review-spec phase section" \
                          || _record_fail "lens(es) with no review-spec section: ${missing_section}"
[ -z "$wrong_lens" ]      && _record_pass "every lens declares the right role" \
                          || _record_fail "lens/role mismatch: ${wrong_lens}"

# A lens must tell the agent to return the checklist rather than go silent.
silent=""
for pair in $LENSES; do
  agent="${pair%%:*}"
  grep -qi 'checked' "$AGENTS/${agent}.md" || silent="${silent}${agent} "
done
[ -z "$silent" ] && _record_pass "every lens is told to return a checked: list when it finds nothing" \
                 || _record_fail "lens(es) that could pass by silence: ${silent}"

# --- the impact contract: both halves, or the gap re-opens silently ---
#
# The pipeline compares a spec to itself (declared-elements) and to the code
# (Gate 2's C-checks), and never to the other specs. Nothing asked a new feature
# what it breaks in the existing ones until an owner noticed the omission by
# hand. Closing it took two edits in two files, and either one alone is
# worthless: an Impact section nobody reviews is a paragraph, and a review
# obligation with no section to read is a no-op. Both are asserted here so a
# later tidy-up cannot remove one and leave the other looking healthy.
SPEC_AGENT="$AGENTS/spec-agent.md"
assert_file_exists "$SPEC_AGENT" "spec-agent.md present"
if [ -f "$SPEC_AGENT" ]; then
  assert_file_contains "$SPEC_AGENT" '## `## Impact`' \
    "spec-agent requires an Impact section on a feature that is not the first"
  assert_file_contains "$SPEC_AGENT" 'what breaks if nobody looks' \
    "spec-agent states Impact covers what BREAKS, not only what is added"
  assert_file_contains "$SPEC_AGENT" 'open question for the owner' \
    "spec-agent forbids settling a product-forcing impact in passing"
fi

assert_file_contains "$PROTO" 'in scope for every lens' \
  "protocol puts the Impact section in scope for every lens"
assert_file_contains "$PROTO" 'true and incomplete' \
  "protocol names incompleteness, not only error, as a reviewable impact failure"
assert_file_contains "$PROTO" 'itself a HIGH finding' \
  "protocol makes a MISSING Impact section a finding rather than nothing to review"

# --- Gate 1.5: the design review, which for a long time did not exist ---
#
# The spec got five lenses before anything was built, the code got fifteen
# deterministic checks, and the design got neither — it went from its author
# straight to the implementers. Backwards against cost: a design defect is
# cheapest before anyone builds on it, and the design is where a large share of a
# feature's decisions are actually taken.
#
# Three properties are asserted because each dies differently. The gate can be
# deleted; it can be kept while its author quietly becomes one of its own lenses;
# and the class of finding it exists for can be routed to the wrong place.
assert_file_contains "$ORCH" 'Gate 1.5' "ORCHESTRATION defines the design gate"
assert_file_contains "$ORCH" 'review-design' "ORCHESTRATION names the design-review phase"
assert_file_contains "$PROTO" 'Reviewing a design' "the protocol carries the design-review contract"
assert_file_contains "$PROTO" 'design-agent is not a lens here' \
  "the protocol bars the author from reviewing its own design"
assert_file_contains "$PROTO" 'you are reviewing taste' \
  "the protocol draws the taste boundary — a rule broken, not a preference"

# The finding that says the design asserts a rule no spec contains must be routed
# to the SPEC, not treated as a design defect. Deleting a good rule because it
# was written in the wrong file is the worst outcome available here.
# Anchored on a fragment that survives a reflow. The first version quoted a
# phrase that happened to span a line break in the source, so it matched nothing
# and failed against text that said exactly what it wanted — an assertion about
# prose has to be written against how prose actually wraps.
assert_file_contains "$ORCH" 'Deleting a good rule because' \
  "a rule found only in the design is routed to the spec, not deleted"

assert_file_contains "$MANIFEST" 'design_review' "MANIFEST declares design_review"
for mode in full skip; do
  if grep -qE "^design_review:[[:space:]]+${mode}|# *${mode} =" "$MANIFEST"; then
    _record_pass "MANIFEST documents design_review mode: ${mode}"
  else
    _record_fail "MANIFEST does not document design_review mode: ${mode}"
  fi
done

# --- the built screen is looked at, and the rubric is not self-graded ---
#
# C14 compares testids: an identity check that proves the same names exist on
# both sides and says nothing about what the screen looks like. Nothing else
# opened the built UI at all — C11 renders the mockup, C4 greps implementation
# source. The two artifacts met only through a string comparison, so a screen
# could carry every declared testid and look nothing like the approved design.
REVIEWER="$AGENTS/reviewer-agent.md"
assert_file_exists "$REVIEWER" "reviewer-agent.md present"
if [ -f "$REVIEWER" ]; then
  # Anchored to the heading form. `### C16` as a substring also matches
  # `### C16-DISABLED`, so the unanchored version passed against a reviewer with
  # the check switched off. Third time a substring assertion has done this here:
  # a check name is only present if it is present AS the name.
  if grep -qE '^### C16 ' "$REVIEWER"; then
    _record_pass "reviewer runs the built-screen check"
  else
    _record_fail "reviewer no longer runs C16 — nothing opens the built UI"
  fi
  # Single-line anchor. The reflow trap noted above caught me a second time in
  # the same file — a phrase that reads as one sentence is not one line.
  assert_file_contains "$REVIEWER" 'could not be rendered is not a screen' \
    "C16 refuses to read an unrenderable screen as a matching one"
fi

# design-agent renders its own screens and grades them against its own rubric.
# Worth doing, and still self-assessment. One lens re-answers and reports only
# the differences.
# --- a revision that lands after downstream work has to reach the consumers ---
#
# Nothing detects this on its own: after a testid is renamed, every agent's work
# still passes its own checks, and the suite is green against a selector that no
# longer resolves to anything a user sees.
assert_file_contains "$ORCH" 'its consumers re-review' \
  "ORCHESTRATION dispatches consumers when an artifact they built against changes"
assert_file_contains "$ORCH" 'is the authority for who to dispatch' \
  "consumers are read from the Links block rather than from memory"
assert_file_contains "$ORCH" 'while being wrong against the new version' \
  "the threshold is stated: a change earns re-review when finished work stays green and wrong"
assert_file_contains "$ORCH" 'review, not a rebuild' \
  "the re-review is scoped to the change rather than the whole artifact"

assert_file_contains "$PROTO" 'Length is part of the format' \
  "the finding format caps claim and consequence at one sentence each"
assert_file_contains "$PROTO" 'checklist, not prose' \
  "the checked: list is one line per entry"
assert_file_contains "$PROTO" 'earn the falsifiability apparatus' \
  "a LOW finding carries claim and directive only"
assert_file_contains "$PROTO" 'grades it instead' \
  "the protocol hands design's self-rubric to another lens"
assert_file_contains "$PROTO" 'no `visual_review:` block' \
  "a design nobody looked at — including its author — is itself a finding"

# The principle that stops the next gate being added on vibes.
ETHOS="$AGENTS/_ethos.md"
assert_file_contains "$ETHOS" 'vantage the author lacks' \
  "the ethos states when a review is worth its cost"
assert_file_contains "$ETHOS" 'never a reason to skip a human' \
  "the ethos bars using that principle to cut the human out"

# --- the orchestrator half ---
assert_file_contains "$ORCH" 'Gate 1 — multi-lens spec review' "ORCHESTRATION defines the gate"
assert_file_contains "$ORCH" 'spec_review' "ORCHESTRATION reads MANIFEST spec_review"
assert_file_contains "$ORCH" 'declared-elements.sh' \
  "ORCHESTRATION runs the free static check before dispatching lenses"
assert_file_contains "$ORCH" 'incompatible directives' \
  "ORCHESTRATION defines conflict narrowly, so not every disagreement stalls the pipeline"
assert_file_contains "$ORCH" 'cost of being wrong' \
  "ORCHESTRATION ranks human decisions by cost of being wrong"
assert_file_contains "$ORCH" 'stays blocked' \
  "ORCHESTRATION states what happens when the human does not answer"

# --- the switch exists and the static check is not switchable off ---
assert_file_contains "$MANIFEST" 'spec_review' "MANIFEST declares spec_review"
for mode in full product-only skip; do
  assert_file_contains "$MANIFEST" "$mode" "MANIFEST documents spec_review mode: ${mode}"
done

# --- the tool the static check calls must actually exist and run ---
TOOL="$CLAUDE_ROOT/tools/spec-check/declared-elements.sh"
assert_file_exists "$TOOL" "the C13 tool ORCHESTRATION calls exists"
if [ -f "$TOOL" ]; then
  if bash -n "$TOOL" 2>/dev/null; then
    _record_pass "the C13 tool parses"
  else
    _record_fail "the C13 tool has a syntax error — Gate 1 step 1 would abort"
  fi
fi

if pass_or_fail "R15"; then
  echo "R15 VERDICT: PASS"
  exit 0
else
  echo "R15 VERDICT: FAIL"
  exit 1
fi
