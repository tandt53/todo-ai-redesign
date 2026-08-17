#!/usr/bin/env bash
# R11 — The design checker actually detects design defects.
#
# C11 tells reviewer-agent to run a tool. A tool nobody has watched fail is not
# evidence of anything: it certifies whatever it is handed. This scenario runs
# check-design.mjs against fixtures built to break it and requires it to notice.
#
# Two failures in this template were both of exactly this shape — R9 stayed
# green while a parser returned nothing, and R5 reported "all ranges agree"
# while its pattern could not match an en-dash. Both compared declarations
# instead of running the thing.
#
# The render half needs a browser. Where none exists, this scenario checks the
# no-browser path instead — which is itself a behaviour worth pinning, since a
# checker that crashes on a missing browser breaks every review.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TOOL_DIR="$CLAUDE_ROOT/tools/design-check"
CHECKER="$TOOL_DIR/check-design.mjs"
WRAPPER="$TOOL_DIR/run-design-check.sh"
REVIEWER="$CLAUDE_ROOT/agents/reviewer-agent.md"
DESIGNER="$CLAUDE_ROOT/agents/design-agent.md"
PRODUCT="$CLAUDE_ROOT/agents/product-agent.md"

echo "─── R11 — design checker detects design defects ───"

assert_file_exists "$CHECKER" "check-design.mjs present"
assert_file_exists "$WRAPPER" "run-design-check.sh present"

# ── Wiring ─────────────────────────────────────────────────────────────────
assert_file_contains "$REVIEWER" 'C11' "reviewer defines C11"
assert_file_contains "$REVIEWER" 'run-design-check.sh' "C11 runs the checker"
assert_file_contains "$DESIGNER" 'run-design-check.sh' "design-agent self-checks before returning"
assert_file_contains "$PRODUCT" '--screenshots' "product-agent captures screenshots for the judgment pass"

# ── Phase split ────────────────────────────────────────────────────────────
# The screens phase must treat the design system as an input it cannot write.
# Without this the agent authors the standard it is then measured against.
assert_file_contains "$DESIGNER" 'phase: system' "design-agent declares a system phase"
assert_file_contains "$DESIGNER" 'phase: screens' "design-agent declares a screens phase"
assert_file_contains "$DESIGNER" 'needs_artifact: design_system' \
  "screens phase returns BLOCKED when the design system is absent"

# ── Thresholds come from the project, not from the tool ────────────────────
# A checker carrying its own palette or breakpoints would measure every project
# against numbers it invented.
assert_file_contains "$CHECKER" 'readBreakpoints' "breakpoints are read from tokens.json"
assert_file_contains "$CHECKER" 'readContrastThreshold' "contrast ratio is read from DESIGN.md"
if grep -qE 'CONTRAST_MIN *= *[0-9]' "$CHECKER"; then
  _record_fail "checker hardcodes a contrast ratio instead of reading the project's"
else
  _record_pass "checker hardcodes no contrast ratio"
fi

# ── Fixtures ───────────────────────────────────────────────────────────────
FIX="$(mktemp -d)"
trap 'rm -rf "$FIX"' EXIT
mkdir -p "$FIX/design/_shared" "$FIX/design/auth/screens"

cat > "$FIX/design/_shared/tokens.json" <<'JSON'
{ "color": { "primary": "#2563EB", "text": "#111827", "bg": "#FFFFFF" },
  "breakpoints": { "mobile": "375px", "desktop": "1280px" } }
JSON
printf 'Minimum text contrast ratio: 4.5:1\n' > "$FIX/design/_shared/DESIGN.md"

# Clean mockup — every variable matches tokens.json.
cat > "$FIX/design/auth/screens/ok.html" <<'HTML'
<html><head><style>
:root{--color-primary:#2563EB;--color-text:#111827;--color-bg:#FFFFFF}
body{margin:0;background:var(--color-bg);color:var(--color-text)}
</style></head><body><p data-testid="ok-title">Hello</p></body></html>
HTML

# Drifted mockup — one value changed, one variable invented.
cat > "$FIX/design/auth/screens/drift.html" <<'HTML'
<html><head><style>
:root{--color-primary:#FF0000;--color-text:#111827;--color-invented:#ABCDEF}
body{margin:0}
</style></head><body><p data-testid="drift-title">Hello</p></body></html>
HTML

run_checker() { (cd "$FIX" && node "$CHECKER" --design-root design "$@" 2>&1); }

if ! command -v node >/dev/null 2>&1; then
  _record_fail "node is required to run the design checker"
  pass_or_fail "R11" && echo "R11 VERDICT: PASS" || { echo "R11 VERDICT: FAIL"; exit 1; }
  exit 0
fi

# ── Token drift is caught (no browser needed) ──────────────────────────────
OUT="$(run_checker || true)"

if printf '%s' "$OUT" | grep -q 'color-primary is "#FF0000"'; then
  _record_pass "detects a token value that drifted from tokens.json"
else
  _record_fail "missed a drifted token value — checker output: $(printf '%s' "$OUT" | head -3 | tr '\n' ' ')"
fi

if printf '%s' "$OUT" | grep -q 'color-invented is not in tokens.json'; then
  _record_pass "detects a CSS variable absent from tokens.json"
else
  _record_fail "missed a CSS variable that tokens.json does not declare"
fi

if printf '%s' "$OUT" | grep -q 'ok.html.*match tokens.json'; then
  _record_pass "clean mockup passes token drift"
else
  _record_fail "clean mockup was reported as drifted — false positive"
fi

# Non-zero exit on a real defect. A checker that always exits 0 is decoration.
if (cd "$FIX" && node "$CHECKER" --design-root design >/dev/null 2>&1); then
  _record_fail "checker exited 0 despite a drifted token"
else
  _record_pass "checker exits non-zero on a detected defect"
fi

# ── The no-browser path must skip, not crash ───────────────────────────────
# A missing or unlaunchable browser is the common case in CI; if that crashes,
# every review breaks for a reason unrelated to the code under review.
NOBROWSER="$(cd "$FIX" && DESIGN_CHECK_BROWSER=/nonexistent/chrome node "$CHECKER" --design-root design 2>&1 || true)"
if printf '%s' "$NOBROWSER" | grep -qiE 'render.*(not run|skipped)'; then
  _record_pass "unlaunchable browser degrades to a skip"
else
  _record_fail "unlaunchable browser did not degrade cleanly — output: $(printf '%s' "$NOBROWSER" | tail -2 | tr '\n' ' ')"
fi

if printf '%s' "$NOBROWSER" | grep -q 'match tokens.json'; then
  _record_pass "token checks still run when no browser is available"
else
  _record_fail "losing the browser also lost the checks that never needed one"
fi

# ── Render half, only where a browser exists ───────────────────────────────
# Deliberately broken: content wider than any breakpoint, a state switcher that
# changes nothing, a duplicate testid, and a testid that is never visible.
mkdir -p "$FIX/design/render/screens"
cat > "$FIX/design/render/screens/bad.html" <<'HTML'
<html><head><style>
:root{--color-primary:#2563EB;--color-text:#111827;--color-bg:#FFFFFF}
body{margin:0;color:var(--color-text)}
.wide{width:3000px;height:10px}
.gone{display:none}
</style></head><body>
<button onclick="showState('a')">a</button><button onclick="showState('b')">b</button>
<div class="wide"></div>
<p data-testid="dupe">one</p><p data-testid="dupe">two</p>
<p class="gone" data-testid="never">hidden</p>
<script>function showState(s){}</script>
</body></html>
HTML

BROWSER_OUT="$(run_checker || true)"
if printf '%s' "$BROWSER_OUT" | grep -qiE 'render.*(not run|skipped)'; then
  _record_skip 2>/dev/null || true
  echo "  --    no browser available — render assertions not exercised here"
else
  for probe in \
    'horizontal overflow|content is 3000px:overflow at a declared breakpoint' \
    'render identically:a state switcher that changes nothing' \
    'duplicate testid:a duplicate testid' \
    'never visible in any state:a testid that never appears'
  do
    pattern="${probe%%:*}"; label="${probe##*:}"
    if printf '%s' "$BROWSER_OUT" | grep -qE "$pattern"; then
      _record_pass "detects $label"
    else
      _record_fail "missed $label"
    fi
  done
fi

if pass_or_fail "R11"; then
  echo "R11 VERDICT: PASS"
  exit 0
else
  echo "R11 VERDICT: FAIL"
  exit 1
fi
