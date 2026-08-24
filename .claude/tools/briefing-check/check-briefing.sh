#!/usr/bin/env bash
# Verify a briefing before it is dispatched.
#
#   bash .claude/tools/briefing-check/check-briefing.sh BRIEFING.md
#
# A briefing sends an agent somewhere. When it names a path that is not there, a
# line that has moved, or two instructions that cannot both hold, the agent
# spends a full dispatch establishing that the orchestrator was wrong. Six such
# defects in one session: a rule number that answered nothing, a class that had
# never existed in those files, a CSS rule present in no file in the repo, a spec
# path off by two directories, a queue row contradicting the spec it pointed at,
# and an endpoint declared in scope while the file holding it was declared
# off-limits.
#
# Five of the six were caught by the agent — after the dispatch was paid for.
# Every one of them was one `test -e` or one `grep` from being caught before.
#
# What this checks is what can be checked without understanding the task:
#   - every path the briefing tells the agent to READ exists
#   - every `file:line` citation points into a file long enough to have that line
#   - no path is both in scope and declared off-limits
#   - the read-file budget is respected
#
# What it cannot check: whether the path named is the RIGHT one, and whether the
# cause the briefing states is the real cause. A briefing that says "fix X
# because Y" passes here while Y is a guess. That failure needs a different
# remedy — brief the measurement, not the mechanism — and no script can enforce
# it.
#
# Exit: 0 = nothing found, 1 = at least one defect, 2 = bad usage.

set -uo pipefail

BRIEF="${1:-}"
[ -z "$BRIEF" ] && { echo "usage: check-briefing.sh <briefing-file>" >&2; exit 2; }
[ -f "$BRIEF" ] || { echo "check-briefing: no such file: $BRIEF" >&2; exit 2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

DEFECTS=0
CHECKED=0
fail() { printf '  FAIL  %s\n' "$1"; DEFECTS=$((DEFECTS + 1)); }
pass() { printf '  ok    %s\n' "$1"; CHECKED=$((CHECKED + 1)); }
note() { printf '  --    %s\n' "$1"; }

# Read the section under a heading that matches $1, up to the next heading.
section() {
  awk -v want="$1" '
    /^#+ |^\*\*/ { inside = (tolower($0) ~ tolower(want)); next }
    inside { print }
  ' "$BRIEF"
}

# Backticked tokens that look like paths: contain a slash, or carry an extension.
paths_in() {
  printf '%s' "$1" \
    | grep -oE '`[^`]+`' \
    | tr -d '`' \
    | grep -E '/|\.[a-z]{2,4}$' \
    | grep -vE '^https?:' \
    | sed 's/:[0-9]\+$//' \
    | sort -u
}

READ_SEC="$(section 'read')"
WRITE_SEC="$(section 'write to')"
DENY_SEC="$(section 'not touch|must not|off-limits|do not')"

# ── Every path the agent is told to READ must exist ────────────────────────
# An output path may legitimately not exist yet. An input path may not.
echo "paths the agent is told to read"
READ_PATHS="$(paths_in "$READ_SEC")"
if [ -z "$READ_PATHS" ]; then
  note "the briefing names no read paths — nothing to verify"
else
  while IFS= read -r p; do
    [ -z "$p" ] && continue
    if [ -e "$ROOT/$p" ] || [ -e "$p" ]; then
      pass "$p"
    else
      fail "$p does not exist — the agent will spend the dispatch discovering that"
    fi
  done <<< "$READ_PATHS"
fi
echo

# ── Citations must point into a file long enough to hold that line ─────────
# A remembered line number survives a merge as a plausible-looking lie.
echo "file:line citations"
CITES="$(grep -oE '`[^`]+:[0-9]+`' "$BRIEF" | tr -d '`' | sort -u)"
if [ -z "$CITES" ]; then
  note "no citations to verify"
else
  while IFS= read -r c; do
    [ -z "$c" ] && continue
    f="${c%:*}"; n="${c##*:}"
    target=""
    [ -e "$ROOT/$f" ] && target="$ROOT/$f"
    [ -z "$target" ] && [ -e "$f" ] && target="$f"
    if [ -z "$target" ]; then
      fail "$c cites a file that does not exist"
      continue
    fi
    lines="$(wc -l < "$target" | tr -d ' ')"
    if [ "$n" -le "$lines" ] 2>/dev/null; then
      pass "$c (file has $lines lines)"
    else
      fail "$c points past the end of the file ($lines lines) — the citation has moved"
    fi
  done <<< "$CITES"
fi
echo

# ── Nothing may be both in scope and off-limits ────────────────────────────
# Not a semantic check: a path under a forbidden prefix, stated in the same
# briefing. That is the form the contradiction took.
echo "scope contradictions"
DENY_PATHS="$(paths_in "$DENY_SEC")"
SCOPE_PATHS="$(printf '%s\n%s\n' "$READ_PATHS" "$(paths_in "$WRITE_SEC")" | sort -u | grep -v '^$' || true)"
if [ -z "$DENY_PATHS" ] || [ -z "$SCOPE_PATHS" ]; then
  note "nothing declared off-limits, or nothing in scope — no pair to compare"
else
  clash=0
  while IFS= read -r d; do
    [ -z "$d" ] && continue
    while IFS= read -r s; do
      [ -z "$s" ] && continue
      case "$s" in
        "$d"*)
          fail "$s is in scope while '$d' is declared off-limits — both cannot hold"
          clash=1 ;;
      esac
    done <<< "$SCOPE_PATHS"
  done <<< "$DENY_PATHS"
  [ "$clash" -eq 0 ] && pass "no path is both in scope and off-limits"
fi
echo

# ── The read budget ────────────────────────────────────────────────────────
N="$(printf '%s\n' "$READ_PATHS" | grep -c . || true)"
if [ "$N" -gt 7 ]; then
  fail "$N read paths — the budget is 3-7, and scope the owner did not ask for arrives this way"
elif [ "$N" -gt 0 ]; then
  pass "$N read path(s), within budget"
fi

echo
if [ "$DEFECTS" -gt 0 ]; then
  echo "check-briefing: $DEFECTS defect(s), $CHECKED verified — do not dispatch on this briefing"
  exit 1
fi
echo "check-briefing: $CHECKED claim(s) verified, nothing found"
exit 0
