#!/usr/bin/env bash
# R8 — The static dashboard build actually produces a report containing data.
#
# R1–R7 check that files agree with each other. This one checks a *behaviour*:
# it runs the real generate-dashboard.sh against fixture metrics and asserts the
# output is a page with the data baked in.
#
# The failure this exists for: generate-dashboard.sh substituted a placeholder
# (`METRICS_DATA`) that did not exist in dashboard.html, so the "static build"
# emitted a byte-identical copy of the template — a page that always rendered
# "No metrics found yet" — while cheerfully printing "3 dispatches loaded".
# Every file involved was internally consistent; only running it revealed it.
#
# Still R-tier: no `claude`, no network, no cost. Needs `node` (the build uses it).

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

EVAL_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "─── R8 — static dashboard build emits data ───"

command -v node >/dev/null 2>&1 || skip_scenario "node not on PATH — generate-dashboard.sh cannot run"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Work on a copy so the project's real metrics and dashboard-report.html are untouched.
mkdir -p "$TMP/eval/metrics/layer1" "$TMP/eval/metrics/layer2" "$TMP/bin"
cp "$EVAL_DIR/dashboard.html" "$EVAL_DIR/generate-dashboard.sh" "$TMP/eval/" 2>/dev/null

# The build opens a browser on success. Stub it out.
for stub in open xdg-open; do
  printf '#!/bin/sh\nexit 0\n' > "$TMP/bin/$stub"
  chmod +x "$TMP/bin/$stub"
done
export PATH="$TMP/bin:$PATH"

# --- Case 1: no metrics at all → must fail loudly, not emit an empty report ---
set +e
out_empty=$(bash "$TMP/eval/generate-dashboard.sh" 2>&1)
rc_empty=$?
set -e
if [ "$rc_empty" -ne 0 ]; then
  _record_pass "empty metrics dir exits non-zero instead of emitting a blank report"
else
  _record_fail "empty metrics dir exited 0 — a data-less report would look like a successful build"
fi
assert_file_not_exists "$TMP/eval/dashboard-report.html" "no report written when there is nothing to report"

# --- Case 2: real fixtures in both layers ---
cat > "$TMP/eval/metrics/layer1/2026-01-01-backend-agent-1.json" <<'JSON'
{"layer":1,"agent":"backend-agent","task_id":"T-R8A","feature_id":"F-901",
 "timestamp":"2026-01-01T00:00:00Z","status":"DONE","confidence":"HIGH",
 "files_created":["src/r8/marker.ts"],"files_created_count":1,
 "tests":{"passing":7,"failing":0,"total":7},"acs_covered":"AC-1",
 "blockers":"none","bugs_filed":[],"project":"r8"}
JSON
cat > "$TMP/eval/metrics/layer2/2026-01-01-review-F-901.json" <<'JSON'
{"layer":2,"signal_type":"review","feature":"F-901","timestamp":"2026-01-01T00:00:00Z",
 "source_file":"reports/review-F-901.md","result":"STRUCTURAL-FAIL",
 "checks_passed":8,"checks_failed":1,"failed_checks":"C2","project":"r8"}
JSON

set +e
out=$(bash "$TMP/eval/generate-dashboard.sh" 2>&1)
rc=$?
set -e
if [ "$rc" -eq 0 ]; then
  _record_pass "build exits 0 with metrics present"
else
  _record_fail "build failed with metrics present: ${out}"
fi

REPORT="$TMP/eval/dashboard-report.html"
assert_file_exists "$REPORT" "dashboard-report.html written"

if [ -f "$REPORT" ]; then
  # The core regression: the report must NOT be a copy of the template.
  if cmp -s "$TMP/eval/dashboard.html" "$REPORT"; then
    _record_fail "report is byte-identical to the template — no data was injected"
  else
    _record_pass "report differs from the template (data was injected)"
  fi

  # Every placeholder must be consumed, in both directions.
  assert_file_not_contains "$REPORT" '__INJECT_LAYER1__' "layer-1 placeholder consumed"
  assert_file_not_contains "$REPORT" '__INJECT_LAYER2__' "layer-2 placeholder consumed"

  # Fixture markers must survive into the page — one per layer.
  assert_file_contains "$REPORT" 'src/r8/marker.ts' "layer-1 payload present in report"
  assert_file_contains "$REPORT" 'STRUCTURAL-FAIL' "layer-2 payload present in report"
  assert_file_contains "$REPORT" 'F-901' "feature id present in report"

  # The build's own summary line must not overstate what it wrote.
  printf '%s' "$out" | grep -q '1 dispatches (layer 1), 1 quality signals (layer 2)' \
    && _record_pass "build reports the true per-layer counts" \
    || _record_fail "build summary does not match what was injected: ${out}"

  # Injected JSON must not break the page's JavaScript.
  if node -e "
    const fs = require('fs');
    const s = fs.readFileSync('$REPORT', 'utf8');
    const blocks = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    if (!blocks.length) { console.error('no inline script found'); process.exit(1); }
    const app = blocks.sort((a, b) => b.length - a.length)[0];
    // Wrap so top-level await (if any) parses; never executed, syntax check only.
    new Function('return (async () => {' + app + '})');
  " 2>/dev/null; then
    _record_pass "report JavaScript parses after injection"
  else
    _record_fail "injected data broke the page's JavaScript"
  fi
fi

# --- Case 3: placeholder drift must fail loudly, not silently emit no data ---
rm -f "$REPORT"
sed 's|/\*__INJECT_LAYER2__\*/\[\]|[]|' "$TMP/eval/dashboard.html" > "$TMP/eval/dashboard.html.tmp"
mv "$TMP/eval/dashboard.html.tmp" "$TMP/eval/dashboard.html"
set +e
drift_out=$(bash "$TMP/eval/generate-dashboard.sh" 2>&1)
drift_rc=$?
set -e
if [ "$drift_rc" -ne 0 ]; then
  _record_pass "a renamed/removed placeholder aborts the build (exit ${drift_rc})"
else
  _record_fail "placeholder drift went undetected — this is exactly the original bug"
fi
assert_file_not_exists "$REPORT" "no report written when the template has drifted"

if pass_or_fail "R8"; then
  echo "R8 VERDICT: PASS"
  exit 0
else
  echo "R8 VERDICT: FAIL"
  exit 1
fi
