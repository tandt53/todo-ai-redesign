#!/usr/bin/env bash
# State validator — turns the conventions in docs/state-management.md into an
# enforced contract. Runs on the Stop hook and is safe to run by hand:
#
#   bash .claude/hooks/validate-state.sh
#
# Checks:
#   C1  every DONE/PARTIAL task names >=1 artifact, and each artifact exists
#   C2  every artifact path sits under a root declared in MANIFEST ## Paths
#   C3  every Depends entry references a task ID that exists
#   C4  no duplicate task IDs
#   C5  MANIFEST/STATUS/TASKS are within the caps in MANIFEST ## Limits
#   C6  every artifact lands inside its agent's subtree (MANIFEST writers:),
#       unless .claude/state/SANCTIONS.md records that exact crossing
#   C7  events.jsonl does not contradict TASKS.md
#
# Exits non-zero on any violation. A convention with no check here is a
# convention that will drift — if you add a rule, add its check too.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

MANIFEST="$ROOT/MANIFEST.md"
TASKS="$ROOT/.claude/state/TASKS.md"
STATUS="$ROOT/.claude/state/STATUS.md"

FAILURES=0
CHECKED=0

fail() { printf '  FAIL  %s\n' "$1"; FAILURES=$((FAILURES + 1)); }
pass() { printf '  ok    %s\n' "$1"; CHECKED=$((CHECKED + 1)); }
note() { printf '  --    %s\n' "$1"; }

# Hook mode: a project that has not been bootstrapped yet has no state to check.
if [ ! -f "$TASKS" ]; then
  echo "validate-state: no .claude/state/TASKS.md — nothing to validate."
  exit 0
fi

# Column positions are resolved from TASKS.md's own header by the shared reader.
# Nothing in this file may hardcode a field number: that duplication is what
# broke silently when a column moved.
# shellcheck source=../lib/tasks.sh
. "$ROOT/.claude/lib/tasks.sh"

if ! tasks_init "$TASKS"; then
  echo "validate-state: TASKS.md has no '| ID |' header row — cannot resolve columns."
  exit 1
fi

# Unfilled template rows are not yet real tasks.
ROWS=""
while IFS= read -r r; do
  [ -z "$r" ] && continue
  tasks_is_placeholder "$r" && continue
  ROWS="${ROWS}${r}
"
done <<< "$(tasks_rows)"
ROWS="$(printf '%s' "$ROWS")"

if [ -z "$ROWS" ]; then
  echo "validate-state: no live task rows yet — nothing to validate."
  exit 0
fi

cell() { tasks_get "$1" "$2"; }

echo "validate-state: $ROOT"
echo

# artifact_paths <cell> — echo one clean path per line.
# Handles what real orchestrators actually write: comma-separated entries,
# markdown backticks, trailing "(annotations)", and {a,b} brace groups whose
# inner commas must not split the entry.
artifact_paths() {
  printf '%s' "$1" | awk '
    BEGIN { depth = 0; buf = "" }
    {
      n = split($0, ch, "")
      for (i = 1; i <= n; i++) {
        c = ch[i]
        if (c == "{") depth++
        if (c == "}") depth--
        if (c == "," && depth == 0) { print buf; buf = "" } else buf = buf c
      }
    }
    END { if (buf != "") print buf }' | while IFS= read -r e; do
      e="$(printf '%s' "$e" | sed 's/^ *//; s/ *$//')"
      case "$e" in *\`*\`*) e="$(printf '%s' "$e" | sed 's/^[^`]*`//; s/`.*$//')" ;; esac
      e="$(printf '%s' "$e" | sed 's/ *([^)]*) *$//')"
      [ -z "$e" ] && continue
      case "$e" in
        *\{*\}*)
          pre="${e%%\{*}"; rest="${e#*\{}"
          grp="${rest%%\}*}"; suf="${rest#*\}}"
          case "$suf" in
            *\{*) printf '%s\n' "$e" ;;  # two groups — refuse to guess
            *) printf '%s' "$grp" | tr ',' '\n' | while IFS= read -r alt; do
                 printf '%s%s%s\n' "$pre" "$alt" "$suf"
               done ;;
          esac ;;
        *) printf '%s\n' "$e" ;;
      esac
    done
}

# ─── C1 + C2 ────────────────────────────────────────────────────────────────
# Allowed path prefixes come from MANIFEST: the roots block, plus any pattern
# whose value is a literal path (e.g. reports/). State files are always allowed.
ALLOWED="$(awk '
  /^roots:/            { inroots = 1; next }
  inroots && /^[a-z_]+:/ { inroots = 0 }
  inroots && /^  [a-z_]+: / { v = $2; gsub(/"/, "", v); print v; next }
  /^  [a-z_]+: +"[^{]/ { v = $2; gsub(/"/, "", v); print v }
' "$MANIFEST" | sort -u)"
ALLOWED="$ALLOWED
.claude/
MANIFEST.md
CLAUDE.md
BRIEFING.md"

echo "C1 — DONE/PARTIAL tasks name artifacts that exist"
while IFS= read -r row; do
  [ -z "$row" ] && continue
  id="$(cell "$row" ID)"
  status="$(cell "$row" Status)"
  artifacts="$(cell "$row" Artifacts)"

  case "$status" in
    DONE | PARTIAL) ;;
    *) continue ;;
  esac

  if [ -z "$artifacts" ] || [ "$artifacts" = "—" ] || [ "$artifacts" = "-" ]; then
    fail "$id is $status but names no artifact — an analysis is not a completed task (expected BLOCKED)"
    continue
  fi

  missing=0
  while IFS= read -r p; do
    [ -z "$p" ] && continue
    if [ ! -e "$ROOT/$p" ]; then
      fail "$id claims '$p' but it does not exist on disk"
      missing=1
    fi
  done <<< "$(artifact_paths "$artifacts")"

  [ "$missing" -eq 0 ] && pass "$id ($status) — artifacts present"
done <<< "$ROWS"
echo

echo "C2 — artifact paths resolve through MANIFEST ## Paths"
while IFS= read -r row; do
  [ -z "$row" ] && continue
  id="$(cell "$row" ID)"
  artifacts="$(cell "$row" Artifacts)"
  { [ -z "$artifacts" ] || [ "$artifacts" = "—" ] || [ "$artifacts" = "-" ]; } && continue

  while IFS= read -r p; do
    [ -z "$p" ] && continue
    ok=0
    while IFS= read -r prefix; do
      [ -z "$prefix" ] && continue
      # A root of "." or "./" is a legitimate custom-layout declaration meaning
      # "the whole tree is sanctioned" (monorepos with no single src root).
      case "$prefix" in .|./) ok=1; break ;; esac
      case "$p" in "$prefix"*) ok=1; break ;; esac
    done <<< "$ALLOWED"
    if [ "$ok" -eq 1 ]; then
      pass "$id — '$p' is under a declared root"
    else
      fail "$id writes '$p', which is outside every root in MANIFEST ## Paths"
    fi
  done <<< "$(artifact_paths "$artifacts")"
done <<< "$ROWS"
echo

# ─── C3 + C4 ────────────────────────────────────────────────────────────────
# C3 resolves `Depends` against the LIVE queue and the ARCHIVE TOGETHER (T-149).
#
# Archiving is not deletion: a row moved to TASKS-archive.md still exists, and a
# live row may legitimately still name it. Reading only TASKS.md made the two
# indistinguishable, which put `## Limits.done_rows` and C3 in DIRECT CONFLICT —
# every archival candidate turned one FAIL into several, so the cap could only be
# met by rows that happened to be leaves. Measured 2026-08-21: 61 DONE rows and
# **zero** archivable, because every one was named by a row that stays. The cap
# had become unsatisfiable by any means except raising it, which is what MANIFEST
# ## Limits forbids in writing. Guarded by eval scenario R9.
#
# `T-[0-9]*[a-z]?` and not `T-[0-9]*`: lettered sub-tasks (T-070b) are real rows,
# and a reader that drops them has bitten this queue twice already.
ALL_IDS="$(while IFS= read -r r; do [ -n "$r" ] && cell "$r" ID; done <<< "$ROWS")"
TASKS_ARCHIVE="$ROOT/.claude/state/TASKS-archive.md"
if [ -f "$TASKS_ARCHIVE" ]; then
  ALL_IDS="${ALL_IDS}
$(sed -n 's/^| *\(T-[0-9][0-9]*[a-z]\{0,1\}\) *|.*/\1/p' "$TASKS_ARCHIVE")"
fi

echo "C3 — Depends entries reference existing tasks"
while IFS= read -r row; do
  [ -z "$row" ] && continue
  id="$(cell "$row" ID)"
  deps="$(cell "$row" Depends)"
  { [ -z "$deps" ] || [ "$deps" = "—" ] || [ "$deps" = "-" ]; } && continue

  IFS=',' read -ra ds <<< "$deps"
  for d in "${ds[@]}"; do
    d="$(printf '%s' "$d" | sed 's/^ *//; s/ *$//')"
    [ -z "$d" ] && continue
    if printf '%s\n' "$ALL_IDS" | grep -qx "$d"; then
      pass "$id depends on $d"
    else
      fail "$id depends on '$d', which is not a task in this queue"
    fi
  done
done <<< "$ROWS"
ANY_DEPS=""
while IFS= read -r r; do
  [ -z "$r" ] && continue
  tasks_is_none "$(cell "$r" Depends)" || ANY_DEPS=1
done <<< "$ROWS"
[ -z "$ANY_DEPS" ] && note "no dependencies declared"
echo

# C4 spans the archive too, and that is forced by C3 above rather than chosen:
# once `Depends` resolves across both files, an id that appears in both resolves
# to two different rows and the resolution is ambiguous rather than wrong-in-one-
# direction. Widening this found three template SAMPLE rows (`module: auth`, a
# module this project does not have) sitting in the archive under ids T-002..T-004
# that real rows already used — removed 2026-08-21.
echo "C4 — task IDs are unique across the queue and the archive"
DUPES="$(printf '%s\n' "$ALL_IDS" | sort | uniq -d)"
if [ -n "$DUPES" ]; then
  while IFS= read -r d; do
    [ -n "$d" ] && fail "task ID $d appears more than once"
  done <<< "$DUPES"
else
  pass "$(printf '%s\n' "$ALL_IDS" | wc -l | tr -d ' ') task IDs, no duplicates"
fi
echo

# ─── C5 ─────────────────────────────────────────────────────────────────────
echo "C5 — state files within MANIFEST ## Limits"
limit() { awk -v k="$1" '$1 == k":" { print $2; exit }' "$MANIFEST"; }

check_cap() {
  local label="$1" file="$2" cap="$3"
  [ -f "$file" ] || { note "$label not present"; return; }
  if [ -z "$cap" ]; then
    note "$label — no limit declared in MANIFEST ## Limits"
    return
  fi
  local n
  n="$(wc -l < "$file" | tr -d ' ')"
  if [ "$n" -gt "$cap" ]; then
    fail "$label is $n lines, over the declared cap of $cap — archive before it stops being read carefully"
  else
    pass "$label $n/$cap lines"
  fi
}

check_cap "MANIFEST.md" "$MANIFEST" "$(limit manifest_lines)"
check_cap "STATUS.md"   "$STATUS"   "$(limit status_lines)"
check_cap "TASKS.md"    "$TASKS"    "$(limit tasks_lines)"

DONE_CAP="$(limit done_rows)"
DONE_N="$(tasks_count_status DONE)"
if [ -n "$DONE_CAP" ] && [ "$DONE_N" -gt "$DONE_CAP" ]; then
  fail "TASKS.md holds $DONE_N DONE rows, over the cap of $DONE_CAP — archive to TASKS-archive.md"
else
  pass "DONE rows ${DONE_N}/${DONE_CAP:-–}"
fi
echo

# ─── C6 ─────────────────────────────────────────────────────────────────────
# The pipeline has no file locks: overlap is prevented by giving each agent a
# disjoint subtree. That only holds if someone checks it after the fact, since
# the per-dispatch scope in BRIEFING.md is overwritten by the next dispatch.
echo "C6 — artifacts land inside the writing agent's subtree"

# A crossing that already happened cannot be un-happened, and re-attributing it to
# an agent that did not do the work is a worse record than the violation. The map
# has no way to say "sanctioned once" — MANIFEST says so in those words — so the
# sanction lives in its own register, one exact (task, agent, path) triple per row.
#
# Deliberately NOT a prefix match: `tests/` would license the whole tree, which is
# the back door this mechanism exists to avoid. And a sanctioned crossing prints as
# `sanc`, never as `ok`, because a grant that reads like a pass is how the next one
# gets issued without anyone deciding to.
SANCTIONS="$ROOT/.claude/state/SANCTIONS.md"
SANCTIONED=0
sanctioned_for() {  # id agent path
  [ -f "$SANCTIONS" ] || return 1
  awk -F'|' -v id="$1" -v ag="$2" -v pa="$3" '
    # T-[0-9]+[a-z]* and not T-[0-9]+: lettered sub-tasks (T-070b) are real rows,
    # and a reader that drops them is the hazard R9 already names as having bitten
    # this queue twice. A sanction silently not matching would read as a violation
    # nobody granted.
    /^\| *T-[0-9]+[a-z]* *\|/ {
      t=$2; a=$3; p=$4
      gsub(/^ +| +$/,"",t); gsub(/^ +| +$/,"",a); gsub(/^ +| +$/,"",p)
      gsub(/`/,"",p)
      if (t==id && a==ag && p==pa) { found=1; exit }
    }
    END { exit(found?0:1) }' "$SANCTIONS"
}

# Resolve any {token} in a writers: prefix against MANIFEST's own roots: block.
#
# This used to name the roots one by one — {specs}, {design}, {src}, {qa} — which
# meant adding a root to MANIFEST silently did nothing here: every artifact under
# it read as "outside the agent's subtree", and the fix looked like a writers-map
# problem rather than a validator one. Adding {tests} is what surfaced it. A list
# that has to be kept in step with another list by hand is a list that drifts, so
# this reads the roots instead of restating them.
expand() {
  local out="$1" tok root
  for tok in $(awk '/^roots:/{r=1;next} r&&/^[a-z_]+:/{r=0} r&&/^  [a-z_]+:/{k=$1;sub(/:$/,"",k);print k}' "$MANIFEST"); do
    root="$(root_of "$tok")"
    [ -n "$root" ] || continue
    out="${out//\{$tok\}/$root}"
  done
  printf '%s\n' "$out" | sed -e "s|{shared_dir}|$(shared_dir_of)|g" -e 's|//*|/|g'
}
root_of() { awk -v k="$1" '/^roots:/{r=1;next} r&&/^[a-z_]+:/{r=0} r&&$1==k":"{v=$2;gsub(/"/,"",v);sub(/\/$/,"",v);print v;exit}' "$MANIFEST"; }
shared_dir_of() { awk '$1=="shared_dir:"{print $2;exit}' "$MANIFEST"; }

WRITERS="$(awk '/^writers:/{w=1;next} w&&/^[a-z]/{w=0} w&&/^  [a-z-]+:/{print}' "$MANIFEST")"
if [ -z "$WRITERS" ]; then
  note "MANIFEST declares no writers: map — C6 skipped"
else
  while IFS= read -r row; do
    [ -z "$row" ] && continue
    id="$(cell "$row" ID)"
    agent="$(cell "$row" Agent)"
    artifacts="$(cell "$row" Artifacts)"
    { [ -z "$artifacts" ] || [ "$artifacts" = "—" ] || [ "$artifacts" = "-" ]; } && continue

    scope_raw="$(printf '%s\n' "$WRITERS" | awk -F': *' -v a="$agent" '{k=$1; gsub(/^ +| +$/,"",k); if (k==a) {print $2; exit}}')"
    if [ -z "$scope_raw" ]; then
      fail "$id names agent '$agent', which has no entry in MANIFEST writers:"
      continue
    fi
    scope="$(printf '%s' "$scope_raw" | tr -d '[]"' | tr ',' '\n')"

    while IFS= read -r p; do
      [ -z "$p" ] && continue
      ok=0
      while IFS= read -r pre; do
        pre="$(printf '%s' "$pre" | sed 's/^ *//; s/ *$//')"
        [ -z "$pre" ] && continue
        pre="$(expand "$pre")"
        # A subtree resolving to "./" (custom layouts declare src: ".") sanctions
        # the whole tree for that agent — same rule as C2's roots.
        case "$pre" in .|./) ok=1; break ;; esac
        case "$p" in "$pre"*) ok=1; break ;; esac
      done <<< "$scope"
      if [ "$ok" -eq 1 ]; then
        pass "$id — $agent wrote inside its subtree"
      elif sanctioned_for "$id" "$agent" "$p"; then
        printf '  sanc  %s\n' "$id — $agent wrote '$p' outside its subtree; sanctioned in SANCTIONS.md"
        SANCTIONED=$((SANCTIONED + 1))
      else
        fail "$id — $agent wrote '$p', outside its declared subtree ($(printf '%s' "$scope_raw" | tr -d '\n'))"
      fi
    done <<< "$(artifact_paths "$artifacts")"
  done <<< "$ROWS"
fi

# A grant that no longer describes anything is a dead grant, and dead grants are how
# a narrow mechanism widens: nobody removes a row that costs nothing to leave. So a
# sanction whose task still exists but no longer names that path is a FAILURE, not a
# note. A sanction whose task has been archived is skipped — the row moved, the
# history did not change.
if [ -f "$SANCTIONS" ]; then
  while IFS='|' read -r _ s_id s_ag s_path _rest; do
    s_id="$(printf '%s' "$s_id" | sed 's/^ *//; s/ *$//')"
    s_ag="$(printf '%s' "$s_ag" | sed 's/^ *//; s/ *$//')"
    s_path="$(printf '%s' "$s_path" | tr -d '`' | sed 's/^ *//; s/ *$//')"
    [ -z "$s_id" ] && continue
    row="$(printf '%s\n' "$ROWS" | grep -m1 "^| *$s_id *|" || true)"
    [ -z "$row" ] && continue   # archived — the sanction stays for the record
    if printf '%s\n' "$(artifact_paths "$(cell "$row" Artifacts)")" | grep -qxF "$s_path"; then
      pass "sanction for $s_id still describes a real artifact"
    else
      fail "SANCTIONS.md licenses $s_ag to have written '$s_path' on $s_id, but $s_id no longer names that path — remove the dead grant"
    fi
  done <<< "$(grep -E '^\| *T-[0-9]+[a-z]* *\|' "$SANCTIONS")"
fi
echo

# ─── C7 ─────────────────────────────────────────────────────────────────────
# The event log exists to audit the state files: hooks record what the harness
# observed, TASKS.md records what the orchestrator concluded. This check is the
# only place those two are actually compared — without it the log is write-only.
echo "C7 — event log does not contradict TASKS.md"
EVENTS="$ROOT/.claude/eval/events.jsonl"
if [ ! -s "$EVENTS" ]; then
  note "no events.jsonl yet"
else
  CONFLICTS="$(grep -o '"task":"T-[0-9]*"[^}]*"evidence_conflict":"done_without_artifacts"' "$EVENTS" 2>/dev/null \
             | grep -o 'T-[0-9]*' | sort -u || true)"
  if [ -z "$CONFLICTS" ]; then
    pass "no agent reported DONE without artifacts"
  else
    while IFS= read -r t; do
      [ -z "$t" ] && continue
      row="$(printf '%s\n' "$ROWS" | grep -m1 "^| *$t *|" || true)"
      [ -z "$row" ] && continue
      st="$(cell "$row" Status)"
      if [ "$st" = "DONE" ]; then
        fail "$t is DONE in TASKS.md, but the harness recorded its agent returning DONE with no files created"
      else
        pass "$t reported DONE without files; orchestrator correctly recorded $st"
      fi
    done <<< "$CONFLICTS"
  fi
fi
echo

# ─── Verdict ────────────────────────────────────────────────────────────────
SANC_NOTE=""
[ "${SANCTIONED:-0}" -gt 0 ] && SANC_NOTE=", $SANCTIONED sanctioned crossing(s) — see .claude/state/SANCTIONS.md"
if [ "$FAILURES" -gt 0 ]; then
  echo "validate-state: $FAILURES violation(s), $CHECKED check(s) passed$SANC_NOTE"
  exit 1
fi
echo "validate-state: all $CHECKED checks passed$SANC_NOTE"
exit 0
