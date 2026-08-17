#!/usr/bin/env bash
# Wrapper for check-design.mjs — resolves the design root through MANIFEST and
# never lets a missing browser break a review.
#
#   bash .claude/tools/design-check/run-design-check.sh
#   bash .claude/tools/design-check/run-design-check.sh --screenshots .claude/eval/design-shots
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
node "$SCRIPT_DIR/check-design.mjs" --design-root "$DESIGN_ROOT" "$@"
