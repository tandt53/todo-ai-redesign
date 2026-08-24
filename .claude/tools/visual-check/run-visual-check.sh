#!/usr/bin/env bash
# Wrapper for visual-check.mjs — resolves the design root through MANIFEST, so
# the tap-target floor and the screenshot directory are never hardcoded, and a
# missing browser degrades to a skip instead of breaking a review.
#
#   # after a mockup is written
#   bash .claude/tools/visual-check/run-visual-check.sh --target design/tasks/screens/list.html
#
#   # after the screen is built — the harness is already up at this point
#   bash .claude/tools/visual-check/run-visual-check.sh \
#        --target http://localhost:3000/tasks \
#        --against design/tasks/screens/list.html
#
# Exit: 0 = every criterion clean, 1 = a finding or a criterion that could not
# prove it works, 2 = bad invocation.
#
# Set VISUAL_CHECK_BROWSER (or DESIGN_CHECK_BROWSER) to a chromium binary when
# Playwright is installed but its browsers are not — "installed" and "runnable"
# are different states, and only the second one renders anything.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
MANIFEST="$ROOT/MANIFEST.md"

case " $* " in
  *" --target "*) ;;
  *) echo "visual-check: --target <file-or-url> is required" >&2; exit 2 ;;
esac

DESIGN_ROOT="$(awk '
  /^roots:/ { r = 1; next }
  r && /^[a-z_]+:/ { r = 0 }
  r && /^  design: / { v = $2; gsub(/"/, "", v); sub(/\/$/, "", v); print v; exit }
' "$MANIFEST" 2>/dev/null)"

if ! command -v node >/dev/null 2>&1; then
  echo "visual-check: node not found — skipped."
  exit 0
fi

cd "$ROOT" || exit 0

# The control floor is the project's to declare, so it is read from the
# project's tokens rather than invented here. Absent, the criterion is skipped
# and says so — see visual-check.mjs.
if [ -n "$DESIGN_ROOT" ] && [ -f "$ROOT/$DESIGN_ROOT/_shared/tokens.json" ]; then
  case " $* " in
    *" --tokens "*) ;;
    *) set -- "$@" --tokens "$DESIGN_ROOT/_shared/tokens.json" ;;
  esac
fi

# Renders are not an option. Every criterion below is a predicate, and the
# defects that motivated C16 were ones no predicate names — a heading hardcoded
# to one collection's name, a heading drawn identically to an ordinary one. Both
# passed every check and existed only in the picture.
case " $* " in
  *" --screenshots "*) ;;
  *) set -- "$@" --screenshots "${DESIGN_ROOT:-design}/_shots/visual" ;;
esac

node "$SCRIPT_DIR/visual-check.mjs" "$@"
