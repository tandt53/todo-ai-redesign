#!/usr/bin/env bash
# R23 — A measurement never reads a hidden element, and a sweep cannot report
# clean without proving it can find something.
#
# Two defects, one session, neither errored.
#
# A probe read `.row-due,.row-time` to compare time formats. `.row-time` is
# display:none and holds the full-format string, so a hidden element was
# measured — and a correct finding was retracted on the strength of the number
# it produced.
#
# Then six sweeps were written to find visual defects. All six returned nothing
# and all six were wrong: predicates guessed at class names the codebase does not
# use and markup shapes that do not occur. Six zeroes were read as six clean
# results. The one true positive they did produce was dismissed.
#
# The second failure is the harder one, and the rule that fixes it is the same
# discipline the eval sweep applies to itself: a check that has never been
# observed finding anything is not evidence of absence. A sweep must plant a
# canary its own predicate can find, or report inconclusive.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
PROBE="$CLAUDE_ROOT/lib/probe.mjs"
DESIGN="$CLAUDE_ROOT/tools/design-check/check-design.mjs"

echo "─── R23 — probes filter hidden elements, sweeps prove they can find ───"

assert_file_exists "$PROBE" "lib/probe.mjs present"

# A helper nobody uses is another orphaned protocol. The design checker is the
# consumer that already measures a rendered page.
assert_file_contains "$DESIGN" 'installProbe' "the design checker installs the shared probe"
assert_file_contains "$DESIGN" '__probe.visible' "the design checker uses the shared visibility predicate"

# Being off-screen is not being hidden. Treating off-canvas content as clipped
# produced one of the six false sweeps.
assert_file_contains "$PROBE" 'Deliberately NOT part of the definition' \
  "viewport position is excluded from the definition of visible"

command -v node >/dev/null 2>&1 || { _record_fail "node required"; pass_or_fail "R23" && exit 0 || exit 1; }

# ── The logic, exercised without a browser ─────────────────────────────────
# The source is an IIFE that binds window.__probe. Run it against a minimal DOM
# stub so the rules are checked even where Playwright is absent — the rules are
# the point, and they must not go untested on a machine with no browser.
FIX="$(mktemp -d)"
trap 'rm -rf "$FIX"' EXIT
cp "$PROBE" "$FIX/probe.mjs"

cat > "$FIX/t.mjs" <<'JS'
import { PROBE_SOURCE } from './probe.mjs';

// Minimal DOM: enough for the visibility rules and the canary contract.
const mk = (o = {}) => ({
  isConnected: o.connected !== false,
  tagName: 'DIV',
  className: o.cls || '',
  textContent: o.text || '',
  style: {},
  _cs: { display: o.display || 'block', visibility: o.visibility || 'visible', opacity: o.opacity ?? '1' },
  _box: { x: 0, y: o.y ?? 0, width: o.w ?? 10, height: o.h ?? 10 },
  getBoundingClientRect() { return { ...this._box, bottom: this._box.y + this._box.height }; },
  getAttribute() { return null; },
  remove() { this.isConnected = false; },
});

const nodes = { '.visible': [mk()], '.hidden': [mk({ display: 'none' })], '.none': [] };
globalThis.window = {};
globalThis.getComputedStyle = el => el._cs;
globalThis.document = {
  querySelectorAll: sel => nodes[sel] || [],
  createElement: () => mk(),
  body: { appendChild() {} },
};
eval(PROBE_SOURCE);
const P = globalThis.window.__probe;

const out = [];
out.push(['visible element passes', P.visible(mk())]);
out.push(['display:none rejected', !P.visible(mk({ display: 'none' }))]);
out.push(['visibility:hidden rejected', !P.visible(mk({ visibility: 'hidden' }))]);
out.push(['opacity:0 rejected', !P.visible(mk({ opacity: '0' }))]);
out.push(['zero box rejected', !P.visible(mk({ w: 0 }))]);
out.push(['detached rejected', !P.visible(mk({ connected: false }))]);
// Off-screen is NOT hidden: off-canvas content read as clipping was a false sweep.
out.push(['off-screen still visible', P.visible(mk({ y: -9999 }))]);
out.push(['all() drops the hidden one', P.all('.hidden').length === 0]);

const noCanary = P.sweep({ name: 'x', selector: '.none', test: () => true });
out.push(['zero without a canary is inconclusive', noCanary.verdict === 'inconclusive']);

const good = P.sweep({ name: 'x', selector: '.none', test: () => true, canary: () => mk() });
out.push(['zero with a findable canary is clean', good.verdict === 'clean']);

const blind = P.sweep({ name: 'x', selector: '.none', test: () => false, canary: () => mk() });
out.push(['a predicate that cannot find its canary is inconclusive', blind.verdict === 'inconclusive']);

const hit = P.sweep({ name: 'x', selector: '.visible', test: () => true });
out.push(['a real match reports found', hit.verdict === 'found' && hit.hits === 1]);

// A canary must not survive the sweep that planted it.
let planted = null;
P.sweep({ name: 'x', selector: '.none', test: () => true, canary: () => (planted = mk()) });
out.push(['the canary is removed afterwards', planted !== null && planted.isConnected === false]);

for (const [name, ok] of out) console.log((ok ? 'PASS' : 'FAIL') + '\t' + name);
JS

while IFS=$'\t' read -r verdict name; do
  [ -z "$name" ] && continue
  if [ "$verdict" = "PASS" ]; then _record_pass "$name"; else _record_fail "$name"; fi
done < <(cd "$FIX" && node t.mjs 2>&1 | grep -E '^(PASS|FAIL)')

if pass_or_fail "R23"; then
  echo "R23 VERDICT: PASS"
  exit 0
else
  echo "R23 VERDICT: FAIL"
  exit 1
fi
