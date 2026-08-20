#!/usr/bin/env bash
# Every element a feature spec declares must be accounted for somewhere in it.
#
#   bash .claude/tools/spec-check/declared-elements.sh specs/auth/F-001-login.md
#
# The spec's `## Data` table names fields. Each of those names must appear in at
# least one of:
#
#   - an acceptance criterion   (its behaviour is constrained)
#   - `## Open Questions`       (its behaviour is knowingly undecided)
#   - `## Out of Scope`         (it is knowingly not being built now)
#
# A field declared and never returned to is a decision nobody made. Nothing
# downstream asks about it: the implementer picks a behaviour, QA writes tests
# from the spec and so never covers what the spec omits, and the coverage matrix
# comes back green. The gap surfaces in production as "we never decided that".
#
# This carries no vocabulary of its own. The spec supplies the elements; the
# check only asks whether each one was finished. That is why it works the same
# on a payments ledger and on a firmware config.
#
# Name matching is shape-insensitive: `due_date` is considered mentioned by
# "due date", "dueDate" or "due-date". Without that, half the findings would be
# spelling, not substance.
#
# Exit: 0 = every declared field accounted for, 1 = at least one orphan, 2 = bad usage.

set -uo pipefail

SPEC="${1:-}"
[ -z "$SPEC" ] && { echo "usage: declared-elements.sh <feature-spec.md>" >&2; exit 2; }
[ -f "$SPEC" ] || { echo "declared-elements: no such file: $SPEC" >&2; exit 2; }

section() {
  awk -v want="$1" '
    /^## / { inside = ($0 ~ "^## " want) ; next }
    inside { print }
  ' "$SPEC"
}

# Field names from the ## Data table: first column, minus header, separator and
# the shipped placeholder row.
FIELDS="$(section 'Data' | awk -F'|' '
  NF > 2 {
    v = $2
    gsub(/^ +| +$/, "", v)
    if (v == "" || v == "Field") next
    if (v ~ /^-+$/) next
    if (v ~ /^\[.*\]$/) next          # [name] — unfilled template row
    print v
  }')"

if [ -z "$FIELDS" ]; then
  echo "declared-elements: $SPEC declares no data fields — nothing to account for."
  exit 0
fi

# Where a field may be accounted for.
HAYSTACK="$(
  section 'Acceptance Criteria'
  section 'Open Questions'
  section 'Out of Scope'
)"

# Compare on shape-insensitive form: lowercase, separators removed.
normalise() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -d ' _-'; }
HAY_NORM="$(normalise "$HAYSTACK")"

ORPHANS=0
ACCOUNTED=0
while IFS= read -r field; do
  [ -z "$field" ] && continue
  # Substring test in the shell, NOT `printf | grep -q`. Under `set -o pipefail`
  # that pipeline reports failure for a field that IS present: `grep -q` exits at
  # the first match, `printf` then takes SIGPIPE (141), and pipefail promotes it —
  # so the EARLIER a field appears, the more certainly it is reported missing.
  # Measured on F-005: 64 KB haystack → 0, 72 KB → 141, with the field present
  # 11-43 times. See LEARNINGS L-016. Re-applied 2026-08-19 after a template sync
  # reverted it; T-156 carries the upstream port that stops this recurring.
  needle="$(normalise "$field")"
  if [ -n "$needle" ] && case "$HAY_NORM" in *"$needle"*) true ;; *) false ;; esac; then
    ACCOUNTED=$((ACCOUNTED + 1))
  else
    printf '  FAIL  %s: declared in ## Data, then never constrained by an AC, recorded as an Open Question, or excluded in ## Out of Scope\n' "$field"
    ORPHANS=$((ORPHANS + 1))
  fi
done <<< "$FIELDS"

echo
if [ "$ORPHANS" -gt 0 ]; then
  echo "declared-elements: $ACCOUNTED accounted for, $ORPHANS unaccounted in $SPEC"
  echo "  Each orphan is a decision that was not made. Constrain it with an AC,"
  echo "  record it as an Open Question, or exclude it — but do not leave it to"
  echo "  whoever implements the field first."
  exit 1
fi
echo "declared-elements: all $ACCOUNTED declared field(s) accounted for in $SPEC"
exit 0
