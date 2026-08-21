#!/usr/bin/env bash
# R13 — The declared-elements check finds a field the spec forgot about.
#
# The failure it guards is silent by construction. A field declared in ## Data
# and never constrained by an AC has no downstream advocate: the implementer
# invents a behaviour because it needs one, QA writes test cases from the spec
# so never covers what the spec omits, C2 reports full coverage, and C12
# confirms the suite can fail — because the tests that exist are fine. Nothing
# in the pipeline is looking for the question that was never asked.
#
# So the tool has to be right in both directions. A checker that flags every
# spec is as useless as one that flags none: the first gets switched off in a
# week, the second was never on.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TOOL="$CLAUDE_ROOT/tools/spec-check/declared-elements.sh"
REVIEWER="$CLAUDE_ROOT/agents/reviewer-agent.md"
SPEC_AGENT="$CLAUDE_ROOT/agents/spec-agent.md"
TEMPLATE="$CLAUDE_ROOT/templates/docs/feature.md"

echo "─── R13 — declared elements are accounted for ───"

assert_file_exists "$TOOL" "declared-elements.sh present"
assert_file_contains "$REVIEWER" 'C13' "reviewer defines C13"
assert_file_contains "$REVIEWER" 'declared-elements.sh' "C13 runs the tool"
assert_file_contains "$SPEC_AGENT" 'declared-elements.sh' "spec-agent self-checks before finishing"

# The rule must be stated as a procedure over what the spec declares, not as a
# list of things specs usually need. A catalogue would cap the agent at whatever
# we thought to write down, and would be wrong in the first unfamiliar domain.
assert_file_contains "$SPEC_AGENT" 'Do not work from a list of things features usually need' \
  "spec-agent derives the accounting from the spec, not from a catalogue"

# The template must offer the three places an element can legitimately land.
assert_file_contains "$TEMPLATE" 'Open Questions' "feature template has Open Questions"
assert_file_contains "$TEMPLATE" 'Out of Scope' "feature template has Out of Scope"

FIX="$(mktemp -d)"
trap 'rm -rf "$FIX"' EXIT

# ── A spec big enough for the pipeline to break on ─────────────────────────
#
# The tool once tested presence with `printf '%s' "$HAY" | grep -qF "$needle"`
# under `set -o pipefail`. That reports FAILURE for a field that is present:
# grep -q exits at the first match, printf then takes SIGPIPE (141), and pipefail
# promotes it. So the EARLIER and more often a field appears, the more certainly
# it is called missing — the inversion that makes it look like anything but a
# plumbing bug.
#
# It survived here because every other fixture in this file is under a kilobyte,
# and the failure needs a haystack large enough for printf to still be writing
# when grep exits. Measured on a real spec: 64 KB passed, 72 KB returned 141.
# A check cannot catch a defect in an environment where the defect cannot occur,
# so this fixture is sized past the threshold rather than written for reading.
{
  printf '## Acceptance Criteria\n'
  i=1
  while [ "$i" -le 900 ]; do
    printf -- '- [ ] **AC-%s** (api) — due_date is validated, compared and rendered; padding to carry this spec past the SIGPIPE threshold with prose that means nothing on its own.\n' "$i"
    i=$((i + 1))
  done
  printf '\n## Data\n| Field | Type | Required | Validation | Notes |\n|---|---|---|---|---|\n'
  printf '| due_date | datetime | no | future or null | |\n'
  printf '\n## Open Questions\n- [ ] none\n'
} > "$FIX/large.md"

large_bytes=$(wc -c < "$FIX/large.md" | tr -d ' ')
if [ "$large_bytes" -gt 100000 ]; then
  _record_pass "the large fixture is ${large_bytes} bytes — past the threshold this bug needs"
else
  _record_fail "large fixture is only ${large_bytes} bytes — too small to exercise the pipeline bug"
fi

if bash "$TOOL" "$FIX/large.md" >/dev/null 2>&1; then
  _record_pass "a field present many times in a large spec is not reported missing"
else
  _record_fail "a field present ~900 times was reported as an orphan — the presence test inverts on large specs"
fi

# ── A spec that finished its own sentences ─────────────────────────────────
cat > "$FIX/complete.md" <<'MD'
## Acceptance Criteria
- [ ] **AC-1** (api) — Given a record with a due_date in the past, when listed, then it is marked overdue
- [ ] **AC-2** (api) — A reminder fires reminder_offset minutes before due_date

## Data
| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| due_date | datetime | no | future or null | |
| reminder_offset | int | no | 0..1440 | |
| recurrence | string | no | rrule | |

## Out of Scope (this iteration)
- recurrence — deferred to v2, no UI to edit it yet

## Open Questions
- [ ] none
MD

if bash "$TOOL" "$FIX/complete.md" >/dev/null 2>&1; then
  _record_pass "a spec that accounts for every field passes"
else
  _record_fail "false positive: an accounted-for spec was flagged"
fi

# ── A spec that declared a field and walked away ───────────────────────────
cat > "$FIX/orphan.md" <<'MD'
## Acceptance Criteria
- [ ] **AC-1** (api) — Given a record with a due_date in the past, when listed, then it is marked overdue

## Data
| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| due_date | datetime | no | future or null | |
| timezone | string | yes | IANA | |

## Out of Scope (this iteration)
- [thing not built] — [why]

## Open Questions
- [ ] none
MD

OUT="$(bash "$TOOL" "$FIX/orphan.md" 2>&1 || true)"
if printf '%s' "$OUT" | grep -q 'timezone'; then
  _record_pass "an unaccounted field is named in the report"
else
  _record_fail "missed a field declared in ## Data and referenced nowhere else"
fi

if bash "$TOOL" "$FIX/orphan.md" >/dev/null 2>&1; then
  _record_fail "exited 0 despite an unaccounted field"
else
  _record_pass "exits non-zero on an unaccounted field"
fi

# Accounting via Open Questions or Out of Scope must count. Otherwise the only
# way to satisfy the check is to invent an AC, which turns "we have not decided"
# into a fabricated decision — the opposite of what this is for.
cat > "$FIX/deferred.md" <<'MD'
## Acceptance Criteria
- [ ] **AC-1** (api) — Given a record with a due_date in the past, when listed, then it is marked overdue

## Data
| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| due_date | datetime | no | future or null | |
| timezone | string | yes | IANA | |

## Out of Scope (this iteration)
- [thing not built] — [why]

## Open Questions
- [ ] timezone — whose timezone decides "overdue", the viewer's or the author's? needs product input
MD

if bash "$TOOL" "$FIX/deferred.md" >/dev/null 2>&1; then
  _record_pass "a field parked in Open Questions counts as accounted for"
else
  _record_fail "forced an AC for a field that is knowingly undecided"
fi

# ── Shape-insensitive matching ─────────────────────────────────────────────
# Without it, most findings would be spelling rather than substance.
cat > "$FIX/shape.md" <<'MD'
## Acceptance Criteria
- [ ] **AC-1** (web) — The due date column sorts ascending by default

## Data
| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| dueDate | datetime | no | — | |

## Open Questions
- [ ] none
MD

if bash "$TOOL" "$FIX/shape.md" >/dev/null 2>&1; then
  _record_pass "dueDate is matched by prose saying \"due date\""
else
  _record_fail "field naming shape produced a false positive"
fi

# ── The shipped template must not fail its own check ───────────────────────
# Its ## Data row is the unfilled [name] placeholder; a checker that flags the
# template would flag every new feature on day one.
if bash "$TOOL" "$TEMPLATE" >/dev/null 2>&1; then
  _record_pass "the shipped feature template passes"
else
  _record_fail "the shipped template fails its own check — every new spec starts red"
fi

if pass_or_fail "R13"; then
  echo "R13 VERDICT: PASS"
  exit 0
else
  echo "R13 VERDICT: FAIL"
  exit 1
fi
