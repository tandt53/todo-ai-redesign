#!/usr/bin/env bash
# Does the implementation honour the mockup's testid catalogue?
#
#   bash .claude/tools/design-check/testid-contract.sh \
#     --mockups "design/auth/screens/login.html design/auth/screens/login-ios.html" \
#     --impl    "src/auth/web/LoginForm.tsx src/auth/mobile/LoginScreen.tsx"
#
# The mockup's testids are a contract between three agents: design-agent
# declares them, the implementer applies them, and QA builds selectors from
# them. Every file in this template says so; nothing verified it.
#
# When the implementation drops one, the failure appears during QA execution as
# a selector that will not resolve — which reads as a flaky test, gets retried,
# gets quarantined, and the contract breach is never named. That is worth a
# check precisely because the symptom points somewhere else.
#
# Direction is not symmetric:
#   - declared in a mockup, absent from the implementation  → FAIL. QA is
#     entitled to that selector and will write tests against it.
#   - present in the implementation, absent from every mockup → NOTE. Harmless
#     to QA, but it means an element nobody designed is carrying a test hook.
#
# Attribute names come from what the platforms actually use: data-testid on
# web, and React Native's single testID prop, which surfaces as
# accessibilityIdentifier on iOS and resource-id on Android.
#
# Exit: 0 = contract honoured, 1 = at least one declared testid is missing,
#       2 = bad usage.

set -uo pipefail

MOCKUPS=""
IMPL=""

while [ $# -gt 0 ]; do
  case "$1" in
    --mockups) MOCKUPS="$2"; shift 2 ;;
    --impl) IMPL="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

[ -z "$MOCKUPS" ] && { echo "testid-contract: --mockups is required (from the feature spec's Links.designed_in)" >&2; exit 2; }
[ -z "$IMPL" ] && { echo "testid-contract: --impl is required (from Links.implemented_in)" >&2; exit 2; }

# One identity catalogue, one source prop, three surface spellings:
#   web   data-testid
#   RN    testID  →  iOS accessibilityIdentifier · Android resource-id
# contentDescription is NOT an identity attribute: it is Android's spoken
# announcement (from accessibilityLabel), and TalkBack reads it aloud — an id
# parked there gets spoken to the user instead of the message (F-003 AC-12).
ATTR='data-testid|testID|accessibilityIdentifier|resource-id'

ids_in() {
  local out=""
  for f in $1; do
    [ -f "$f" ] || continue
    out="$out
$(grep -oE "(${ATTR})[[:space:]]*=[[:space:]]*[\"'{]?[\"']?[A-Za-z0-9_.:-]+" "$f" 2>/dev/null \
      | sed -E "s/.*[\"'{]//; s/^[\"']//" || true)"
  done
  printf '%s\n' "$out" | grep -v '^$' | sort -u
}

DECLARED="$(ids_in "$MOCKUPS")"
APPLIED="$(ids_in "$IMPL")"

if [ -z "$DECLARED" ]; then
  echo "testid-contract: the mockups declare no testids — nothing to honour."
  exit 0
fi

MISSING=0
HONOURED=0
while IFS= read -r id; do
  [ -z "$id" ] && continue
  if printf '%s\n' "$APPLIED" | grep -qx "$id"; then
    HONOURED=$((HONOURED + 1))
  else
    printf '  FAIL  %s: declared in the mockup, absent from the implementation — a QA selector for it cannot resolve\n' "$id"
    MISSING=$((MISSING + 1))
  fi
done <<< "$DECLARED"

EXTRA=0
if [ -n "$APPLIED" ]; then
  while IFS= read -r id; do
    [ -z "$id" ] && continue
    printf '%s\n' "$DECLARED" | grep -qx "$id" || {
      printf '  note  %s: in the implementation, declared by no mockup\n' "$id"
      EXTRA=$((EXTRA + 1))
    }
  done <<< "$APPLIED"
fi

echo
if [ "$MISSING" -gt 0 ]; then
  echo "testid-contract: $HONOURED honoured, $MISSING missing, $EXTRA undeclared"
  echo "  A missing testid surfaces during QA execution as a selector that will not"
  echo "  resolve. That looks like a flaky test, so it gets retried and quarantined"
  echo "  and the real cause — the implementation dropped a contract element — is"
  echo "  never named. Apply the attribute, or have design-agent remove it from the"
  echo "  mockup if the element is genuinely gone."
  exit 1
fi
SUFFIX=""
[ "$EXTRA" -gt 0 ] && SUFFIX=", $EXTRA undeclared"
echo "testid-contract: all $HONOURED declared testid(s) honoured$SUFFIX"
exit 0
