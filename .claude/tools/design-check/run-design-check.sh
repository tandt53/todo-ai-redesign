#!/usr/bin/env bash
# Wrapper for check-design.mjs — resolves the design root through MANIFEST and
# never lets a missing browser break a review.
#
#   bash .claude/tools/design-check/run-design-check.sh
#   bash .claude/tools/design-check/run-design-check.sh --screenshots output/design-shots
#   bash .claude/tools/design-check/run-design-check.sh --wireframes
#
# Exit: 0 = no failures (including "skipped because no browser"), 1 = failures.
#
# Set DESIGN_CHECK_BROWSER to a chromium binary when Playwright is installed but
# its browsers are not downloaded — "installed" and "runnable" are different
# states, and the second one is what this check needs.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
MANIFEST="$ROOT/MANIFEST.md"

# Design root comes from MANIFEST ## Paths, never hardcoded.
DESIGN_ROOT="$(awk '
  /^roots:/ { r = 1; next }
  r && /^[a-z_]+:/ { r = 0 }
  r && /^  design: / { v = $2; gsub(/"/, "", v); sub(/\/$/, "", v); print v; exit }
' "$MANIFEST" 2>/dev/null)"

if [ -z "$DESIGN_ROOT" ]; then
  echo "design-check: MANIFEST ## Paths declares no design root — nothing to check."
  exit 0
fi

if [ ! -d "$ROOT/$DESIGN_ROOT" ]; then
  echo "design-check: $DESIGN_ROOT/ does not exist yet — nothing to check."
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  echo "design-check: node not found — skipped."
  exit 0
fi

cd "$ROOT" || exit 0

# Screenshots are not optional. The mechanical checks below tell you a mockup
# renders; only a render tells you it is any good, and a mockup nobody looked at
# was reviewed by nobody. The browser is already launched for the checks, so
# capturing every state at every breakpoint from that same launch is free — and
# it hands the reviewing agent a list of paths instead of a second screenshot
# pipeline to build and get wrong. Callers may still redirect them.
# --wireframes is the layout pass: the lo-fi study under wireframes/, with the
# two checks that a greyscale artifact cannot satisfy turned off. Its renders go
# to their own directory so a wireframe and the mockup that replaces it never
# overwrite each other under the same slug.
SHOT_DIR="$DESIGN_ROOT/_shots"
argv=()
for a in "$@"; do
  if [ "$a" = "--wireframes" ]; then
    SHOT_DIR="$DESIGN_ROOT/_shots/wireframes"
    argv+=(--subdir wireframes --lofi)
  else
    argv+=("$a")
  fi
done
set -- "${argv[@]+${argv[@]}}"

case " $* " in
  *" --screenshots "*) ;;
  *) set -- "$@" --screenshots "$SHOT_DIR" ;;
esac

EXIT=0

# ── Core design checks (token drift, render, overflow, states, contrast) ──
node "$SCRIPT_DIR/check-design.mjs" --design-root "$DESIGN_ROOT" "$@" || EXIT=1

# ── T-275: undefined CSS variable references (pure text, no browser) ──
echo ""
bash "$SCRIPT_DIR/check-undefined-vars.sh" --design-root "$ROOT/$DESIGN_ROOT" || EXIT=1

# ── T-271: mockup testids missing from the component catalogue ──
echo ""
bash "$SCRIPT_DIR/check-testid-catalogue.sh" --design-root "$ROOT/$DESIGN_ROOT" || EXIT=1

exit $EXIT
