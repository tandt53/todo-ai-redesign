#!/usr/bin/env bash
# R24 — Nothing hand-rolls a TASKS.md parser.
#
# It has happened four times. The fourth compared a Title column against a set
# of task ids: `line.split('|')` puts ID at [1] and Title at [2], while a regex
# match after `| T-xxx |` puts Title at [0]. Both offsets were used within ten
# minutes. Every row then looked like a leaf and the script printed `leaves: 88`
# with complete confidence — after 30 rows had already been moved on the
# strength of it.
#
# The shared reader exists precisely because three earlier copies of "Status is
# field 9" broke silently. A fourth copy is not a new mistake; it is the same one
# with a new author.
#
# **What this cannot catch, and it is the case that actually happened:** that
# fourth parser was an inline `python3 - <<PY` snippet, never a file. A repo grep
# only stops a fifth from being committed. The other half of the remedy is not a
# check at all — `lib/tasks.sh` gained a command line so that using the shared
# reader is shorter than typing awk, because a parser gets hand-rolled when the
# shared one costs more effort than the wrong answer.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/assert.sh"

CLAUDE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
LIB_SH="$CLAUDE_ROOT/lib/tasks.sh"
LIB_CJS="$CLAUDE_ROOT/lib/tasks.cjs"

echo "─── R24 — one TASKS.md reader, and it is cheap to use ───"

assert_file_exists "$LIB_SH" "lib/tasks.sh present"

# The command line is the half that addresses the case a grep cannot see.
for cmd in 'next)' 'ids)' 'max-id)' 'count)' 'get)'; do
  if grep -qF "    $cmd" "$LIB_SH"; then
    _record_pass "the reader answers \`${cmd%)}\` from the command line"
  else
    _record_fail "no \`${cmd%)}\` subcommand — rolling one by hand stays cheaper"
  fi
done

# Sourcing must keep working, or every existing caller breaks.
if ( . "$LIB_SH" >/dev/null 2>&1 && [ "$(type -t tasks_select_next)" = "function" ] ); then
  _record_pass "sourcing still defines the functions"
else
  _record_fail "adding the command line broke sourcing"
fi

# ── The grep ───────────────────────────────────────────────────────────────
# A file that reads TASKS.md and splits on "|" is parsing it. Allowed: the lib
# itself, and anything that goes through the lib.
OFFENDERS=""
while IFS= read -r f; do
  case "$f" in
    */lib/tasks.sh|*/lib/tasks.cjs) continue ;;
    */eval/scenarios/*) continue ;;   # fixtures build TASKS.md rather than read it
  esac
  grep -q 'TASKS\.md\|TASKS_MD' "$f" 2>/dev/null || continue
  # Goes through the reader? then it is not hand-rolling one.
  grep -qE 'lib/tasks\.(sh|cjs)|tasks_init|tasks_rows|parseTable|parseTasks' "$f" 2>/dev/null && continue
  # Splitting on the column separator is the tell.
  if grep -qE "awk -F'\\|'|cut -d'\\|'|split\(.*'\\|'|split\(.*\"\\|\"" "$f" 2>/dev/null; then
    OFFENDERS="$OFFENDERS $f"
  fi
done < <(find "$CLAUDE_ROOT" -type f \( -name '*.sh' -o -name '*.cjs' -o -name '*.mjs' -o -name '*.js' -o -name '*.py' \) 2>/dev/null)

if [ -z "$OFFENDERS" ]; then
  _record_pass "no file parses TASKS.md outside the shared reader"
else
  for o in $OFFENDERS; do
    _record_fail "${o#"$CLAUDE_ROOT"/} splits TASKS.md on '|' without going through lib/tasks"
  done
fi

# ── The grep must be able to fire ──────────────────────────────────────────
# Six sweeps in this project returned nothing and all six were wrong. A zero
# from this one means nothing until it has been shown to find a real offender.
CANARY_DIR="$CLAUDE_ROOT/hooks"
CANARY="$CANARY_DIR/.r24-canary.sh"
cat > "$CANARY" <<'CANARY_EOF'
#!/usr/bin/env bash
# A deliberate offender, planted and removed by R24.
awk -F'|' '{ print $9 }' .claude/state/TASKS.md
CANARY_EOF
trap 'rm -f "$CANARY"' EXIT

FOUND=0
if grep -q 'TASKS\.md' "$CANARY" 2>/dev/null \
   && ! grep -qE 'lib/tasks\.(sh|cjs)|tasks_init|tasks_rows' "$CANARY" 2>/dev/null \
   && grep -qE "awk -F'\\|'" "$CANARY" 2>/dev/null; then
  FOUND=1
fi
rm -f "$CANARY"

if [ "$FOUND" -eq 1 ]; then
  _record_pass "the detection finds a planted hand-rolled parser"
else
  _record_fail "the detection missed a planted offender — its zero proves nothing"
fi

if pass_or_fail "R24"; then
  echo "R24 VERDICT: PASS"
  exit 0
else
  echo "R24 VERDICT: FAIL"
  exit 1
fi
