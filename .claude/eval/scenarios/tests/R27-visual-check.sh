#!/usr/bin/env bash
# R27 — The render is checked at both moments it matters, by something that runs.
#
# Two points in the pipeline need a look at a render: after design-agent writes a
# mockup, and after the implementers build the screen. Neither had a tool.
#
# C16 said "render each screen and put it beside the mockup" in three paragraphs
# of prose — no command, nothing that could fail. design-agent carried four
# accessibility probes as JS snippets to run by hand in a browser session and
# self-report. Both are the shape this template keeps finding: a rule described
# everywhere and verified nowhere. The hand-run screenshot step in the same file
# turned out to depend on a CLI this template never installs, so it had never run
# once, and nothing anywhere said so.
#
# The canary rule is the load-bearing half. A predicate written against markup a
# page does not use returns zero forever, and zero reads like good news — six
# sweeps once did exactly that, and six zeroes were read as six clean results.
# So every criterion must find a planted positive before it may report clean,
# and UNPROVEN exits non-zero: "could not tell" must never file next to "looked
# and it was fine". This scenario pins that each criterion HAS a canary, which is
# checkable without a browser, and exercises both directions where one exists.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
PROJECT_ROOT="$(cd "$CLAUDE_ROOT/.." && pwd)"
TOOL="$CLAUDE_ROOT/tools/visual-check/visual-check.mjs"
WRAPPER="$CLAUDE_ROOT/tools/visual-check/run-visual-check.sh"
PROTOCOL_EARLY="$CLAUDE_ROOT/agents/_visual-review.md"
REVIEWER="$CLAUDE_ROOT/agents/reviewer-agent.md"
DESIGNER="$CLAUDE_ROOT/agents/design-agent.md"

echo "─── R27 — the render is checked, by something that runs ───"

assert_file_exists "$TOOL" "visual-check.mjs present"
assert_file_exists "$WRAPPER" "run-visual-check.sh present"

# ── Wired at both moments ──────────────────────────────────────────────────
assert_file_contains "$REVIEWER" 'C16' "reviewer defines C16"
assert_file_contains "$REVIEWER" 'run-visual-check.sh' \
  "C16 runs the tool instead of describing the work"
assert_file_contains "$REVIEWER" 'against' "C16 compares the build to the design it was built from"
assert_file_contains "$REVIEWER" 'UNPROVEN' "C16 treats an unproven criterion as a failure"
assert_file_contains "$DESIGNER" 'run-visual-check.sh' \
  "design-agent runs the tool on its own mockup"

# The four probes that used to be prose. If they are named nowhere, the remedy
# silently dropped them on its way into a tool.
for crit in covered clipped overlap tap-target unnamed-control label-mismatch hidden-focusable; do
  assert_file_contains "$TOOL" "$crit" "criterion present: ${crit}"
done

# ── The floor belongs to the project ───────────────────────────────────────
# A number invented in this file would become a rule every project inherits
# without agreeing to it. Declared in tokens, or the criterion is skipped.
assert_file_contains "$DESIGNER" 'minTarget' "the tokens template declares a control floor"
assert_file_contains "$TOOL" 'control?.minTarget' "the tool reads the floor from tokens.json"
assert_file_contains "$TOOL" 'no floor to measure against' \
  "an undeclared floor is a skip, not an invented number"
# The alignment window is the smallest step the project's own spacing scale
# defines — off by less than that is off by an amount nobody chose. A number
# picked here would be a rule every project inherits without agreeing to it.
# ── Measure mode: the agent decides what to measure ────────────────────────
# A sweep decides for itself which elements to compare, and it cannot know which
# ones were meant to relate — that is intent, and intent is in no element tree.
# The alignment sweep that used to live here clustered absolute page coordinates,
# so a sidebar item and a card title were compared for having similar x values
# while a label and its own input never were. Every criterion left is one the
# picture cannot answer at all.
assert_file_contains "$TOOL" 'measure' "the tool answers a measurement the agent asked for"
assert_file_not_contains "$TOOL" "name: 'alignment'" \
  "no self-directed alignment sweep — which elements should align is intent, not geometry"
assert_file_contains "$TOOL" 'relative-to' \
  "elements can be measured inside their own container, not only on the page"
assert_file_contains "$TOOL" 'No verdict' \
  "measure mode returns numbers and judges nothing"
assert_file_contains "$PROTOCOL_EARLY" 'relative-to' \
  "the reasoning protocol tells the agent how to ask for a number"

# ── The half a predicate cannot answer ─────────────────────────────────────
# A criterion only finds what someone thought to write down. Two defects in this
# project's history were obvious in a picture and named by no predicate.
PROTOCOL="$CLAUDE_ROOT/agents/_visual-review.md"
assert_file_exists "$PROTOCOL" "the defect-reading protocol exists"
assert_file_contains "$PROTOCOL" 'Do not open the spec or the mockup while doing this' \
  "the render is described before it is compared to intent"
# The generative half. A fixed list of things to check is a ceiling: it finds
# what its author had already seen and is blind to whatever this product does
# that they never met. The claims come from the render in front of the agent.
assert_file_contains "$PROTOCOL" 'not from a list' \
  "what to check is derived from the render, not handed over as a taxonomy"
assert_file_contains "$PROTOCOL" 'Report the refuted ones too' \
  "a measured-and-refuted suspicion is recorded, which is what proves the pass ran"
assert_file_contains "$PROTOCOL" 'not showing you' \
  "the pass asks what the render leaves out"
# The reasoning has to survive a screen that is not a web page. What changes is
# the instrument that answers a measurement, never the question being asked.
assert_file_contains "$PROTOCOL" 'The instrument is per platform' \
  "the reasoning does not assume how the screen is built"
assert_file_contains "$PROTOCOL" 'MANIFEST ## Stack' \
  "the instrument is resolved from the project, never assumed"
assert_file_contains "$PROTOCOL" 'stay suspicions' \
  "with no element tree, a suspicion stays a question instead of becoming a finding"
assert_file_contains "$PROTOCOL" 'is not a finding' \
  "the pass draws the same line C16 does between a defect and a feeling"
assert_file_contains "$DESIGNER" '_visual-review.md' "design-agent runs the defect pass"
assert_file_contains "$REVIEWER" '_visual-review.md' "C16 runs the defect pass"

# ── Every criterion can prove it works ─────────────────────────────────────
# This is the one that would have caught the six wrong sweeps. It is structural
# and needs no browser, which is why it is the check that always runs.
criteria="$(grep -c 'out.push(check({' "$TOOL" || true)"
canaries="$(grep -c 'canary: () =>' "$TOOL" || true)"
assert_int_ge "$criteria" 5 "the tool carries a meaningful number of criteria (got ${criteria})"
assert_eq "$canaries" "$criteria" "every criterion plants a canary — none may report clean unproven"
assert_file_contains "$TOOL" "the canary was not detected" \
  "an undetected canary is reported as the finding it is"
# Canaries live in the page under test, so the page's CSS applies to them. A
# stylesheet setting min-height on buttons once inflated the tap-target canary
# until it was no longer small, and a clean page reported UNPROVEN.
assert_file_contains "$TOOL" "'important'" \
  "planted canaries resist the page's own CSS"

# ── Executable: invocation and the no-browser path ─────────────────────────
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

set +e
out_noargs="$(node "$TOOL" 2>&1)"; rc_noargs=$?
set -e
assert_eq "$rc_noargs" "2" "no --target is a bad invocation, not a silent pass"

cat > "$TMP/clean.html" <<'EOF'
<!doctype html><meta charset="utf-8"><title>clean</title>
<style>button{display:block;min-width:120px;min-height:44px;margin:8px}</style>
<button data-testid="primary-save">Save</button>
<button data-testid="cancel" aria-label="Cancel changes">Cancel</button>
EOF
cat > "$TMP/dirty.html" <<'EOF'
<!doctype html><meta charset="utf-8"><title>dirty</title>
<style>body{margin:0;font:14px system-ui}
.lid{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:99}
.cut{width:60px;height:16px;overflow:hidden;white-space:nowrap}
.card{position:absolute;left:24px;width:200px;height:40px;background:#eee}
.odd{position:absolute;left:27px;width:200px;height:40px;background:#eee}</style>
<button data-testid="primary-save">Save</button>
<div class="cut">a task name far longer than sixty pixels wide</div>
<button aria-label="Dispatch">Send</button>
<div style="display:none"><button>ghost</button></div>
<div class="card" style="top:60px">a</div>
<div class="card" style="top:110px">b</div>
<div class="card" style="top:160px">c</div>
<div class="odd"  style="top:210px">off a shared column by three</div>
<button style="position:fixed;left:24px;bottom:4px;width:120px;height:44px">Submit</button>
<div class="lid"></div>
EOF
# The three thresholds this tool measures against are all the project's, so the
# fixture has to declare them the way a project would. A tokens file without
# them is the skip path, which the no-browser branch already covers.
echo '{"spacing":{"1":"4px","2":"8px"},"control":{"minTarget":{"value":44},"keyboardInset":{"value":300}}}' > "$TMP/tokens.json"

set +e
out_dirty="$(node "$TOOL" --target "$TMP/dirty.html" --tokens "$TMP/tokens.json" 2>&1)"
set -e

if echo "$out_dirty" | grep -q 'Playwright not installed\|browser would not launch'; then
  # A checker that crashes without a browser breaks every review for a reason
  # unrelated to the code, so the degrade path is itself worth pinning.
  _record_pass "no browser here — the tool degrades to a skip instead of crashing"
  if echo "$out_dirty" | grep -q 'no criterion was evaluated'; then
    _record_pass "the skip says no criterion ran, rather than reading as a pass"
  else
    _record_fail "a skipped render does not say that nothing was evaluated"
  fi
else
  # Both directions. A checker that only ever fires is as useless as one that
  # never does: the clean page must come back clean, and by proof, not silence.
  for crit in covered clipped label-mismatch hidden-focusable tap-target; do
    if echo "$out_dirty" | grep -q "FAIL.*\[${crit}\]"; then
      _record_pass "planted defect detected: ${crit}"
    else
      _record_fail "planted defect NOT detected: ${crit}"
    fi
  done

  set +e
  out_clean="$(node "$TOOL" --target "$TMP/clean.html" --tokens "$TMP/tokens.json" 2>&1)"
  rc_clean=$?
  set -e
  assert_eq "$rc_clean" "0" "a clean page passes"
  if echo "$out_clean" | grep -q 'UNPROVEN'; then
    _record_fail "a criterion could not find its own canary on a clean page"
  else
    _record_pass "every criterion proved it can fire before reporting clean"
  fi

  # Measure mode, on the shape it exists for: one component rendered three
  # times, one instance off by 3px inside its own card. Absolute coordinates
  # cannot separate that from two cards simply sitting in different places —
  # only the container-relative offsets can, which is why --relative-to is the
  # half that matters.
  cat > "$TMP/cards.html" <<'EOF'
<!doctype html><meta charset="utf-8"><title>cards</title>
<style>body{margin:0;font:14px system-ui}
.card{position:relative;margin:16px;padding:16px;width:240px;height:48px;background:#eee}
.card .title{position:absolute;left:16px;top:12px}
.card.odd .title{left:19px}</style>
<div class="card"><div class="title">Buy milk</div></div>
<div class="card"><div class="title">Call dentist</div></div>
<div class="card odd"><div class="title">Pay rent</div></div>
EOF
  set +e
  out_measure="$(node "$TOOL" --target "$TMP/cards.html" --measure '.card .title' --relative-to '.card' 2>&1)"
  rc_measure=$?
  set -e
  assert_eq "$rc_measure" "0" "measure mode judges nothing, so it cannot fail"
  if echo "$out_measure" | grep -qE 'within \.card:'; then
    _record_pass "measure reports each element inside its own container"
  else
    _record_fail "measure does not report container-relative offsets"
  fi
  if echo "$out_measure" | grep -A2 'within \.card:' | grep -qE 'left +spread +3px'; then
    _record_pass "the one instance off by 3px inside its card is visible in the numbers"
  else
    _record_fail "the container-relative spread does not surface the odd instance"
  fi
  if echo "$out_measure" | grep -q 'No verdict'; then
    _record_pass "measure returns numbers and leaves the meaning to the reader"
  else
    _record_fail "measure mode reaches a verdict, which puts the script back in charge"
  fi

  # Parity is the moment-2 question: C14 proves the string exists in source,
  # this proves the element reaches a screen.
  set +e
  out_parity="$(node "$TOOL" --target "$TMP/dirty.html" --against "$TMP/clean.html" 2>&1)"
  set -e
  if echo "$out_parity" | grep -q 'FAIL.*\[parity\].*cancel'; then
    _record_pass "a testid the design shows and the build never does is reported"
  else
    _record_fail "testid parity between design and build is not reported"
  fi
fi

pass_or_fail "R27"
