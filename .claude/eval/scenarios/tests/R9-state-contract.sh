#!/usr/bin/env bash
# R9 — One state contract, agreed on by TASKS.md, the orchestrator, the
# validator, and the dashboard parser.
#
# Four parties must agree or the queue silently stops working:
#   1. TASKS.md            — declares the column layout and the status vocabulary
#   2. ORCHESTRATION.md    — selects the next task by parsing those columns
#   3. validate-state.sh   — enforces C1-C5 against those columns
#   4. eval/server.cjs      — renders the queue on the dashboard
#
# The failure this guards against is the one that motivated the single-table
# rewrite: status lived in four section headings with a different column set
# each, so "completing" a task meant retyping the row into another table. A
# parser reading position 8 for Status while the table put it at position 9
# fails silently — every task looks PENDING, and "next" dispatches the same one
# forever.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
PROJECT_ROOT="$(cd "$CLAUDE_ROOT/.." && pwd)"
TASKS="$CLAUDE_ROOT/state/TASKS.md"
SEED="$CLAUDE_ROOT/templates/docs/TASKS.md"
ORCH="$CLAUDE_ROOT/ORCHESTRATION.md"
VALIDATOR="$CLAUDE_ROOT/hooks/validate-state.sh"
SERVER="$CLAUDE_ROOT/eval/server.cjs"
MANIFEST="$PROJECT_ROOT/MANIFEST.md"
CONTRACT="$CLAUDE_ROOT/agents/_completion-protocol.md"

echo "─── R9 — state contract agreed across TASKS / orchestrator / validator / dashboard ───"

assert_file_exists "$TASKS" "TASKS.md present"
assert_file_exists "$VALIDATOR" "validate-state.sh present"

# ── One table, not four ────────────────────────────────────────────────────
# Section-per-status is what the single-table rewrite removed. If it comes back,
# rows have to move between tables again and the column sets diverge again.
for heading in '^## PENDING' '^## IN PROGRESS' '^## DONE'; do
  if grep -qE "$heading" "$TASKS"; then
    _record_fail "TASKS.md has a status section heading ($heading) — status is a column, not a section"
  else
    _record_pass "no status section heading: ${heading#^## }"
  fi
done

assert_file_contains "$TASKS" 'Artifacts' "TASKS.md declares an Artifacts column"
assert_file_contains "$TASKS" 'Depends' "TASKS.md declares a Depends column"
assert_file_contains "$TASKS" 'Outcome' "TASKS.md declares an Outcome column"

# ── One reader, no hardcoded positions ─────────────────────────────────────
# Column positions used to be written out in three places ("Status is field 9")
# in the orchestrator's awk, the validator's awk and the dashboard's regex.
# Moving a column updated one and silently broke the other two. Both readers now
# resolve positions from TASKS.md's own header, so the duplication is gone
# rather than merely guarded.
LIB_SH="$CLAUDE_ROOT/lib/tasks.sh"
LIB_JS="$CLAUDE_ROOT/lib/tasks.cjs"
assert_file_exists "$LIB_SH" "lib/tasks.sh present"
assert_file_exists "$LIB_JS" "lib/tasks.cjs present"

assert_file_contains "$VALIDATOR" 'lib/tasks.sh' "validator sources the shared reader"
assert_file_contains "$ORCH" 'lib/tasks.sh' "orchestrator sources the shared reader"
assert_file_contains "$SERVER" "lib/tasks.cjs" "dashboard requires the shared reader"

# A header row must exist for name resolution to have anything to read.
if grep -qE '^\| *ID *\|' "$TASKS"; then
  _record_pass "TASKS.md has a header row for column-name resolution"
else
  _record_fail "TASKS.md has no '| ID |' header row — readers cannot resolve columns"
fi

# The regression to guard now is a consumer re-deriving positions on its own.
for f in "$VALIDATOR" "$SERVER"; do
  if grep -qE 'cut -d.\|. -f *[0-9]|\$9|\$10|f"?9"?\]' "$f"; then
    _record_fail "$(basename "$f") hardcodes a column position instead of using the reader"
  else
    _record_pass "$(basename "$f") uses no hardcoded column position"
  fi
done

# ── Reordering columns must not break anything ─────────────────────────────
# The property the shared reader buys us, asserted by exercising it rather than
# by trusting the implementation.
SHUF="$(mktemp -d)"
cat > "$SHUF/TASKS.md" <<'SHUF_EOF'
| ID | Status | Title | Agent | Artifacts | Module | Feature | Depends | Pri | Outcome |
|----|--------|-------|-------|-----------|--------|---------|---------|-----|---------|
| T-001 | DONE | Spec | spec-agent | docs/specs/a.md | auth | F-001 | — | P0 | 7 AC |
| T-002 | PENDING | Impl | backend-agent | — | auth | F-001 | T-001 | P2 | — |
| T-003 | PENDING | TCs | qa-web-agent | — | auth | F-001 | T-001 | P1 | — |
| T-004 | PENDING | Waiting | web-agent | — | auth | F-001 | T-002 | P0 | — |
SHUF_EOF

# shellcheck source=/dev/null
( . "$LIB_SH"
  tasks_init "$SHUF/TASKS.md" || exit 1
  picked="$(tasks_get "$(tasks_select_next)" ID)"
  [ "$picked" = "T-003" ] ) \
  && _record_pass "bash reader selects correctly with columns in a different order" \
  || _record_fail "bash reader mis-selects when columns are reordered (expected T-003)"

if command -v node >/dev/null 2>&1; then
  if node -e '
      const {parseTasks} = require(process.argv[1]);
      const fs = require("fs");
      const r = parseTasks(fs.readFileSync(process.argv[2], "utf8"));
      const ok = r.done.length === 1 && r.done[0].agent === "spec-agent"
              && r.done[0].artifacts[0] === "docs/specs/a.md" && r.pending.length === 3;
      process.exit(ok ? 0 : 1);
    ' "$LIB_JS" "$SHUF/TASKS.md" 2>/dev/null; then
    _record_pass "node reader parses correctly with columns in a different order"
  else
    _record_fail "node reader mis-parses when columns are reordered"
  fi
fi
rm -rf "$SHUF"

# ── Selection is dependency-aware ──────────────────────────────────────────
# Selecting on Status alone hands an agent a task whose input does not exist.
assert_file_contains "$LIB_SH" 'tasks_done_ids' "selection resolves which tasks are DONE"
assert_file_contains "$LIB_SH" 'Depends' "selection filters on Depends"
assert_file_contains "$ORCH" 'tasks_select_next' "orchestrator selects through the shared reader"

if grep -q 'grep -E .\\| \*PENDING \*\\|' "$ORCH"; then
  _record_fail "ORCHESTRATION.md still greps the first PENDING row — dependencies are ignored"
else
  _record_pass "no naive first-PENDING grep"
fi

# ── Status is derived, in both directions ──────────────────────────────────
# The agent picks a status from its evidence; the orchestrator re-derives it.
# If only one side carries the rule, the other becomes the drift point.
assert_file_contains "$CONTRACT" 'Status is derived from evidence' \
  "agents are told to derive status from evidence"
assert_file_contains "$ORCH" 'Derive the task Status from evidence' \
  "orchestrator re-derives status rather than trusting the agent's word"

# The empty-artifacts case is the whole point of the rule.
for f in "$CONTRACT" "$ORCH"; do
  if grep -qiE 'empty|names no artifact' "$f"; then
    _record_pass "$(basename "$f") covers the empty-artifact case"
  else
    _record_fail "$(basename "$f") does not say what an empty artifact list means"
  fi
done

# ── Caps are data, not prose ───────────────────────────────────────────────
# A cap in a comment is unenforceable; this template shipped one that said 120
# while the file was 206 lines long.
assert_file_contains "$MANIFEST" 'limits:' "MANIFEST declares ## Limits as data"
for k in manifest_lines status_lines tasks_lines done_rows; do
  if grep -q "$k" "$MANIFEST" && grep -q "$k" "$VALIDATOR"; then
    _record_pass "limit '$k' is declared and read"
  else
    _record_fail "limit '$k' is declared but never read (or read but never declared)"
  fi
done

# Every declared cap must actually hold for the shipped template, or the cap is
# already the dead prose it was meant to replace.
manifest_cap="$(awk '$1 == "manifest_lines:" { print $2; exit }' "$MANIFEST")"
if [ -n "$manifest_cap" ]; then
  assert_file_lines_lte "$MANIFEST" "$manifest_cap" "shipped MANIFEST is within its own cap"
fi

# ── Ownership is declared, and the enforceable half is wired ───────────────
assert_file_contains "$MANIFEST" 'ownership:' "MANIFEST declares ## Ownership"

# A declaration nothing reads is documentation wearing the costume of config.
# The fact→path map is deliberately unenforceable (no script can tell a TC
# restated an AC rather than citing it); the writers map must be enforced.
assert_file_contains "$MANIFEST" 'writers:' "MANIFEST declares a writers map"
assert_file_contains "$VALIDATOR" 'writers:' "validate-state.sh reads the writers map"

# Every dispatchable agent needs a subtree, or C6 fails every task it touches.
missing_writers=""
for af in "$CLAUDE_ROOT"/agents/*.md; do
  case "$(basename "$af")" in _*) continue ;; esac
  a="$(basename "$af" .md)"
  grep -qE "^  ${a}:" "$MANIFEST" || missing_writers="${missing_writers}${a} "
done
if [ -z "$missing_writers" ]; then
  _record_pass "every agent has a writers entry"
else
  _record_fail "agents with no writers entry: ${missing_writers}"
fi

# ── The seed copy must not drift ───────────────────────────────────────────
# .claude/README.md tells users to seed the state file from this copy. It had
# already drifted once; a manual install would then produce a table the parsers
# cannot read.
if [ -f "$SEED" ]; then
  # Compare STRUCTURE, not content. In the template repo the two files are
  # identical; in a live project state/TASKS.md legitimately diverges the moment
  # real work lands. The contract both files must share is the header row — the
  # column names every parser resolves against. A full-content diff here once
  # misled an operator into "refreshing" a live project's state from the seed,
  # which destroys the task history. The columns are the contract; the rows are
  # the user's data.
  state_hdr="$(grep -m1 -E '^\| *ID *\|' "$TASKS" | tr -d ' ')"
  seed_hdr="$(grep -m1 -E '^\| *ID *\|' "$SEED" | tr -d ' ')"
  if [ -n "$state_hdr" ] && [ "$state_hdr" = "$seed_hdr" ]; then
    _record_pass "seed and state/TASKS.md agree on the column contract"
  else
    _record_fail "seed and state/TASKS.md declare different columns — the parsers cannot serve both (state: ${state_hdr:-<none>} seed: ${seed_hdr:-<none>})"
  fi
fi

# ── Dashboard reads the column, not the heading ────────────────────────────
if grep -qE '\^## PENDING|\^## DONE' "$SERVER"; then
  _record_fail "server.cjs still buckets tasks by section heading"
else
  _record_pass "server.cjs does not parse status section headings"
fi
assert_file_contains "$LIB_JS" 'BUCKET' "the shared reader maps Status to dashboard buckets"

# ── The validator runs, and passes on the shipped template ─────────────────
if bash -n "$VALIDATOR" 2>/dev/null; then
  _record_pass "validate-state.sh parses"
else
  _record_fail "validate-state.sh has a syntax error"
fi

if bash "$VALIDATOR" >/dev/null 2>&1; then
  _record_pass "validate-state.sh exits 0 on the shipped template"
else
  _record_fail "validate-state.sh fails on the template it ships with"
fi

# ── The validator actually catches violations ──────────────────────────────
# A validator that always passes is worse than none: it certifies whatever it
# is given. Feed it a queue that breaks C1 and C4 and require a non-zero exit.
FIXTURE="$(mktemp -d)"
trap 'rm -rf "$FIXTURE"' EXIT
mkdir -p "$FIXTURE/.claude/state" "$FIXTURE/.claude/hooks"
cp "$VALIDATOR" "$FIXTURE/.claude/hooks/"
cp "$MANIFEST" "$FIXTURE/MANIFEST.md"
cat > "$FIXTURE/.claude/state/TASKS.md" <<'FIXTURE_EOF'
| ID | Title | Module | Feature | Agent | Pri | Depends | Status | Artifacts | Outcome |
|----|-------|--------|---------|-------|-----|---------|--------|-----------|---------|
| T-001 | Analysis only | auth | F-001 | spec-agent | P0 | — | DONE | — | thought about it |
| T-001 | Duplicate id | auth | F-001 | web-agent | P1 | T-404 | PENDING | — | — |
FIXTURE_EOF

if bash "$FIXTURE/.claude/hooks/validate-state.sh" >/dev/null 2>&1; then
  _record_fail "validate-state.sh passed a queue with a DONE-without-artifacts row, a duplicate ID and a dangling dependency"
else
  _record_pass "validate-state.sh rejects a knowingly broken queue"
fi

# ── The event log is hook-written, never agent-written ─────────────────────
# The log's value is that it is not self-reported. If an agent is ever told to
# write it, it stops being independent evidence.
EVENTS_HOOK="$CLAUDE_ROOT/hooks/capture-events.cjs"
assert_file_exists "$EVENTS_HOOK" "capture-events.cjs present"
assert_file_contains "$EVENTS_HOOK" 'evidence_conflict' \
  "event log records DONE-without-artifacts as a conflict"
assert_grep_zero 'events\.jsonl' \
  "no agent is instructed to write the event log" "$CLAUDE_ROOT/agents"

# A log nothing reads is write-only storage. Its documented purpose is to audit
# the state files, so something must actually perform that comparison.
assert_file_contains "$VALIDATOR" 'events.jsonl' \
  "validate-state.sh reads the event log rather than leaving it write-only"
assert_file_contains "$VALIDATOR" 'done_without_artifacts' \
  "validator cross-checks recorded conflicts against TASKS.md"

# ── C6 and C7 must actually fail ───────────────────────────────────────────
# Same reasoning as the broken-queue fixture above: a check that cannot fail
# certifies whatever it is handed.
FIX2="$(mktemp -d)"
trap 'rm -rf "$FIXTURE" "$FIX2"' EXIT
mkdir -p "$FIX2/.claude/state" "$FIX2/.claude/hooks" "$FIX2/.claude/eval" "$FIX2/qa/auth"
cp "$VALIDATOR" "$FIX2/.claude/hooks/"
cp "$MANIFEST" "$FIX2/MANIFEST.md"
touch "$FIX2/qa/auth/TC.md"

# web-agent writing into the docs/qa/ tree — the overlap the no-locks design forbids.
cat > "$FIX2/.claude/state/TASKS.md" <<'FIX2_EOF'
| ID | Title | Module | Feature | Agent | Pri | Depends | Status | Artifacts | Outcome |
|----|-------|--------|---------|-------|-----|---------|--------|-----------|---------|
| T-001 | Cross-subtree write | auth | F-001 | web-agent | P0 | — | DONE | docs/qa/auth/TC.md | oops |
FIX2_EOF
if bash "$FIX2/.claude/hooks/validate-state.sh" >/dev/null 2>&1; then
  _record_fail "C6 passed an agent writing outside its declared subtree"
else
  _record_pass "C6 rejects a cross-subtree write"
fi

# Orchestrator credited a task the harness saw return DONE with no files.
cat > "$FIX2/.claude/state/TASKS.md" <<'FIX2_EOF'
| ID | Title | Module | Feature | Agent | Pri | Depends | Status | Artifacts | Outcome |
|----|-------|--------|---------|-------|-----|---------|--------|-----------|---------|
| T-001 | Credited anyway | auth | F-001 | qa-web-agent | P0 | — | DONE | docs/qa/auth/TC.md | fine |
FIX2_EOF
printf '%s\n' '{"ts":"2026-01-01T00:00:00Z","event":"agent_return","task":"T-001","agent":"qa-web-agent","status":"DONE","artifacts":[],"evidence_conflict":"done_without_artifacts"}' \
  > "$FIX2/.claude/eval/events.jsonl"
if bash "$FIX2/.claude/hooks/validate-state.sh" >/dev/null 2>&1; then
  _record_fail "C7 passed a task credited DONE against a recorded evidence conflict"
else
  _record_pass "C7 rejects state that contradicts the event log"
fi


# --- Behavioural: the readers must actually return rows, and agree ---
#
# Everything above compares declarations. This runs the two readers against a
# real queue and compares their output, because the contract can be perfectly
# consistent on paper while one reader returns nothing.
#
# That is not hypothetical. tasks.sh stripped comments with a sed range
# (`/<!--/,/-->/d`), which starts at the opening line and looks for the
# terminator on LATER lines only — so the single-line `<!-- N tasks archived -->`
# in TASKS.md's own archival instructions swallowed every task row beneath it.
# The shell reader returned 0 rows and `next` said "No pending tasks" forever,
# while tasks.cjs (non-greedy regex) listed them correctly. Column names agreed
# throughout, so a declaration-only check stayed green.
BEHAV_TMP="$(mktemp -d)"
trap 'rm -rf "$BEHAV_TMP"' EXIT
cp "$TASKS" "$BEHAV_TMP/TASKS.md"

# Give it a realistic queue: SEVERAL completed rows plus a selectable one whose
# dependency is among them. Volume matters — the awk `-v donelist` bug only
# fired once done_ids contained a newline, i.e. two or more DONE rows. A probe
# with a single row kept this scenario green while `next` was dead on every
# real project.
{
  printf '| T-897 | Done probe one | auth | F-900 | spec-agent | P0 | — | DONE | .claude/state/TASKS.md | probe |\n'
  printf '| T-898 | Done probe two | auth | F-900 | backend-agent | P0 | — | DONE | .claude/state/TASKS.md | probe |\n'
  printf '| T-899 | Done probe three | auth | F-900 | web-agent | P1 | T-897 | DONE | .claude/state/TASKS.md | probe |\n'
  printf '| T-900 | Behavioural probe row | auth | F-900 | spec-agent | P0 | T-897,T-898 | PENDING | — | — |\n'
  # A LETTERED sub-task, because the readers disagreed about exactly these and
  # nothing here contained one. `T-\d+` matches T-899 and not T-899a, so a
  # reader carrying that pattern drops every sub-task while counting its
  # parent — and the fixture must contain one or the comparison below cannot
  # see it. Found in a real project only after an unrelated crash was fixed.
  printf '| T-899a | Lettered sub-task probe | auth | F-900 | web-agent | P1 | T-899 | DONE | .claude/state/TASKS.md | probe |\n'
} >> "$BEHAV_TMP/TASKS.md"

sh_rows=$(
  . "$CLAUDE_ROOT/lib/tasks.sh"
  tasks_init "$BEHAV_TMP/TASKS.md" >/dev/null 2>&1 && tasks_rows | grep -c '^| T-' || echo 0
)
sh_pick=$(
  . "$CLAUDE_ROOT/lib/tasks.sh"
  tasks_init "$BEHAV_TMP/TASKS.md" >/dev/null 2>&1 && { r=$(tasks_select_next); [ -n "$r" ] && tasks_get "$r" ID || echo ""; }
)

if [ "${sh_rows:-0}" -ge 1 ]; then
  _record_pass "tasks.sh returns ${sh_rows} row(s) from a real queue"
else
  _record_fail "tasks.sh returned 0 rows from a queue containing real tasks — the selector is blind and 'next' will report an empty queue"
fi

if [ -n "$sh_pick" ]; then
  _record_pass "tasks_select_next picks a task (${sh_pick})"
else
  _record_fail "tasks_select_next picked nothing from a queue with a selectable PENDING row"
fi

if command -v node >/dev/null 2>&1 && [ -f "$CLAUDE_ROOT/lib/tasks.cjs" ]; then
  js_rows=$(node -e "
    const t = require('$CLAUDE_ROOT/lib/tasks.cjs');
    const fs = require('fs');
    process.stdout.write(String(t.parseTable(fs.readFileSync('$BEHAV_TMP/TASKS.md','utf8')).rows.length));
  " 2>/dev/null || echo "err")
  if [ "$js_rows" = "$sh_rows" ]; then
    _record_pass "tasks.sh and tasks.cjs agree on row count (${sh_rows})"
  else
    _record_fail "reader divergence: tasks.sh sees ${sh_rows} row(s), tasks.cjs sees ${js_rows} — the orchestrator and the dashboard would disagree about the queue"
  fi
else
  _record_pass "node or tasks.cjs absent — cross-reader comparison skipped"
fi

# --- the readers must survive an ESM project, which is where they actually run ---
#
# This template ships no package.json, so every .js file under it loads as
# CommonJS and the readers work. A real project almost always declares
# `"type": "module"` — modern TypeScript defaults to it — and under that flag
# Node treats every .js in the tree as ESM, so `require`/`module.exports` throw
# on load. That is exactly what happened: a live project's node reader threw
# while the shell reader returned 110 rows, and R9 was green in the template the
# whole time. The bug could not exist in the environment the check ran in.
#
# Two halves, because one is not enough on its own.
#
# 1. BEHAVIOURAL, on the one module that is imported rather than executed:
#    build a scratch project declaring ESM and load tasks.cjs from inside it.
#    Only tasks.cjs is probed this way — requiring server.cjs starts an HTTP
#    server and requiring the capture hooks blocks reading stdin, so executing
#    them is not a test, it is a hang. (It hung once while this was written.)
#
# 2. STRUCTURAL, on the class: no .js file anywhere under .claude/ may contain
#    CommonJS. This is what catches the next file somebody adds, and it is why
#    the four existing ones are .cjs — an extension Node reads as CommonJS no
#    matter what the surrounding package.json says.
if command -v node >/dev/null 2>&1 && [ -f "$CLAUDE_ROOT/lib/tasks.cjs" ]; then
  ESM_TMP="$(mktemp -d)"
  printf '{ "name": "esm-probe", "type": "module" }\n' > "$ESM_TMP/package.json"
  cp "$CLAUDE_ROOT/lib/tasks.cjs" "$ESM_TMP/tasks.cjs"
  if ( cd "$ESM_TMP" && node -e "require('./tasks.cjs')" ) >/dev/null 2>&1; then
    _record_pass "the shared reader loads inside a project declaring \"type\": \"module\""
  else
    _record_fail "the shared reader does not load in an ESM project — this is what a real project runs in"
  fi
  rm -rf "$ESM_TMP"
fi

cjs_in_js=""
scanned=0
while IFS= read -r jsfile; do
  [ -f "$jsfile" ] || continue
  scanned=$((scanned + 1))
  grep -qE 'require\(|module\.exports' "$jsfile" && cjs_in_js="${cjs_in_js}${jsfile#$CLAUDE_ROOT/} "
done < <(find "$CLAUDE_ROOT" -name '*.js' -not -path '*/node_modules/*' 2>/dev/null)

[ "$scanned" -gt 0 ] \
  && _record_pass "scanned ${scanned} .js file(s) under .claude/ for CommonJS" \
  || _record_pass "no .js files under .claude/ — nothing that could break under ESM"

[ -z "$cjs_in_js" ] \
  && _record_pass "no .js file under .claude/ uses CommonJS — none can throw in an ESM project" \
  || _record_fail "CommonJS inside a .js file (rename to .cjs): ${cjs_in_js}"

# Commented example rows must still never reach selection.
if [ "$(. "$CLAUDE_ROOT/lib/tasks.sh"; tasks_init "$BEHAV_TMP/TASKS.md" >/dev/null 2>&1; tasks_rows | grep -c 'T-00X' || true)" -eq 0 ]; then
  _record_pass "commented example rows stay out of the live queue"
else
  _record_fail "a commented-out example row reached the live queue — it would be dispatched as a real task"
fi

if pass_or_fail "R9"; then
  echo "R9 VERDICT: PASS"
  exit 0
else
  echo "R9 VERDICT: FAIL"
  exit 1
fi
