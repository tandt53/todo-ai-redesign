#!/usr/bin/env bash
# R26 — The layout is put to the owner while changing it is still cheap.
#
# Measured over two days of real use: the most expensive loop in this pipeline
# was design. Every design-level correction in this project's history came from
# the owner looking at a render, and every one arrived after a *finished* mockup
# existed — design system applied, all states drawn, all breakpoints handled,
# testids catalogued. A correction of the form "the layout is wrong" discards
# all of it, and the mockup is rebuilt.
#
# The remedy is a greyscale wireframe of the whole flow, shown to the owner
# before anything is styled. Layout and craft are independent decisions; asking
# them together is what makes the second answer expensive.
#
# The static half pins that the phase, the gate and the switch exist and agree.
# The executable half is the one that matters, and it is written against a bug
# this scenario's own author nearly shipped: check-design.mjs discovers mockups
# by filtering paths for a `screens` segment, so a wireframe under wireframes/
# was invisible to it — the checker would have reported "nothing to check", exit
# 0, produce no renders, and the gate would have been satisfied by a description.
# That is the failure mode this template keeps finding: a check reporting success
# while doing nothing.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
PROJECT_ROOT="$(cd "$CLAUDE_ROOT/.." && pwd)"
DESIGNER="$CLAUDE_ROOT/agents/design-agent.md"
ORCH="$CLAUDE_ROOT/ORCHESTRATION.md"
MANIFEST="$PROJECT_ROOT/MANIFEST.md"
WRAPPER="$CLAUDE_ROOT/tools/design-check/run-design-check.sh"

echo "─── R26 — the layout gate ───"

# ── The phase exists and is owned ──────────────────────────────────────────
assert_file_contains "$DESIGNER" 'phase: wireframe' "design-agent declares phase: wireframe"
assert_file_contains "$DESIGNER" '{design}/{module}/wireframes/' \
  "design-agent owns the wireframes path, resolved through MANIFEST tokens"
assert_file_contains "$MANIFEST" 'design_wireframes:' \
  "MANIFEST ## Paths declares where wireframes live"

# A wireframe carrying testids, a state switcher and tokens is a mockup with the
# colour removed — the same expensive artifact, reviewed just as late. The
# saving comes entirely from what it leaves out, so the exclusions are the
# contract, not a style note.
assert_file_contains "$DESIGNER" '`data-testid`, no state switcher, no breakpoint variants' \
  "the wireframe is defined by what it excludes"
assert_file_contains "$DESIGNER" 'Greyscale only' "no palette at the layout gate"

# ── The gate exists, and it runs before the expensive phase ────────────────
assert_file_contains "$ORCH" 'The layout gate' "ORCHESTRATION names the layout gate"
assert_file_contains "$ORCH" 'wireframe_signoff' "ORCHESTRATION reads the switch"
assert_file_contains "$MANIFEST" 'wireframe_signoff' "MANIFEST declares the switch"
for mode in required skip; do
  assert_file_contains "$MANIFEST" "$mode" "MANIFEST documents wireframe_signoff mode: ${mode}"
done

# Ordering is the whole point. A gate that runs after the mockup is drawn saves
# nothing, so the ordering is asserted rather than assumed.
gate_line="$(grep -n '^## The layout gate' "$ORCH" | head -1 | cut -d: -f1)"
g15_line="$(grep -n '^## Gate 1.5' "$ORCH" | head -1 | cut -d: -f1)"
assert_int_le "$gate_line" "$g15_line" "the layout gate precedes Gate 1.5 in the playbook"

# The owner must be shown the render. A gate answered from prose is the failure
# it exists to prevent: these defects are invisible in a description.
assert_file_contains "$ORCH" 'Do not describe the layout in prose instead of showing it' \
  "the gate refuses a prose substitute for the render"
assert_file_contains "$ORCH" 'Do not infer approval from silence' \
  "silence is not approval at this gate either"

# `phase: screens` must not re-open what the owner settled.
assert_file_contains "$DESIGNER" 'So is the wireframe option the owner picked' \
  "phase: screens treats the picked option as an input, not a draft to redo"

# ── More than one option, or the gate is a nod ─────────────────────────────
# A yes/no question on a single artifact is answered yes. That is how every gate
# in this template has degraded, and it is why this one asks which rather than
# whether. It is also the only creativity lever the pipeline can afford: an agent
# that drew one option never had to think of the second.
assert_file_contains "$DESIGNER" 'Two or three layout options' \
  "design-agent draws more than one layout"
assert_file_contains "$DESIGNER" 'Materially different' \
  "the options must differ in substance"
assert_file_contains "$DESIGNER" 'same taps in both, that is one option wearing two coats' \
  "the difference test is falsifiable, not a matter of taste"
assert_file_contains "$DESIGNER" 'what the second option would have been' \
  "the single-option escape still costs the alternative being thought of"
assert_file_contains "$ORCH" 'Ask which one, never whether this one is acceptable' \
  "the gate asks for a choice, not an approval"
assert_file_contains "$ORCH" 'Do not pre-filter the options' \
  "the orchestrator may not narrow the field before the owner sees it"
assert_file_contains "$ORCH" 'which one they picked' \
  "the record says which option won, not just that one did"

# ── Executable half: the checker can actually see a wireframe ──────────────
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/.claude/tools" "$TMP/.claude/lib" \
         "$TMP/design/tasks/wireframes" "$TMP/design/_shared"
cp -r "$CLAUDE_ROOT/tools/design-check" "$TMP/.claude/tools/"
cp "$CLAUDE_ROOT/lib/probe.mjs" "$TMP/.claude/lib/"

cat > "$TMP/MANIFEST.md" <<'EOF'
## Paths
```yaml
roots:
  design: design/
```
EOF
echo '{"color":{"primary":"#2b6cb0"}}' > "$TMP/design/_shared/tokens.json"

# Two correct wireframe options: greys, no :root, no testids, flow at the top.
# Two rather than one because the gate is a choice, and a discovery bug that
# found exactly one file would satisfy a single-file fixture.
cat > "$TMP/design/tasks/wireframes/task-list-a.html" <<'EOF'
<!doctype html><meta charset="utf-8"><title>wireframe a</title>
<style>body{font:14px system-ui;color:#333;background:#fff}
.box{border:1px solid #999;background:#eee;padding:12px;margin:8px}</style>
<h1>open list &rarr; tap task &rarr; done (2 actions)</h1>
<div class="box">Task list</div><div class="box">Task detail</div>
EOF
cat > "$TMP/design/tasks/wireframes/task-list-b.html" <<'EOF'
<!doctype html><meta charset="utf-8"><title>wireframe b</title>
<style>body{font:14px system-ui;color:#333;background:#fff}
.box{border:1px solid #999;background:#eee;padding:12px;margin:8px}</style>
<h1>open list &rarr; edit in place &rarr; done (1 action)</h1>
<div class="box">Task list with inline editor</div>
EOF

out="$(cd "$TMP" && bash .claude/tools/design-check/run-design-check.sh --wireframes 2>&1)" || true

# The bug this half exists for: a discovery filter that only matches `screens`
# reports "nothing to check", exits 0, and renders nothing.
# Anchored on the mockups check specifically. A bare 'nothing to check' also
# matches any sibling check a project has bolted onto the same runner — one
# reports exactly that phrase when a tree has no CSS var() references, which
# turned a green wireframe pass into a false failure.
if echo "$out" | grep -qE '\[mockups\].*nothing to check'; then
  _record_fail "the checker cannot see a wireframe — it renders nothing and still exits 0"
else
  _record_pass "the checker discovers files under wireframes/"
fi

# Both options, not just the first. A gate presented with one of the two
# options drawn is the single-artifact yes/no question wearing a choice's name.
if echo "$out" | grep -q '\[mockups\] 2 file(s)'; then
  _record_pass "every option is discovered, not just the first"
else
  _record_fail "the checker did not report both wireframe options"
fi

# A greyscale study has no :root by construction. If token-drift FAILS on it,
# the correct artifact is reported as broken, and a check that fails on correct
# input is switched off within a week.
if echo "$out" | grep -q 'FAIL.*token-drift'; then
  _record_fail "token-drift fails a wireframe for having no tokens — correct input reported as broken"
else
  _record_pass "token-drift is skipped in the lo-fi pass, not failed"
fi

if echo "$out" | grep -q 'FAIL.*contrast'; then
  _record_fail "contrast fails a wireframe whose greys are placeholders"
else
  _record_pass "contrast is skipped in the lo-fi pass"
fi

# The default pass must NOT pick wireframes up: they would fail every check a
# mockup is held to, and a review drowning in expected failures is not read.
out_default="$(cd "$TMP" && bash .claude/tools/design-check/run-design-check.sh 2>&1)" || true
if echo "$out_default" | grep -q 'task-list-a.html'; then
  _record_fail "the default pass reads wireframes as mockups"
else
  _record_pass "the default pass ignores wireframes/"
fi

# Renders are the artifact the owner reviews, so the wrapper must ask for them
# without being told. Where a browser exists, paths must be printed.
assert_file_contains "$WRAPPER" '--screenshots' "the wrapper captures renders by default"
if echo "$out" | grep -q 'Playwright not installed\|browser would not launch'; then
  _record_pass "no browser here — the no-render path is reported, not silently passed"
else
  if echo "$out" | grep -q 'Rendered output'; then
    _record_pass "the checker prints the paths it rendered"
  else
    _record_fail "a browser was available and no render paths were printed"
  fi
fi

pass_or_fail "R26"
