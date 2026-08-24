#!/usr/bin/env bash
# Find every other place that has the defect you just found.
#
#   bash .claude/tools/sibling-sweep/find-siblings.sh \
#     --pattern 'transition:[^;]*[0-9]+ms' --found-in src/web/list.css
#
# Two tasks were written against one file each while the twin sat there. A
# mobile test was fixed; the web twin carried the identical defect and went red
# the same day when the clock rolled over. A task scoped to colour left five
# motion literals behind, found by a new check on its first run.
#
# Both were one grep from being complete BEFORE the row was written. Scoping a
# task to the file you happened to look at is how a defect gets fixed once and
# survives everywhere else.
#
# The file the defect was found in is the canary. If the pattern does not match
# THERE, the pattern is wrong — and a wrong pattern matching nothing elsewhere
# reads exactly like a tree that is clean. That is the same failure six visual
# sweeps produced: six zeroes, six wrong predicates, six clean bills of health.
#
# Exit: 0 = the origin is the only place, 1 = siblings found (name them in the
#       task row), 2 = the pattern does not match its own origin, or bad usage.

set -uo pipefail

PATTERN=""
ORIGIN=""
SCOPE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --pattern)  PATTERN="$2"; shift 2 ;;
    --found-in) ORIGIN="$2";  shift 2 ;;
    --scope)    SCOPE="$2";   shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

[ -z "$PATTERN" ] && { echo "usage: find-siblings.sh --pattern <regex> --found-in <file> [--scope <dir>]" >&2; exit 2; }
[ -z "$ORIGIN" ]  && { echo "find-siblings: --found-in is required — it is the canary" >&2; exit 2; }
[ -f "$ORIGIN" ]  || { echo "find-siblings: no such file: $ORIGIN" >&2; exit 2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
[ -z "$SCOPE" ] && SCOPE="$ROOT"

# ── The canary first ───────────────────────────────────────────────────────
# Everything below is worthless if the pattern cannot find the defect in the
# one place the defect is known to be.
if ! grep -qE "$PATTERN" "$ORIGIN" 2>/dev/null; then
  echo "find-siblings: the pattern does not match $ORIGIN, where the defect was found."
  echo "  The pattern is wrong. A zero from it would mean nothing — fix the pattern"
  echo "  and run again rather than concluding the tree is clean."
  exit 2
fi
echo "canary: pattern matches its origin — the sweep can find this defect"
echo

MATCHES="$(grep -rlE "$PATTERN" "$SCOPE" \
  --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=output \
  2>/dev/null | sort -u || true)"

SIBLINGS="$(printf '%s\n' "$MATCHES" | grep -v "^${ORIGIN}$" | grep -v "^${ROOT}/${ORIGIN}$" | grep -v '^$' || true)"

if [ -z "$SIBLINGS" ]; then
  echo "find-siblings: $ORIGIN is the only place this shape occurs."
  echo "  Scope the task to it and say so in the row, so the next reader knows"
  echo "  the sweep was run rather than skipped."
  exit 0
fi

N="$(printf '%s\n' "$SIBLINGS" | grep -c .)"
echo "find-siblings: $N other file(s) carry the same shape:"
printf '%s\n' "$SIBLINGS" | sed "s|^${ROOT}/||; s|^|  |"
echo
echo "  Name the full set in the task row. A task scoped to $ORIGIN alone leaves"
echo "  these to be found later, by whoever the defect reaches next."
exit 1
