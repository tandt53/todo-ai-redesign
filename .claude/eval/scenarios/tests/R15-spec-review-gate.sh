#!/usr/bin/env bash
# R15 — Gate 1's multi-lens review is wired, scoped, and cannot pass by silence.
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
PROTO="$AGENTS/_spec-review-protocol.md"
ORCH="$CLAUDE_ROOT/ORCHESTRATION.md"
MANIFEST="$PROJECT_ROOT/MANIFEST.md"

echo "─── R15 — Gate 1 multi-lens spec review ───"

# The lenses that must carry a review-spec section, and the lens each declares.
LENSES="architect-agent:architect backend-agent:dev web-agent:dev mobile-agent:dev \
design-agent:design qa-api-agent:tester qa-web-agent:tester qa-mobile-agent:tester"

assert_file_exists "$PROTO" "_spec-review-protocol.md present"

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
  grep -q '_spec-review-protocol.md' "$f" || missing_proto="${missing_proto}${agent} "
  grep -q 'Phase: `review-spec`' "$f"     || missing_section="${missing_section}${agent} "
  grep -q "Gate 1 lens — ${lens}" "$f"    || wrong_lens="${wrong_lens}${agent}(want ${lens}) "
done

[ -z "$missing_proto" ]   && _record_pass "every lens references _spec-review-protocol.md" \
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
