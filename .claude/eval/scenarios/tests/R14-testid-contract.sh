#!/usr/bin/env bash
# R14 — The testid contract between mockup, implementation and QA is verified.
#
# design-agent declares testids, the implementer applies them, QA builds
# selectors from them. Nine files in this template describe that contract and,
# until C14, nothing checked it.
#
# The symptom is what makes it worth pinning: a dropped testid does not appear
# as a contract breach. It appears during QA execution as a selector that will
# not resolve, which reads as flakiness — retried, quarantined, cause never
# named. Checks are most valuable exactly where the symptom points elsewhere.
#
# This is also the half of design review that survives `product_review: skip`,
# so it has to work without a browser and without the optional gate agent.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
PROJECT_ROOT="$(cd "$CLAUDE_ROOT/.." && pwd)"
TOOL="$CLAUDE_ROOT/tools/design-check/testid-contract.sh"
REVIEWER="$CLAUDE_ROOT/agents/reviewer-agent.md"
MANIFEST="$PROJECT_ROOT/MANIFEST.md"

echo "─── R14 — testid contract honoured by the implementation ───"

assert_file_exists "$TOOL" "testid-contract.sh present"
assert_file_contains "$REVIEWER" 'C14' "reviewer defines C14"
assert_file_contains "$REVIEWER" 'testid-contract.sh' "C14 runs the tool"

# The structural half of design review must not live in the optional gate.
# If it does, a project that skips product review silently stops checking
# whether the built screens match the ones that were approved.
assert_file_contains "$MANIFEST" 'What `skip` gives up' \
  "MANIFEST states what product_review: skip forfeits"

FIX="$(mktemp -d)"
trap 'rm -rf "$FIX"' EXIT

cat > "$FIX/login.html" <<'HTML'
<form>
  <input data-testid="login-email">
  <input data-testid="login-password">
  <button data-testid="login-submit">Sign in</button>
  <a data-testid="login-forgot">Forgot?</a>
</form>
HTML

cat > "$FIX/honoured.tsx" <<'TSX'
export const Login = () => (
  <form>
    <input data-testid="login-email" />
    <input data-testid="login-password" />
    <button data-testid="login-submit">Sign in</button>
    <a data-testid="login-forgot">Forgot?</a>
  </form>
);
TSX

cat > "$FIX/breached.tsx" <<'TSX'
export const Login = () => (
  <form>
    <input data-testid="login-email" />
    <input />
    <button data-testid="login-submit">Sign in</button>
    <a data-testid="login-extra">Forgot?</a>
  </form>
);
TSX

run() { ( cd "$FIX" && bash "$TOOL" --mockups "$1" --impl "$2" 2>&1 ); }

if ( cd "$FIX" && bash "$TOOL" --mockups login.html --impl honoured.tsx ) >/dev/null 2>&1; then
  _record_pass "an implementation that applies every testid passes"
else
  _record_fail "false positive: a fully honoured contract was reported as breached"
fi

OUT="$(run login.html breached.tsx || true)"
for id in login-password login-forgot; do
  if printf '%s' "$OUT" | grep -q "$id"; then
    _record_pass "names the dropped testid: $id"
  else
    _record_fail "missed a testid declared in the mockup and absent from the implementation: $id"
  fi
done

if ( cd "$FIX" && bash "$TOOL" --mockups login.html --impl breached.tsx ) >/dev/null 2>&1; then
  _record_fail "exited 0 despite a dropped testid"
else
  _record_pass "exits non-zero on a dropped testid"
fi

# An extra testid is not a failure. Treating it as one would push implementers
# to strip test hooks the design simply had not caught up with.
if printf '%s' "$OUT" | grep -q 'note.*login-extra'; then
  _record_pass "an undeclared testid is a note, not a failure"
else
  _record_fail "an undeclared testid was not reported as a note"
fi

# Platform attribute names differ; the contract does not.
cat > "$FIX/login-ios.html" <<'HTML'
<View accessibilityIdentifier="login-email"></View>
<View accessibilityIdentifier="login-submit"></View>
HTML
cat > "$FIX/native.tsx" <<'TSX'
<View><TextInput testID="login-email" /><Button testID="login-submit" /></View>
TSX
if ( cd "$FIX" && bash "$TOOL" --mockups login-ios.html --impl native.tsx ) >/dev/null 2>&1; then
  _record_pass "iOS accessibilityIdentifier is matched by React Native testID"
else
  _record_fail "cross-platform attribute naming produced a false positive"
fi

# A feature with no testids anywhere must not fail — plenty of features have no UI.
: > "$FIX/empty.html"
: > "$FIX/empty.tsx"
if ( cd "$FIX" && bash "$TOOL" --mockups empty.html --impl empty.tsx ) >/dev/null 2>&1; then
  _record_pass "a mockup declaring no testids passes"
else
  _record_fail "a UI-less feature was failed"
fi

if pass_or_fail "R14"; then
  echo "R14 VERDICT: PASS"
  exit 0
else
  echo "R14 VERDICT: FAIL"
  exit 1
fi
